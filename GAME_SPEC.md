# GAME SPEC — Astral Fantasy

The browser game version of the Astral bot (`northernblader-sys/astralgaming`).
This document is the source of truth for **what the game contains, how systems
connect, and what gets built in what order**. Bot rules are canonical; the
browser interface is ours to design.

- Combat math / gacha formulas / data shapes: see [`BOT_LOGIC_PORT_NOTES.md`](BOT_LOGIC_PORT_NOTES.md)
- Bot source (local reference): `/home/user/astralgaming/astralgaming-master`
  (extracted from `astralgaming-lite.zip`; lives **outside** this git tree)

**Port fidelity rule:** gameplay rules port from the bot faithfully. Transport,
payments, and moderation do not port. Where the bot's rule conflicts with good
browser UX, the rule wins and the UX wraps around it — exceptions are recorded
in *Decisions*.

---

## 1. System map

Phases: **V0** = first playable · **V1** = content depth · **V2** = long-term · **—** = not porting.

| # | System | What it is (bot) | Bot source | Depends on | Phase |
|---|--------|------------------|------------|------------|-------|
| 1 | Registration | Name + class (9) + race (6); two worlds, we ship **Astra Kingdom only** | `player-factory.js`, `data/classes.json`, `data/races.json` | stats (getTotalStats) | **V0** |
| 2 | Combat | Turn battle; single damage product; defense curve `def/(def+500)`; accuracy 97% cap; crit; floor vs expected player | `combat-engine.js`, `type-chart.js`, `type-matchup.js`, `effectiveness-engine.js` | skills, equipment, stats | **V0** |
| 3 | Skills | active/passive, MP, element/affinity, power at `effects[0].multiplier` | `data/skills.json`, `skill-slots.js`, `skill-info.js` | combat | **V0** |
| 4 | Equipment (basic) | 7 physical slots: weapon, offhand, helmet, chestplate, boots, accessory, tool (+pet); legacy aliases fold into offhand/chestplate | `equipment-slots.js`, `data/weapons.json`, `data/items.json` | combat | **V0** |
| 5 | Leveling / stats | XP → level (cap 100, reborn raises later); 15 starting stat points; per-level points; str/agi/int/def/lck | `applyLevelUps`, `data/levels.json`, `stat-progression.js` | combat | **V0** |
| 6 | Ranks | Level bands E→… Hunter titles with epithets/emoji (E: 1–10, D: 11–20, C: 21–30, B: 31–40 …) | `data/ranks.json`, `rank-engine.js` | leveling | **V0** (display) |
| 7 | Currencies | **Solars** ☀️ (start 100, earn/spend) and **Gems** 💎 (premium earnable). `monds/bankGold/loan` → Decisions | `data/currency.json`, wallet in player record | rewards | **V0** |
| 8 | Locations & monsters | 57 locations as the world map; monsters with types/stats/XP/solars drops | `data/locations.json`, `data/monsters.json` | combat | **V0** (subset) |
| 9 | Dungeon | Floor climb at a location; floor/checkpoint progress; rest/tools; enemy per floor | `dungeon-*.js`, `endless-dungeon.js`, `dungeonProgress` | combat, monsters | **V0** (core floors) / V1 (endless + ecology) |
| 10 | Tutorial | 8 conditional steps (register → daily → equip → fight → inventory → profile → dungeon → quest); graduation gift 500☀️+10💎 | `tutorial-engine.js` | all V0 systems | **V0** |
| 11 | Daily quests | 3 dailies/day drawn seeded by calendar day; explicit claim pays rewards; milestone track on lifetime counters shared with achievements | `quest-engine.js`, `data/quests.json` | rewards | **V0** (dailies) / V1 (milestones) |
| 12 | Gacha / spins | Gem spin on banners; dead-zone + plateau + hard pity; one-of-one exclusives; duplicates → shards | `spin-banners.js`, `data/characters.json`, banners | characters, gems | **V0** (one banner) |
| 13 | Characters (roster) | Collection of anime-style characters; atk/def/agi stats, HP = DEF×2; ability + equip to player | `characters.json`, `character-combat.js`, `character-abilities.js` | spins | **V0** (own + equip) |
| 14 | Save & state | Single player record (shape below), single-writer mutations, versioned schema | `player-factory.js`, `player-repo.js` | — | **V0** |
| 15 | Story mode | Volumes → chapters → beats; per-chapter 💎+XP; volume completion may **grant a character**; paid volumes (`unlock.gems`); 1 chapter/day window (3/day premium flag) | `story-engine.js`, `story-battle.js`, `data/story-*.json` | combat, characters, gems | **V1** |
| 16 | Bosses | Named boss encounters with enrage/cinematics/tokens; gate boss content | `boss-engine.js`, `bosses/*`, `adaptive-boss.js` | combat, dungeon | **V1** |
| 17 | Abilities | Separate from skills: ability inventory, 1+ slots, passive/active effects | `ability-engine.js`, `data/abilities.json` | combat | **V1** |
| 18 | Gear depth | Durability, enchantments, crafting recipes, materials, named/boss gear | `durability.js`, `enchantments.js`, `recipes`, `materials` | equipment | **V1** |
| 19 | Economy actions | Work / rob / sleep / daily claim / bank (interest) with cooldowns & streaks | `plugins/daily|work|rob|sleep`, `resting-wages` | wallet | **V1** |
| 20 | Hunger & stamina | Stamina 30/day (midnight reset) gates actions; hunger tick pressures uptime | `hunger-engine.js`, stamina in factory | dungeon/battle | **V1** (stamina in V0, hunger V1) |
| 21 | Achievements | Lifetime metrics → claimable rewards; shares counters with quests | `achievement-engine.js`, `data/achievements.json` | quests | **V1** |
| 22 | League | 20 seats (13 Adventurers + 7 players), 19 rounds ≈ 19 days, everyone-plays-everyone 1v1, NPC-PvP vs Adventurers, default loss, no summons/beasts | `lib/league/*`, `ASTRal league/astral-league-plan.txt`, `astral-npc-roster.json` | combat, PvP sim | **V2** |
| 23 | Seasons & passes | Seasonal content wipes, battle pass tiers, permanent Astral Pass with daily point cap | `season-engine.js`, `astral-pass-engine.js` | economy, characters | **V2** |
| 24 | Character duels | Deterministic atk/def/agi duels (seeded mulberry32, floor + spread) | `character-combat.js` (Yelan) | characters | **V2** |
| 25 | PvP arenas | Player-vs-player wagered combat | `pvp-engine.js` | combat | **V2** (needs sim AI) |
| 26 | Guilds | Guild boards, shops, wars | `guild-*.js` | economy | **V2** (evaluate) |
| 27 | Sect Empire | Second world: 5 cultivation paths, Qi/spirit-root/sect progression | `sect-*.js`, `data/sect-*.json` | registration (world choice) | **V2** (evaluate as separate mode) |
| 28 | Crafting/market/auction | Recipes, transmute, market, auction lots | `market-engine.js`, `auction.js` | economy, materials | **V2** |
| — | Payments / topups / naira / Monds sales | Real-money rails | `topup-offers`, `astralpay`, `mond-packages` | — | **—** (Decisions) |
| — | Messaging / moderation / stickers / OTP / personas / admin | Chat plumbing | `wa-bridge`, `plugins/*` admin | — | **—** |
| — | Side games: Pokémon, cards, dreamlands, inverted, empires, housing, astraltube/astratok, town/social | Parallel mini-games inside the bot | various `lib/` | — | **—** (scope; revisit only if ever) |

---

## 2. Player save shape (V0)

Derived from `player-factory.js`. Single record, `schemaVersion` for migrations,
all mutations through one store (single-writer discipline).

```
save = {
  schemaVersion, id, name, classId, raceId,
  level, xp, hp, maxHp, mp, maxMp,
  stats:      { str, agi, int, def, lck, wins, losses },
  baseStats:  { …, maxHp, maxMp },
  statPoints: { earned, spent, unallocated, allocations },
  wallet:     { solars, gems },
  equipped:   { weapon, offhand, helmet, chestplate, boots, accessory, tool, pet },
  inventory:  [ itemIds ],
  skills:     [ skillIds ],  equippedSkills: [ … ],
  ownedCharacters: [ characterIds ],  equippedCharacter: id | null,
  abilityInventory / equippedAbilities / abilitySlots,   // V1
  location, inDungeon, dungeonFloor, dungeonCheckpoint,
  battleState: null | { … },          // mid-battle resume
  dungeonProgress: { [dungeonId]: { highestFloor } },
  stamina: { current, max, resetAt },
  quests:   { day, daily, dailyClaimed, lifetime, milestoneClaimed },
  tutorial: { step, completed, graduationRewarded },
  storyProgress: { volumes: {} },      // V1
  dailyStreak, lastDailyClaim,
  registeredAt, updatedAt,
}
```

Dropped vs bot: `id` (WhatsApp JID → local save id), guild/premium/pending-payment
fields, `sect` (V2), season blocks (V2), bio/pfp (V2), pets/beasts/chest/kitx (V1+ as needed).

---

## 3. Content to port (data files)

**V0:** `classes.json` (9), `races.json` (6), `levels.json` (cap 100 + point rules),
`ranks.json`, `currency.json` (solars/gems only), `skills.json` (+ `skill-tiers`),
`characters.json` (start roster), `abilities.json` (only what V0 skills need),
`weapons.json`/`items.json` (starting + early drops), `locations.json` (subset),
`monsters.json` (subset), `quests.json` (daily pool), `effectiveness.json`,
spin banner config (from `spin-banners.js`).

**V1:** story volumes (`data/story-*.json` + `story/chapters-json`), `quests.json`
milestones, `achievements.json`, `food/recipes/materials/enchantments`, boss data,
`dungeon-ecology.json`, remaining locations/monsters.

**V2:** league roster (`astral-npc-roster.json`), seasons/passes, guild data,
sect data, market/auction.

---

## 4. First playable (V0) — scope & acceptance

**The loop:** Start → register → hub → fight → win/lose → rewards → level up →
spin a character → equip → dungeon floor → daily quest → save → reload and continue.

### Screens (V0)
1. **Registration** — name, class (9 cards), race (6 cards), stat preview
2. **Home / hub** — currencies, stamina, rank/level bar, nav (Battle, Dungeon, Roster, Quests, Profile, Settings)
3. **Battle** — player + enemy, HP/MP bars, skill buttons, combat log, type-effectiveness feedback
4. **Results** — win/lose, XP/solars/gems, level-ups, stat-point prompt
5. **Roster** — owned characters, equip/unequip, character detail (stats, ability)
6. **Recruitment (spin)** — one banner, gem cost, pity counter, reveal animation
7. **Inventory / equipment** — 7 slots, equip/unequip, item stats
8. **Dungeon** — floor N, enter/advance, checkpoint display
9. **Quests** — 3 dailies, progress, explicit claim
10. **Profile** — stats, allocation, rank title, win/loss, tutorial progress
11. **Settings** — save/export/import, reset, audio toggles (placeholders)

V1 adds: Story select/reader, bosses, achievements, economy actions, market, more.

### V0 acceptance criteria
- [ ] `pnpm build` (tsc + vite) and `pnpm test` green
- [ ] Fresh save registers a valid player per `player-factory` shape (class/race stats match bot's `getTotalStats`)
- [ ] A battle resolves with the bot's math (damage product, defense curve, accuracy, crit, floor) — verified by unit tests against bot-derived fixtures
- [ ] Type effectiveness uses the bot's 18×18 chart via `skillMatchup`
- [ ] XP/level/stat-points follow `levels.json` + `stat-progression.js`; rank title from `ranks.json`
- [ ] Spin respects dead-zone/plateau/pity; duplicates handled; seeded RNG (replayable tests)
- [ ] Equip/unequip affects combat stats; 7-slot rules incl. legacy alias folding
- [ ] Dungeon floor progress persists; one-floor-one-win where applicable
- [ ] 3 seeded dailies per calendar day; claim pays explicitly; midnight rotation
- [ ] Tutorial steps complete conditionally; graduation gift paid once
- [ ] Save → reload → identical state (versioned schema, migration stub)

### V0 assets (placeholders acceptable — approved art replaces them later)
UI: reuse `public/assets/uikit/*` (buttons, cards, panels, medallions, tabs, ribbons).
Gameplay: class/race icons, 1 enemy set, 3–6 starting characters, skill icons,
currency icons (☀️💎 already emoji-level). Art direction pass (plan step 2) runs
in parallel and defines how finals look.

---

## 5. Technical architecture (V0)

```
src/
  engine/    pure TS rules — combat, gacha, quests, dungeon, progression, tutorial.
             No DOM, no storage, no Math.random in core paths (seeded RNG injected).
  data/      typed JSON imports (ported bot data) + TS types for each shape.
  state/     store (single-writer), actions/dispatch, versioned save
             (localStorage; export/import as JSON file), migration stub.
  ui/        screens as DOM modules; shared kit components over uikit assets.
  main.ts    bootstrap: load save → route to screen.
tests/       vitest: engine unit tests + fixtures derived from bot logic.
```

- State changes only via store actions; engines are data-in/numbers-out (bot's
  own discipline — keeps parity tests trivial).
- RNG: `seededRandom` (mulberry32) injected everywhere randomness matters —
  same pattern as `character-combat.js`.
- Phaser: dependency retained but unused in V0 (DOM-first screens). Revisit for
  battle-scene polish; drop it if never needed.

---

## 6. Decisions (recorded, reversible)

| Decision | Choice | Why |
|----------|--------|-----|
| Worlds | **Astra Kingdom only** for V0–V1 | Sect Empire is a second game (5 cultivation paths); evaluate in V2 |
| Monds (₦ real-money) | **Dropped** from V0 | Payment rail doesn't port; gems already fund spins; direct-buy revisit in V1 as earnable currency |
| bankGold / loan | **Dropped** from V0 | Bank/economy actions are V1; debt systems need the bank |
| Premium | **Not ported as payment**; perks (e.g. 3 story chapters/day) gated behind a local "supporter" flag if ever | Bot premium is real-money WhatsApp purchases |
| Stamina | **Kept** (30/day, midnight reset) | It's a pacing rule in the bot's combat/dungeon loop |
| Hunger | **Deferred to V1** | Adds pressure loop; not needed to prove the core loop |
| PvP / League / Guilds | V2 | Need AI sims + long-horizon state first |
| Side games (Pokémon, cards, dreamlands, …) | Out of scope | Bot accumulated parallel games; the browser version ships one coherent RPG |
| Battle presentation | DOM-first; Phaser optional later | Fast iteration; rules don't care about renderer |
| Bot source location | `/home/user/astralgaming` (outside git tree) | Reference only; never commit bot code into this repo |

---

## 7. Build order (from here)

1. **V0-Slice 1 — engine + data:** port `data/` V0 files with types; implement
   combat/progression/gacha engines with parity tests (fixtures from bot math).
2. **V0-Slice 2 — state:** store, save/load, migration stub.
3. **V0-Slice 3 — screens:** registration → hub → battle → results (the loop
   closes here, placeholder art).
4. **V0-Slice 4 — systems UI:** roster/spin, inventory, dungeon, quests,
   profile, settings, tutorial wiring.
5. **V0 done** → art direction pass (plan step 2) + asset production (step 3)
   replace placeholders; then V1 (story, bosses, abilities, gear depth).
