# Bot Logic → Browser Game — Port Notes

> Source of truth: `northernblader-sys/astralgaming` (the official Astral WhatsApp bot),
> cloned read-only at `/home/user/astralgaming` for study.
> Goal: the browser game (`Astralnn`) becomes the *game version* of this bot's logic.
> The bot is **WhatsApp/Telegram-only**, so we extract the **pure game logic**
> (combat math, type chart, gacha/spin, progression, characters, story) and
> re-implement it in TypeScript behind the existing browser UI.

**Hard rule from the study:** the bot's `lib/` + `plugins/` (~960 files) are fused to the
messaging layer (wa-bridge, telegram adapters, render-*.mjs, db-adapter, premium/astralpay,
moderation). Those are **not portable**. Only the pure-mechanics modules and the
`data/*.json` content are. This doc records the parts worth replicating.

---

## 0. Architecture pattern to copy

The bot's *good* habit we should steal: **pure logic modules, no I/O**.
`lib/combat-engine.js` opens with "pure combat formulas, no I/O, no DB access."
`lib/story-engine.js` is "pure logic: no sock.sendMessage, no setTimeout."
`lib/spin-banners.js` is the pull loop with no rendering.

→ Every browser engine module should be a pure TS function/module:
`resolveTurn(state, action) -> { state, log }`, `calcPlayerDamage(player, skill)`,
`runSpinBatch(player, banner, n)`, etc. The `src/world/DungeonGame.ts` / UI only *render* results.

---

## 1. Combat engine (`lib/combat-engine.js`, 1465 lines)

### 1.1 Primary stat by class
```
warrior/samurai/knight/berserker → str
rogue/duelist/assassin          → agi
mage/cleric                     → int
```
`attackStatKey(player)` returns the stat a player's damage is built from.
`+ATK` equipment bonus lands on this same stat (no ATK stat exists).

### 1.2 Player damage — `calcPlayerDamage(player, skill?, damageMult=1, critBoost=0, opts)`
Final damage = floor of a single product (the "outgoing funnel" — every hit path
in the game goes through it):
```
base                 = primaryStat
× mult               = skill.effects[0].multiplier  (NOT skill.multiplier — that is undefined!)
× critMult           = 1.5 if crit else 1.0  (relic crit-damage bonus added on top)
× damageMultiplier   = caller's situational mult
× rebornWeaponMult
× warcryMult         (spent per landed hit)
× packRageMult       (Red Monster pack: scales up as HP drops)
× starterPotionMult  (damage_boost active effects, capped 200%)
× coreExtraStrikeMult
× relicFrenzyMult
× oathMult           (dungeon oath)
× graceMult          (King Yato crown: +30% owner)
× sharpnessMult      (weapon enchant)
× guildMult          (guild hall extreme)
× stanceMult         (C4 stances)
× masteryMult        (G1 weapon mastery)
× doctrine.mult      (weapon/combat doctrine, charges meter on committed hits)
× adaptiveMult       (adaptive boss)
× endOutgoingMult
× ronovaOutgoingMult (witch heroes)
× regressorOutgoingMult
× towerAttunementMult (ORV tower: registered 1.0, else 0.45)
× flashMult          (Minato Flying Thunder God)
× surtrWeaponMult    (molten giant × twilight)
× amiyaAuraMult      (Starlight Resonance +20..32%)
× amiyaBlessingMult  (Starfall Reckoning 2.25..2.5×, once, consumes armed blessing)
× affinitySkillMult  (Avatar element affinity + temple mastery, up to ~3.55×)
```
> Lesson for browser: keep ONE `calcOutgoing()` product so every mode (dungeon, boss,
> swarm, PvP) applies the same modifiers. Bots' bugs came from copies drifting.

### 1.3 Crit
`critChance = min(0.95, 0.05 + lck * 0.002 + boost)`. Crit = ×1.5 (plus relic crit-damage bonus).
Duelist rest-floor tool and Wolf Fang Charm can force a guaranteed crit (consumed once).

### 1.4 Defense — `applyDefense(rawDmg, def, attacker?, defender?, bs?)`
```
mitigation = def / (def + 500)        // softer high-def curve
capped     = min(mitigation, 0.97)    // never fully unwinnable
damage     = max(1, floor(raw × matchup × (1 - capped)))
```
Before mitigation: weapon `defenseIgnore` (up to 0.90), doctrine `pierce`, affinity
defense-ignore, and `armorBreak` stacks (×0.04 each) all reduce `def`.
Bleed weapon (every N hits) attaches a `burn`-type status here.

### 1.5 Player accuracy — `calcPlayerHitChance(player, enemy)`
```
base = 0.90 + agi * 0.0015 + affinityHitBonus
- monsterEvasion(enemy)   // tier proxy: regular 0.05, elite 0.10, boss 0.02; explicit `evasion` overrides, clamped to MAX_EVASION 0.75
- affinityEvasionBonus(enemy)
- blindPenalty (0.30 if blinded)
clamp [0.60, 0.99]
```
Absolute-guaranteed hooks (return early, in this order): Sanctum shield → 0;
Yu Miaoyi sure-hits → 1.0; Trio force-guaranteed → 1.0; Yu untouchable / Dreamstep /
Minato flash / Surtr Laevatain → 0 or 1.

### 1.6 Monster accuracy — `calcMonsterHitChance(enemy, player)`
```
base = 0.92
- dodge (agi * 0.001, cap 0.30)
- blindPenalty (0.30)
+ towerAccuracy (0.18) + tierAccuracy (boss 0.14 / elite 0.10 / regular 0.05)
clamp [0.64, 0.99]
```

### 1.7 Monster damage — `calcMonsterDamage(atk, playerDef, defending)`
```
variance   = 0.80 + random*0.40          // 0.80–1.20
effDef     = def * (defending ? 2 : 1)
mitigation = effDef / (effDef + 500), capped 0.97
damage     = max(1, floor(atk * variance * (1 - mitigation)))
```
Both operands `finiteNumber`-coerced (NaN avoidance — a real historical bug).

### 1.8 Monster floor scaling (the part that makes depth matter)
- `monsterStatsAtFloor(def, floor)`: bosses pass through authored stats untouched;
  regulars/elites are **re-balanced against the expected geared player at that floor**
  via `balanceRegularMonsterStats` (not raw authored numbers).
- `referencePlayer(level)` = naked `getTotalStats` + a share of a gear budget
  (gearHpAllowance/gearDamageAllowance/gearDefAllowance, owned = level/40).
- `depthRatio` = floor position 0→1. `survivalTurns` fall with depth (5.4→2.25),
  `clearTurns` rise (6.8→10.8). Archetype from **name keywords** (WALL_WORDS vs
  HITTER_WORDS) blended with raw atk/bulk bias.
- `enemyPowerRatio = playerPrimary / referencePlayer(level).dmg` → `scaleEnemyToPlayer`
  (exponents < 1, so a whale faces a hard fight not a brick wall; HP primary lever).
- `scaleBossToPlayer` sizes a boss to a **hit count** (target 16→28 by ratio), HP only up.
- `veteranTier`: level ≥ 100 (reborn band) gets extra HP/ATK/DEF ramp, env-tunable
  (VETERAN_MONSTER_*). Skipped below the threshold.
- `LOCATION_DIFFICULTY` table overrides per-location (e.g. `caged_dimension` is brutal,
  pinned by a test). Dreamlands & ORV tower use their **own absolute curves** (not the
  expected-player balance) — see `dreamlands-core.js` / `orv-tower.js`.

### 1.9 Leveling — `applyLevelUps(player, levelsData, classes, races, getTotalStats)`
- Cap 100 normally, **200 when reborn** (`playerLevelCap`). `levelsData.xpTable` is a
  **direct threshold**: you hit level N when `player.xp >= xpTable[N]`.
- Stat deltas come from `getTotalStats(class, race, level)` diffs; `maxHp`/`maxMp` grow too.
- On level-up, `baseStats` is **rebuilt** from class+race+level+allocations+reborn+statPack
  (this anchor prevents the "doubling bug" on death). `hp`/`mp` refill.
- `ensureStatPoints` keeps `statPoints.{earned,spent,unallocated,allocations}` in sync.

### 1.10 Equipment bonus — `applyEquipmentBonus(player, item, sign)`
Keys allowed: `str agi int def lck atk maxHp maxMp` (others silently ignored — a real
bug source). `atk` maps to the player's `attackStatKey` stat. `maxMp` change clamps `mp`.

### 1.11 Drops / stamina / bars
- `rollDrops(drops, looter)`: each entry `chance`; Looting enchant re-rolls failed rolls
  (cannot invent drops); Fortune Oath adds but never makes a 0-chance entry drop.
- `refreshStamina`: daily reset at local midnight.
- `hpBar` / `progressBar`: clamped on both ends (NaN-safe — `finiteNumber`).

---

## 2. Type effectiveness

### 2.1 `lib/type-chart.js` — 18×18 `TYPE_CHART`
Standard Gen-6-ish table: `normal fire water electric grass ice fighting poison ground
flying psychic bug rock ghost dragon dark steel fairy`. Missing pairings default to 1 (neutral).
`typeEffectiveness(moveType, defenderTypes[])` multiplies down a dual-type defender.

### 2.2 `lib/type-matchup.js` — makes it change damage
`skillMatchup(skill, enemy)`:
```
grade = matchups[category][enemy.type] ?? 1
if enemy.weakTo includes element/category → grade = min(2, grade * 1.34)
if enemy.resistTo includes …            → grade = max(0.5, grade * 0.67)
clamp [0.5, 2]
```
Element/affinity derived from `skill.element`/`skill.affinity` + `ELEMENT_CATEGORY` map.
Tiers: super-effective ≥1.75, effective ≥1.15, resisted <0.9, weak ≤0.6.

### 2.3 `lib/effectiveness-engine.js` — advisory
Grades moves for Willow's advisor (buildMoveOptions). **Pure read-only**, never mutates damage.
> Note: two systems (type-matchup for real damage, effectiveness-engine for advice) must
> agree — keep ONE resolver in the browser to avoid drift.

---

## 3. Gacha / spin (`lib/spin-banners.js`)

Per-character banner config (`SPIN_BANNERS`):
```
{ id, spinField, costPerSpin, currency: 'gems'|'solars',
  deadZoneUntil, plateauChance, pityAt,
  maxSpinsPerPlayer, maxSpinsPerCommand, exclusive }
```
Pull model (the core mechanic to replicate):
- **Dead zone**: spins 1…`deadZoneUntil` can NEVER win (e.g. Gogeta 1–230, Cid 1–324).
- **Plateau**: from `deadZoneUntil+1` to cap, a flat `plateauChance` per spin (0.08–0.90).
- **Hard pity**: spin ≥ `pityAt` always wins (set very high / 9999 when "no guaranteed win").
- **Exclusive (one-of-one)**: first winner bot-wide locks the banner; `claimExclusiveSpinForPlayer`
  under a serialized write lock. Preorders can gate release.
- Currency is **one** per banner; Monds is a *separate* outright-buy door, never combined with spins.
- `runSpinBatch(db, player, banner, playerId, n)`: read-modify-write inside an
  `updatePlayer()` mutator; stops the instant the banner is claimed or funds run out.
- Helper funcs: `spinBalance`, `spinsUsed`, `spinsLeft` (Premium raises the cap via
  `premiumExtraSpins`), `clampSpinCount`.
> NEVER show the curve (deadZone/plateau) to players — only the pity progress bar.

---

## 4. Stat progression (`lib/stat-progression.js`)

- `STAT_KEYS = ['str','agi','int','def','lck']`.
- `statPointCap(level, player)` = `level × statPointsPerLevel(15)`, capped at
  `maxStatPoints` (1500 normal, 3000 reborn).
- `ensureStatPoints(player)`: rebases old saves; lifts reborn flat bonus + stat-pack bonus
  out of `baseStats` before computing allocations; always keeps `baseStats` in sync.
- `addAllocation(player, stat, amount)`: spends unallocated points into `baseStats`+`stats`.
- `trainPlayer(player, amount)`: buys points with **Solars**; cost = `baseCost(100) + level×25`
  per point, room-limited to the cap.

---

## 5. Ranks (`lib/rank-engine.js`)

- `getRankForLevel(level)` → tier from `data/ranks.json` (E-Rank Hunter Lv1 … Shadow
  Sovereign Lv100, **10 levels apart**). Purely derived, nothing stored on the player.
- `getXpProgress(level, xp)`: **xpTable is a direct threshold** (you hit N at `xp>=xpTable[N]`),
  so `currThreshold = xpTable[level]` (0 at Lv1). Returns pct/intoLevel/forLevel/xpToNext/maxed.
- `capOverride` = `playerLevelCap` so reborn (Lv200) players don't read as maxed at 100.
- Prestige tiers (post-Lv200, LM→GM→Am→Pro) live in `title-engine.js`.

---

## 6. Data shapes (the most directly reusable content)

### 6.1 Characters — `data/characters.json`
```json
{
  "id": "mei", "stars": 3,
  "combat": { "atkType": "str", "atk": 1200, "def": 1100, "agi": 1000 },
  "name": "Mei", "emoji": "🌸",
  "rarity": "kindled", "tag": "legendary",
  "gemPrice": 0, "seasonId": "season_01",
  "characterTier": "major", "abilityTier": "mythic",
  "image": "https://…", "description": "…",
  "ability": { "name": "Final Form", "flavor": "…", "mirrorCopyable": true,
               "mirror": { "kind": "final_form", "magnitude": 1, "name": "Final Form" },
               "snapshotReversible": true },
  "statBonuses": { "int": 40 }   // some characters
}
```

### 6.2 Abilities — `data/abilities.json`
```json
{ "id": "ultra_instinct", "name": "Ultra Instinct", "rarity": "legendary",
  "type": "passive", "source": "dungeon_awakening", "description": "…", "effects": [] }
{ "id": "premium_favor", "effects": [
    { "type": "strengthen", "stat": "str", "value": 3, "duration": 999 }, … ] }
```

### 6.3 Skills — `data/skills.json`
```json
{ "id": "warrior_mighty_rampage", "name": "Mighty Rampage", "classId": "warrior",
  "tier": "common", "unlockLevel": 1, "mpCost": 9, "type": "active",
  "element": "physical", "affinity": "earth",
  "effects": [ { "type": "attack", "stat": "str", "multiplier": 0.98 } ] }
```
Note: skill power lives at `effects[0].multiplier`, **not** a top-level `multiplier`
(this is the bug the bot fixed — replicate the corrected read).

### 6.4 Other rich data files worth mining later
`data/classes.json`, `races.json`, `levels.json`, `monsters.json`, `bosses/*`,
`locations.json`, `ranks.json`, `items.json`, `weapons.json`, `named-weapons.json`,
`enchantments.json`, `sect-*`, `story-*.json`, `spin-locks.json`, `season-*-*.json`.

---

## 7. Story engine (`lib/story-engine.js`)

- Volumes map (`storyVolumes` → `volumeMap`); each volume is its own JSON + entry in the map.
- `chaptersAllowedPerWindow(player)` = **3 if Premium, else 1** per 24h.
- Pure state logic only: which chapter/beat the player is on, whether the next chapter
  is unlocked, what a chapter grants on completion. `plugins/story.js` owns delivery.
- `initStoryBattle` / `stepStoryBattle` hook combat into story beats.
- Data shape spec: `story/json-schema-spec.md` (in the bot repo).

---

## 8. DO NOT PORT (platform / non-game plumbing)

Leave these behind — they are WhatsApp/Telegram-specific and have no browser equivalent:
- `wa/`, `adapters/telegram/`, `wa-bridge/`, `plugins-telegram/` — messaging transport
- `*.mjs` render/card builders (`render-cards.mjs`, `battle-frame-render.mjs`, …) — image generation
- `astralpay.js`, `pay-orders.js`, `pending-purchase.js`, `premium*.js` — real-money payments
- `moderation-*`, `inbound-guard.js`, `dm-policy.js`, `ban-repo.js` — chat safety/moderation
- `db-adapter.js` / `mongo-adapter.js` — use the browser's existing `SaveStore` (localStorage) instead
- Per-character "persona"/"flavor" modules (`*-persona.js`) — flavor text, port only the *data*

---

## 9. Suggested port order (vertical slices)

1. **Combat core** — `calcPlayerDamage` + `applyDefense` + hit-chance + level-up, driven by
   `data/classes.json`+`races.json`+`levels.json`+`skills.json`. Wire one browser fight.
2. **Type chart** — `TYPE_CHART` + `skillMatchup`, fold into the damage product.
3. **Characters & equipment** — `characters.json` shape, `applyEquipmentBonus`, stat points.
4. **Gacha/spin** — `SPIN_BANNERS` + `runSpinBatch` (no exclusive lock needed in single-player;
   keep dead-zone/plateau/pity).
5. **Progression shell** — ranks, XP bar, stamina, story volumes.

Each slice: pure TS engine module + a thin UI/render layer, matching the bot's own discipline.
