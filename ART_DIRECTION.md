# Astral Fantasy — Art Direction Guide

**Plan step 2 · feeds step 3 (character sheets + asset manifest/pipeline).**
This document defines how the finished game looks, what every asset must be,
and how assets enter the build. Approved art replaces placeholders by
following this guide — nothing ad-hoc.

---

## 1. Style pillars

1. **Astral night-court.** Deep teal-black shells, warm gold trim, ivory
   text — the kingdom-at-midnight mood the current UI already carries.
   Gold is earned, never decorative noise: it marks actions, value, rank.
2. **Pixel content, painted shell.** Characters, monsters, items and skill
   glyphs are pixel art (the owned sprite sheets are 128-px side-view
   battlers). The UI frame around them stays smooth and modern — panels,
   bars and type are crisp vector/CSS, never pixelated. Contrast between
   shell and content is the identity.
3. **Readable first.** Every screen must survive a 360-px phone: numbers
   legible, targets ≥ 44 px, one obvious primary action per view.
4. **Consistency over spectacle.** One frame style, one rarity ladder, one
   button language across all screens. New screens assemble existing
   components; they do not invent new chrome.

## 2. Reference boards (owned, in `astral-fantasy` repo)

| Board | Role |
|---|---|
| `Fantasy RPG UI Showcase.png` | **Layout & quality bar** — ornate navy/gold premium UI; use for composition, hierarchy, bar framing, nav-icon treatment. |
| `Pixel RPG UI Concept Board.png` | **Content language** — screen-by-screen pixel layouts, rarity ladder, icon vocabulary, status effects. Primary source for in-game content styling. |
| `Fantasy RPG UI Asset Atlas.png` / `Icon Atlas.png` | Component scrapbooks — frame, button and icon vocabulary to imitate. |
| `Astral Fantasy.html`, `home scren image.jpe`, `loading screen.jpe`, `Leaderboard.jpe`, `App logo.jpe` | Prior mockups — logo and loading-screen seeds. |

**Decision (hybrid):** keep the implemented dark-astral CSS shell as the
frame; adopt the Pixel RPG board's content language (frames, rarity,
icons, battlers) inside it. The Showcase remains the aspiration for polish
passes (ornate frames, richer banners). This costs zero UI rework and
matches every owned game asset.

## 3. Color system

All UI colors are CSS custom properties in `src/ui/styles.css` — screens
must never hard-code hex values.

### Shell
| Token | Value | Use |
|---|---|---|
| `--bg-deep` | `#0a1a1f` | page ground |
| `--bg` | `#10252b` | base ground |
| `--panel` / `--panel-2` | `#16333b` / `#1c4049` | card faces |
| `--line` | `#2c565f` | 1-px borders, dividers |
| `--ink` / `--ink-dim` | `#eee5cb` / `#b9cbbf` | primary / secondary text |
| `--gold` / `--gold-bright` | `#d9b45b` / `#f2d489` | accents, primary button, titles |

### Functional
| Token | Value | Use |
|---|---|---|
| `--hp` / `--hp-dark` | `#d4534f` / `#7a2b2a` | health |
| `--mp` / `--mp-dark` | `#4f8ed4` / `#2a4a7a` | mana |
| `--xp` | `#6fcf97` | experience, victory |
| `--danger` | `#e07a5f` | defeat, destructive actions |

### Rarity ladder (fixed, from the Pixel board — never re-color)
| Rarity | Border | Notes |
|---|---|---|
| common | `#9aa7ad` | gray |
| uncommon | `#5fbf7a` | green |
| rare | `#5b9bd5` | blue |
| epic | `#b072d6` | purple |
| legendary | `#e8b339` | orange-gold |
| mythic | `#e05656` | red |

Rarity colors appear ONLY on item/character/skill containers (slot
borders, card accents, pull reveals). Never on buttons or body text.

### Status effects (icon badge tints)
poison `#7ec850` · freeze `#7fd4f5` · burn `#ff8b4a` · shield `#c9cdd4` ·
curse `#9b6bff` · stun `#ffd75e`

## 4. Typography

- **Display:** Cinzel (`public/assets/fonts/cinzel.woff2`, OFL) — screen
  titles, character names, rank titles, buttons that commit (ENTER, CLAIM).
  Weight 600, letter-spacing 0.06em, uppercase only for short labels.
- **Body:** Georgia / system serif — descriptions, log lines, muted copy.
- **Numerics & HUD:** Arial/system sans, tabular where possible (bars,
  timers, counters) — pixel fonts are reserved for in-battle damage
  numbers only (step 3 may add one pixel face for VFX text).
- Scale: 22 / 16 / 14 / 13 / 12 / 10 px. Never below 12 px for body,
  10 px only for bar overlays with text-shadow.

## 5. Component language

| Component | Spec |
|---|---|
| **Panel** | `--panel` face, 1-px `--line` border, 10 px radius, 12 px padding. Elevated panels (tutorial, results) add gold border. |
| **Primary button** | Gold gradient fill (`#8a6a28→#6b5120`), ivory text, Cinzel. One per screen view. |
| **Secondary / ghost** | Transparent, `--line` border. Danger variant uses `--danger` border. |
| **Bars** | 16 px pill, `--bg-deep` track, gradient fill, centered 10 px overlay text with 1-px shadow. HP red, MP blue, XP green. |
| **Tabs / chips** | 999 px pills; active = gold border + `--gold-bright` text. |
| **Location / list card** | Panel row, title (Cinzel 14) + muted sub-line, trailing emoji or action; hover raises border to gold; locked = 50 % opacity. |
| **Slot** | 44-px square, `--bg-deep` face, rarity border when filled, empty = dashed `--line`. |
| **Portrait frame** | Square crop, 2-px gold ring + corner accents (ornate frame asset from atlas when available). |
| **Nav** | Six hub tabs (Battle, Dungeon, Roster, Quests, Profile, Settings) — pill form in V0; Showcase's diamond medallions are the polish-pass upgrade, same order. |
| **Iconography** | Pixel icons at 32/64 px logical grid. Emoji (☀️💎⚡) remain acceptable ONLY for currencies until icon assets land (manifest ids `ui/icon_solar`, `ui/icon_gem`). |

## 6. Screen-by-screen art notes

| Screen | Art treatment | Layout reference |
|---|---|---|
| **Register** | Class cards = icon + name + primary-stat chip; race chips; live stat preview panel. | Board §07 character |
| **Hub** | HUD pill row (name, level, currencies, stamina), XP bar, tutorial card with gold border, location cards with floor sub-lines. | Board §01 home + Showcase home |
| **Battle** | Two combatant panels (enemy top, player bottom), tier tag (elite purple / boss red), action grid, scrollable log. Side-view 128-px battlers replace emoji when sheets land — enemy right, player left, on a location backdrop (16:9, darkened 30 % for readability). | Board §03 combat |
| **Results / Death** | Centered display title (victory green / defeat danger), reward lines with icons, level-up box gold. Confetti/burst VFX on level-up. | Board §05 loot & results |
| **Roster** | Character cards: portrait frame, stars, rarity border, ACTIVE gold badge. Spin screen: banner card per character, reveal = rarity-colored flash. | Board §04/§06 |
| **Inventory** | Equipment silhouette panel (left) + carried list (right); slot grid uses rarity borders; equip/unequip buttons inline. | Board §04 inventory & equipment |
| **Dungeon** | Location cards with art thumb (location background crop), floor progress, checkpoint marker, lock state. | Board §02 dungeon selection |
| **Quests** | Daily/milestone cards with progress bars; claim button gold when ready. | Board §08 quest journal |
| **Profile** | Portrait + stat grid + rank crest; daily-claim and tutorial panels. | Board §07 |
| **Settings** | Export/import/reset panels, placeholder audio toggles. | Board §10 settings |

## 7. Character & monster art

**Battlers (combat):**
- Format: sprite sheets, **128×128 px frames**, transparent background,
  side-view facing left (player) / right (enemy — flip in code if needed).
- Required animations per character: `idle` (≥4 frames), `walk` (≥6),
  `attack` (≥2 variants), `hurt`, `dead` (≥4). Optional: `cast`, `jump`.
- Owned sheets (Kunoichi, Ninja Monk, Ninja Peasant, Samurai, Samurai
  Archer, Samurai Commander) already follow this contract — they are the
  reference implementation. Frame data goes in the sprite manifest (§9).
- Monsters: same 128-px grid; one sheet per monster family, palette-
  shifted variants for tiers (regular → elite = +hue, boss = larger crop
  or 192-px sheet allowed with manifest flag).

**Portraits (roster/profile/results):** square 256×256, character
waist-up, dark vignette background matching `--bg-deep`, exported from the
same design as battlers so faces match.

**Class & race icons:** 64×64 pixel glyphs (one per class ×9, race ×5)
for register/profile — sourced from the icon packs or produced in step 3.

**Skill icons:** 64×64 elemental glyphs (the board's skill-icon row:
arrow, fire, star, heal, shadow…). Neutral skills (iron palm) use a
fist glyph. Fallback: current emoji ✨⚔️🛡️ until manifest ids exist.

**Emoji policy:** emoji are placeholder-grade. Every emoji with a manifest
entry gets replaced before the art pass is called done; currencies are
first in line.

## 8. VFX & motion

- **Hit:** 120-ms white flash on the struck sprite + 4-px shake (2 px for
  player), damage number floats up 24 px, fades 600 ms.
- **Crit:** gold damage number, 1.3× scale pop, brief screen-edge glow.
- **Miss:** gray "MISS" drift, no shake.
- **Win:** victory banner scale-in (0.8→1, 200 ms), reward lines stagger
  60 ms apart. **Loss:** desaturate 30 %, slow fade.
- **Level-up / rank:** gold burst behind the results box; rank change
  gets a crest stamp.
- **Spin reveal:** card flip (300 ms), rarity-colored glow on win; pity
  spin adds a second flare.
- **Transitions:** screen changes crossfade 120 ms; no parallax, no
  continuous ambient animation on data screens.
- `prefers-reduced-motion: reduce` disables shake/float/flip — state
  changes remain instant and fully readable.

## 9. Asset manifest & pipeline (foundation for plan step 3)

**Layout**
```
public/assets/
  fonts/            # existing (cinzel.woff2, LICENSES.md)
  ui/               # shell chrome: frames, buttons, bars, medallions
  icons/            # 32/64 px glyphs (skill, status, currency, class)
  characters/<id>/  # portrait.png + sheets (idle.png, attack_1.png, …)
  monsters/<id>/    # same contract as characters
  items/            # gear & consumable icons
  locations/<id>/   # 16:9 backdrop crops
  audio/            # (V1) bgm/sfx
```

**Manifest** — `src/data/manifest.json`, single source of truth:
```jsonc
{
  "version": 1,
  "assets": {
    "ui/icon_solar": {
      "path": "assets/ui/icon_solar.png",
      "size": [32, 32],
      "license": "CC0",        // see license registry
      "source": "more-icons",  // repo/pack id or "generated"
      "replaces": "☀️"          // emoji placeholder being retired
    },
    "characters/samurai/sheets": {
      "path": "assets/characters/samurai/",
      "frame": [128, 128],
      "animations": { "idle": { "frames": 6, "fps": 6 }, "attack_1": { "frames": 3, "fps": 10 } },
      "license": "see-registry",
      "source": "astral-fantasy"
    }
  }
}
```

**Pipeline rules**
1. Every file that enters `public/assets/` is registered in the manifest
   AND the license registry (`docs/asset-licenses.md`) in the same commit.
   No file without provenance.
2. Naming: `snake_case`, category-first, no spaces, no dates
   (`icon_health_potion.png`, not `potion (3).png`).
3. Sizes: icons exported at @1x logical (32/64) and @2x; battlers native
   128; backdrops ≤ 1600 px wide, WebP fallback optional later.
4. Optimization: pngquant/oxipng before commit; budget **≤ 6 MB total**
   `public/assets` for V0.
5. Swap procedure: point the manifest `path` at the final asset → run
   `npx vitest run tests/data.test.ts` (manifest validation) → visual spot
   check of the affected screens → commit. UI code never changes during a
   swap; if it must, the guide is wrong, fix the guide first.
6. Sprite sheets: one PNG per animation + manifest frame data. Code reads
   manifest only — hard-coded frame widths are bugs.

## 10. Licensing status of the owned library

| Asset | Source | License status |
|---|---|---|
| `Free-Game-Icons-of-Fantasy-Potions-Pack-1` | craftpix.net | ✅ File license included (use in games OK; do not redistribute pack as-is). |
| Sprite sheets (Kunoichi/Ninja/Samurai folders), `More icon assets`, UI atlases | provenance unrecorded | ⚠️ **Flagged** — presumed free-packs; record origin in `docs/asset-licenses.md` before shipping publicly. |
| Screenshots/mockups (`home scren`, `loading screen`, `Leaderboard`, `App logo`) | prior work | ℹ️ Reference only — not shipped assets. |
| Cinzel font | OFL | ✅ LICENSES.md present. |
| Future generated art | this project | Mark `source: "generated"` + model/date in registry. |

Rule: **no asset ships in a release while its registry row says
`unverified`.**

## 11. Placeholder policy (what ships meanwhile)

- Current CSS shell + emoji icons + emoji battlers (👾🛡️⚔️) are the
  approved placeholders — they satisfy V0 acceptance.
- Placeholders may be swapped ONLY through the manifest (§9). Inline
  emoji added ad-hoc in new screens must reference a manifest id as its
  TODO.
- Step 3 delivers, in priority order: (1) currency/skill/status icons,
  (2) class/race icons + portraits for 9×5, (3) first monster battler
  sheet + player class sheets from owned libraries, (4) location
  backdrops, (5) ornate frames from the atlas for results/level-up.

## 12. Art-pass acceptance checklist

- [ ] Every emoji in shipped screens has a manifest entry or an explicit
      `placeholder: true` flag with a retirement issue.
- [ ] `manifest.json` covers 100 % of files under `public/assets/`.
- [ ] License registry has zero `unverified` rows for shipped files.
- [ ] Rarity ladder, status tints and color tokens match §3 exactly
      (grep for stray hex values in `src/ui` = fail).
- [ ] Battlers render from manifest frame data at 128 px on battle screen.
- [ ] `prefers-reduced-motion` honored for all §8 effects.
- [ ] Total asset weight ≤ 6 MB; `npm run build` + full test suite green.
- [ ] 360-px viewport spot check on hub, battle, inventory, profile.
