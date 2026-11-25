# Asset license registry

Every file under `public/assets/` MUST have a row here before it ships.
Status values: `verified` · `unverified` (blocks release) · `reference`
(not shipped).

| Asset / pack | Path | Source | License | Status | Notes |
|---|---|---|---|---|---|
| Cinzel font | `public/assets/fonts/cinzel.woff2` | Google Fonts | OFL | verified | See `public/assets/fonts/LICENSES.md` |
| Fantasy Potions Pack 1 (10 icons) | `public/assets/items/potion_01..10.png` | craftpix.net | craftpix file license (use in games; no pack redistribution) | verified | Intake 2026-11-25; License.txt stays with source pack |
| Character battler sheets ×6 (kunoichi, ninja_monk, ninja_peasant, samurai, samurai_archer, samurai_commander) | `public/assets/characters/*/` | `astral-fantasy` repo | unrecorded | unverified | ~972 KB; 128/96-px frames; record origin before first ship |
| UI icon pack (59 icons: currency, bars, frames, panels, gear) | `public/assets/icons/` | `astral-fantasy` repo `More icon assets/` | unrecorded | unverified | Excludes sprite-sheet reference files (not copied) |
| UI atlases & concept boards | `astral-fantasy` repo | unrecorded | unverified | reference | Boards only — never shipped as game files |
| App logo / home / loading / leaderboard mockups | `astral-fantasy` repo | prior work | unverified | reference | Mockups only |
| Generated art (future) | `public/assets/**` | this project | project-owned | — | Register with `source: generated` + date |

**Intake log**
- 2026-11-25 — plan step 3 first intake: 6 character sheet folders (all
  animations), 59 UI icons, 10 potion icons → 80 manifest entries,
  `public/assets` = 5.48 MB (budget 6 MB).
