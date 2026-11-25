# Astral Silks — illustrated UI skin pack

Pearly resin, wet jade and midnight satin share fibrous grain, iridescent edge light,
metallic double seams, carved botanical curls and luminous pearl pins. Eight curved,
asymmetric silhouettes make each screen feel composed rather than assembled from boxes.

[View the vector contact sheet](./preview.svg)

## Production integration

Import `skin` from `src/ui/kit/materials.ts` and import `src/ui/kit/skin.css`.

```ts
skin('ticket', 'pearl')
skin('card', 'jade')
skin('panel', 'night', 'dialogue-skin')
```

```html
<button class="skin-surface skin-button" type="button">
  <!-- Insert skin('button', 'jade') here. -->
  <span>Begin the journey</span>
</button>
```

The decorative SVG must be a direct child of a `skin-surface` parent. All text, icons,
prices, choices, status values and click targets stay in live HTML. SVGs contain no
text and are `aria-hidden`, unfocusable and pointer-inert. Parent layout sets the
surface dimensions; SVG art stretches to the parent and border strokes keep their
screen thickness through `vector-effect="non-scaling-stroke"`.

Use `skin-button`, `skin-nav`, `skin-card`, `skin-panel`, `skin-banner`, `skin-ribbon`
or `skin-medallion` for padding and interaction defaults. Add `skin-pearl`,
`skin-jade` or `skin-night` if explicit foreground color is required; modern browsers
also derive the text tone from the direct child SVG. Do not layer a rectangular
background, browser border or rounded box shadow behind a skin. Do not put a
backdrop blur or a live turbulence filter on a surface.

## Shapes

| Shape | Native viewBox | Suggested use | HTML content region |
|---|---:|---|---|
| ticket | 640 × 220 | Floating journey links, recruitment navigation | 12–88% width, 24–76% height |
| card | 420 × 560 | Character folios, inventory artefacts, portrait slots | 14–86% width, 16–85% height |
| panel | 960 × 400 | Dialogue shells, full page editorial content | 10–90% width, 20–82% height |
| banner | 620 × 150 | Episode titles, section labels, signed notices | 18–87% width, 27–74% height |
| button | 340 × 112 | Actions, choices, confirm and cancel | 20–84% width, 30–74% height |
| tab | 240 × 112 | Page navigation, side rail selectors | 24–83% width, 36–80% height |
| medallion | 240 × 240 | Portrait seals, currencies, party emblems | Central 54% disc; keep aspect ratio 1:1 |
| ribbon | 900 × 200 | Resource strips, mission summaries, progression bands | 15–86% width, 28–76% height |

Curves are designed to stretch organically; choose a silhouette with an aspect ratio
near its use instead of using the panel everywhere. Safe text regions deliberately
leave room for botanical curls, tide-shaped edges and jewelled tips.

## Material tokens

- Midnight teal `#10252b` — shadows and satin.
- Emerald `#3b8578` — wet jade and celestial light.
- Cream `#eee5cb` — pearl body and dark-surface text.
- Gold `#ccb77c` — metallic engraving and double seams.
- Lilac `#afa5d4` — restrained pearlescent edge interference.
- Ink `#213c3b` — readable live text on pearl.

The unsuffixed eight SVG files use pearl. `*-jade.svg` and `*-night.svg` provide
matching finishes for every silhouette. They can be used as ordinary decorative
images or backgrounds; production inline SVG uses unique IDs per instance.

## Interaction and accessibility

- Buttons and navigation have a minimum 44 CSS-pixel hit target.
- Hover reveals a second reflection and a bright seam; selected navigation uses
  `aria-current="page"`, `aria-pressed="true"` or `is-active`.
- Keyboard focus lights the actual curved outline instead of a rectangular outline.
- Disabled controls keep their skin with lower opacity; they do not become native buttons.
- Motion reduces automatically with `prefers-reduced-motion` or `reduce-motion`.
- Typography uses the app's live Cinzel / Lora / Inter fonts, never bitmap text.

## Rebuild and review

`node tools/art/ui_pack_build.cjs` exports all 24 standalone skins from the production
TypeScript source. It also writes `tokens.json`, `preview.svg`,
`tools/art/ui_pack_review.png` and `tools/art/ui_pack_materials.png`.

Grain is a static vector pattern. Highlights use gradients, not blur or turbulence
filters, so the craft remains practical on mobile browsers.
