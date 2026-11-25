# Asset license registry

Every file under `public/assets/` MUST have a row here before it ships.
Status values: `verified` · `unverified` (blocks release) · `reference`
(not shipped).

| Asset / pack | Path | Source | License | Status | Notes |
|---|---|---|---|---|---|
| Cinzel font | `public/assets/fonts/cinzel.woff2` | Google Fonts | OFL | verified | See `public/assets/fonts/LICENSES.md` |
| Fantasy Potions Pack 1 | `astral-fantasy` repo → future `public/assets/icons/` | craftpix.net | craftpix file license (use in games; no pack redistribution) | verified | License.txt ships with pack |
| UI atlases & concept boards | `astral-fantasy` repo | unrecorded | unverified | reference | Boards only — never shipped as game files |
| Character sprite sheets (Kunoichi, Ninja Monk, Ninja Peasant, Samurai, Samurai Archer, Samurai Commander) | `astral-fantasy` repo | unrecorded free pack | unverified | unverified | Record origin before first ship |
| `More icon assets` (65 icons) | `astral-fantasy` repo | unrecorded free pack | unverified | unverified | Record origin before first ship |
| App logo / home / loading / leaderboard mockups | `astral-fantasy` repo | prior work | unverified | reference | Mockups only |
| Generated art (future) | `public/assets/**` | this project | project-owned | — | Register with `source: generated` + date |
