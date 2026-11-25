# WIREFRAMES — V0 screens & navigation journeys

Plan step 4. Companion to `GAME_SPEC.md` §4 (screen list) and
`ART_DIRECTION.md` (visual language). This document is the **spatial and
navigation contract** for the V0 shell: where every screen's regions sit,
and exactly which interactions move the player between screens.

- The DOM in `src/ui/**` is the implementation; this file is the map.
- `tests/journeys.test.ts` keeps the two honest: every `navigate()` /
  `data-nav` edge in code must appear in §4, and every `ScreenId` must be
  documented here.
- Wireframes are ASCII region maps, not pixel specs — visual detail lives
  in `ART_DIRECTION.md`. Art hooks reference manifest ids (§9 pipeline).

---

## 1. Global chrome

Every screen except `register` renders inside the same shell:

```
┌──────────────────────────────┐
│  HUD   [☀️ n] [💎 n] ⚡ n/n  │  ← currencies + stamina + W/L (hub only)
│  XP ▓▓▓▓▓░░░░░░░░           │  ← level progress (hub only)
├──────────────────────────────┤
│  [tabs / ← Hub]              │  ← per-screen tab row (§4)
│                              │
│   … screen content …         │
│                              │
├──────────────────────────────┤
│  (bottom of content)         │
└──────────────────────────────┘
```

- Viewport: mobile-first single column, max-width ~480 px, centered.
- Tab rows are local to each screen (no persistent bottom bar in V0).
- `register` is full-bleed (no HUD, no tabs).
- Currency glyphs in HUD come from the manifest (`icons/coin_crown`,
  `icons/gem_blue`) with emoji fallback.

## 2. Route guards (automatic transitions)

The router enforces these before every render — user intent cannot violate
them:

| # | Condition | Forced screen |
|---|-----------|---------------|
| G1 | no saved player | `register` (from any screen) |
| G2 | player exists while on `register` | `hub` |
| G3 | `battleState.status === 'active'` while on any screen outside `battle`/`results`/`death` | `battle` |
| G4 | `battle` with no active session (stale) | `hub` |
| G5 | `settings` reset confirmed (save wiped) | `register` |

```
            G1 ▼ (any screen, no save)
        ┌───────────┐   G2 (save exists)   ┌─────┐
        │ register  │ ───────────────────▶ │ hub │◀────────────┐
        └───────────┘                      └──┬──┘             │
                                              │                │
                    G3 (battleState active) ▼ │                │
                                        ┌─────┴────┐           │
                                        │ battle   │           │
                                        └──┬───┬───┘           │
                                win ▼      │   │      loss ▼    │
                                   ┌───────┴┐ ┌┴──────┐        │
                                   │results │ │ death │        │
                                   └───┬────┘ └──┬────┘        │
                        CONTINUE ─────┘         └── RETURN ────┘
```

## 3. Navigation journeys

Each journey is a named flow the player actually experiences. Edge
numbers refer to the table in §4.

### J1 — First run (onboarding)

```
launch → [G1] register ──1──▶ hub ──tutorial card──▶ guided hops:
   check_profile(→profile→hub) · check_inventory(→roster→inventory→hub)
   · spin_hint(→spin→roster→hub) · weapon_equipped(inventory)
   · fight_monster(→battle→results→hub) · graduation gift once
```

### J2 — Core battle loop (the game)

```
hub ──8──▶ floor picker ──ENTER──▶ battle ──10──▶ results ──13──▶ hub
                ▲                    │
                └──── (re-render) ───┘ 9   actions: Attack / Defend / 2 skills
                                       loss ──11──▶ death ──14──▶ hub
```

One floor = one battle; winning settles rewards before return (§ J5).

### J3 — Dungeon progression

```
hub ──3──▶ dungeon ──24──▶ battle (floor N)
   location rows show locked 🔒 (level gate) / highest floor progress
   floor picker caps at highest+1 (one-floor-one-win)
```

### J4 — Recruitment loop

```
hub ──4──▶ roster ──16──▶ spin ──banner pick──▶ reveal ──▶ roster (new card)
   roster empty state also deep-links to spin (OPEN THE BANNER)
   pity counter visible on banner cards
```

### J5 — Rewards & progression (on results return)

```
results shows: XP + solars (+gems) → level-ups → stat-point prompt
hub: XP bar, unallocated points (Train 5/15 on profile), rank title
```

### J6 — Equipment loop

```
roster ──17──▶ inventory ──equip/unequip──▶ (stay) ──15──▶ hub
roster: set ACTIVE character (Equip/Unequip, self-edge 18)
```

### J7 — Quests & daily cadence

```
hub ──5──▶ quests ──claim / claim-all──▶ (stay, rewards applied)
   dailies rotate at midnight; milestones once ever;
   hub tab shows claimable badge
```

### J8 — Profile & settings

```
hub ──6──▶ profile ──27──▶ settings ──29──▶ profile
profile: stat allocation, daily claim, tutorial progress
settings: export/import save (schema v1), reset ──30──▶ [G5] register
```

### J9 — Persistence

```
every store.update → save (schemaVersion 1)
launch → load → [G1/G2] route → continue exactly where the player left
```

## 4. Edge table (machine-checked)

Every user-triggered navigation in `src/ui/**` appears here exactly as
`navigate()` / `data-nav` targets it. Guards (G1–G5) are separate (§2).

| # | From | To | Trigger |
|---|------|----|---------|
| 1 | `register` | `hub` | Create adventurer |
| 2 | `hub` | `hub` | Tab "Battle" (refresh home) |
| 3 | `hub` | `dungeon` | Tab "Dungeon" |
| 4 | `hub` | `roster` | Tab "Roster" |
| 5 | `hub` | `quests` | Tab "Quests" (badge = claimable count) |
| 6 | `hub` | `profile` | Tab "Profile" |
| 7 | `hub` | `settings` | Tab "Settings" |
| 8 | `hub` | `battle` | Location row → floor picker → ENTER FLOOR |
| 9 | `battle` | `battle` | Action resolves (same-screen re-render) |
| 10 | `battle` | `results` | Victory |
| 11 | `battle` | `death` | Defeat |
| 12 | `results` | `hub` | CONTINUE |
| 13 | `death` | `hub` | RETURN TO TOWN |
| 14 | `roster` | `hub` | ← Hub |
| 15 | `roster` | `spin` | Tab "Recruit" / OPEN THE BANNER |
| 16 | `roster` | `inventory` | Tab "Inventory" |
| 17 | `roster` | `roster` | Equip / Unequip character (re-render) |
| 18 | `spin` | `hub` | ← Hub |
| 19 | `spin` | `roster` | Tab "Roster" |
| 20 | `inventory` | `hub` | ← Hub |
| 21 | `inventory` | `roster` | Tab "Roster" |
| 22 | `dungeon` | `hub` | ← Hub |
| 23 | `dungeon` | `battle` | ENTER FLOOR |
| 24 | `quests` | `hub` | ← Hub |
| 25 | `profile` | `hub` | ← Hub |
| 26 | `profile` | `settings` | Tab "Settings" |
| 27 | `settings` | `hub` | ← Hub |
| 28 | `settings` | `profile` | Tab "Profile" |
| 29 | `settings` | `register` | Reset save (confirm) |

## 5. Screen wireframes

Region maps top → bottom. Art hooks: manifest ids from `ART_DIRECTION`
§7/§9; `emoji` = placeholder still acceptable.

### 5.1 `register` — Registration (full-bleed)

```
┌──────────────────────────────────┐
│  ✦ ASTRAL FANTASY ✦              │  Cinzel display
│  Create your adventurer          │
├──────────────────────────────────┤
│  NAME  [____________] 2–20 ch    │
├──────────────────────────────────┤
│  CLASS                           │
│  ┌────┐┌────┐┌────┐ … ×9 cards  │  emoji + name + primary stat
│  └────┘└────┘└────┘              │
├──────────────────────────────────┤
│  RACE  (human elf dwarf orc …)   │  chips ×6 (fairy hidden)
├──────────────────────────────────┤
│  [preview: stats grid]           │  appears after class pick
├──────────────────────────────────┤
│  [     BEGIN ADVENTURE      ]    │  → 1 → hub (creates save)
└──────────────────────────────────┘
```

- Empty name / no class → inline validation, no navigation.
- Race optional (defaults applied by factory).

### 5.2 `hub` — Home

```
┌──────────────────────────────────┐
│ HUD: [☀️] [💎]  ⚡ n/n   🏆 w/l │
│ XP ▓▓▓▓▓▓▓░░░░░                 │
├──────────────────────────────────┤
│ [Battle][Dungeon][Roster][Quests•]│ 2..7 + quest badge
│ [Profile][Settings]              │
├──────────────────────────────────┤
│ ▸ tutorial card (progress + Skip)│  hidden after graduation
├──────────────────────────────────┤
│ Stats  STR AGI INT DEF LCK HP MP │
│        primary · rank title      │
├──────────────────────────────────┤
│ Choose your battle               │
│  🏰 Newcomer's Hollow  Floor 3/50│  → 8
│  🌲 … (locked rows dimmed 🔒)    │
│  [floor panel: − F3 + ENTER]     │  inline, not a route
└──────────────────────────────────┘
```

### 5.3 `battle`

```
┌──────────────────────────────────┐
│ BATTLE                           │
│ newbie_hollow · Floor 3 · Turn 2 │
├──────────────────────────────────┤
│ 👾 Slime            [tier tag]   │  enemy panel
│ HP ▓▓▓▓░░░░ 24/40               │
├──────────────────────────────────┤
│   👾            ⚔️        [battler]│  stage: foe | vs | hero sprite
│                              (idle loop, class sheet)│
├──────────────────────────────────┤
│ 🛡️ Hero · Lv 4                  │  player panel
│ HP ▓▓▓▓▓▓░░ 88/120              │
│ MP ▓▓▓░░░░░ 20/40               │
├──────────────────────────────────┤
│ [Attack][Defend][skill][skill]   │  → 9 (re-render per turn)
├──────────────────────────────────┤
│ log: ev-dmg / ev-crit / ev-miss  │  color-coded, scrollable
└──────────────────────────────────┘
   victory → 10   defeat → 11   (no flee in V0; G3 keeps you here)
```

### 5.4 `results` (victory) / `death` (defeat)

```
┌───────────────────┐   ┌───────────────────┐
│ VICTORY           │   │ YOU FELL          │
│ stands triumphant │   │ …wakes in Astral Town│
│ +100 ☀️ +125 XP   │   │ loss recorded,    │
│ Level 4! +3 pts   │   │ hp/mp restored 50%│
│ [ CONTINUE ] →12  │   │ [RETURN TO TOWN]→13│
└───────────────────┘   └───────────────────┘
```

### 5.5 `roster`

```
┌──────────────────────────────────┐
│ ROSTER    5 characters owned     │
│ [← Hub][Recruit][Inventory]      │ 14 15 16
├──────────────────────────────────┤
│ ┌ 🧙 Kael  ⭐⭐⭐ rare      [Equip]│  → 17 (ACTIVE gold tag)
│ │  description…                  │
│ └────────────────────────────────│
│ … more cards …                   │
│ empty: "No characters yet"       │
│        [OPEN THE BANNER] → 15    │
└──────────────────────────────────┘
```

### 5.6 `spin` — Recruitment

```
┌──────────────────────────────────┐
│ RECRUITMENT                      │
│ [☀️ n · 💎 n]                    │
│ [← Hub][Roster]                  │ 18 19
├──────────────────────────────────┤
│ banner cards: cost · pity x/y    │
│ [x1] [x10]                       │
├──────────────────────────────────┤
│ reveal: ★ card grid (rarity tint)│  results stay until dismissed
└──────────────────────────────────┘
```

### 5.7 `inventory` — Equipment

```
┌──────────────────────────────────┐
│ INVENTORY   n items carried      │
│ [← Hub][Roster]                  │ 20 21
├──────────────────────────────────┤
│ EQUIPPED (7 slots)               │
│ [weapon][armor][helmet][offhand] │  tap → unequip
│ [boots][accessory][?]            │
├──────────────────────────────────┤
│ BACKPACK                         │
│ ⚔ Iron Sword  common STR+4 [Equip]│ → stay, re-render
│   (level-gated rows show 🔒)     │
└──────────────────────────────────┘
```

### 5.8 `dungeon`

```
┌──────────────────────────────────┐
│ DUNGEON  One floor, one win      │
│ [← Hub]                          │ 22
├──────────────────────────────────┤
│ location rows (same as hub list)│
│  → floor picker (− F + ENTER) → 23
│ locked rows: level gate text     │
└──────────────────────────────────┘
```

### 5.9 `quests`

```
┌──────────────────────────────────┐
│ QUESTS   n ready to claim        │
│ [← Hub][Claim all (n)]           │ 24 (claim-all only if claimable)
├──────────────────────────────────┤
│ Daily — rotates at midnight      │
│  [☀️ 250] Slay 3  ▓▓░ 2/3 [Claim]│
│  … ×3 seeded dailies             │
├──────────────────────────────────┤
│ Milestones — once ever           │
│  [💎 5] Reach level 10  …[Claim] │
└──────────────────────────────────┘
```

### 5.10 `profile`

```
┌──────────────────────────────────┐
│ PROFILE                          │
│ Name · class · race              │
│ [← Hub][Settings]                │ 25 26
│  [class battler sprite]          │  manifest idle loop
│  [☀️] [💎] ⚡ n/n                │
├──────────────────────────────────┤
│ XP bar · Rank: Seeker            │
│ Stats grid + unallocated points  │
│ [Train 5 · ☀️ cost][Train 15]    │  → allocation
│ [+1 on stat when points > 0]     │
├──────────────────────────────────┤
│ Daily claim (streak)             │
│ W / L · Tutorial progress (n/8)  │
└──────────────────────────────────┘
```

### 5.11 `settings`

```
┌──────────────────────────────────┐
│ SETTINGS  Save data · schema v1  │
│ [← Hub][Profile]                 │ 27 28
├──────────────────────────────────┤
│ [COPY SAVE JSON] → textarea      │
│ [import: textarea + IMPORT]      │
│ [RESET SAVE] confirm → 29        │
│ audio toggles (placeholder, V1)  │
└──────────────────────────────────┘
```

## 6. Empty & error states (all screens)

| State | Behaviour |
|-------|-----------|
| No save | G1 → register, from anywhere |
| Roster empty | CTA to spin (edge 15) |
| Stale battle (no session) | G4 → hub |
| Import invalid JSON | alert, stay on settings |
| Equip refused (level/dupe rules) | alert(reason), stay |
| Claim already taken | button disabled, no nav |
| Battle interrupted (reload mid-fight) | G3 → battle resumes from `battleState` |

## 7. V1 extension points (documented, not built)

Reserved journeys — wireframes will be added when implemented:

- **Story select/reader** (new root tab beside Battle)
- **Boss gates** (dungeon rows with boss badge → special results)
- **Market / guild / season** (hub secondary rows, V1+)
- **Achievements** (profile section)
- **Audio settings** (settings rows currently placeholder)

## 8. Acceptance

- [x] All 11 V0 screens (+ death) have region wireframes
- [x] All user-triggered edges enumerated in §4
- [x] Guards G1–G5 documented (§2)
- [x] Journeys J1–J9 cover onboarding, core loop, and every subsystem
- [x] `tests/journeys.test.ts` enforces code ↔ table sync
