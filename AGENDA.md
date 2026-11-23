# BUILD AGENDA — block & pixel games

Working doc for **Astral Dungeon · The Bell Below** (this repo) and for any block/pixel game after it.

How to use it: work **top to bottom, one phase at a time**. Tick boxes as you go. Do not start Phase 3
while Phase 1 is still "nearly fun". Every line below exists because skipping it is the usual reason
hobby games die at 80%.

---

## 0. Research first — what the sources actually agree on

Seven findings, in the order they change your decisions:

1. **Scope is the whole game.** One genre, one core loop in one sentence, one win condition, one
   5–15 minute session. Write that down *before* any code or art. ([gamineai](https://gamineai.com/blog/how-to-create-pixel-art-game-with-ai-step-by-step), [unity](https://unity.com/blog/one-page-game-design-document))
2. **Lock the art grid, never mix tile sizes.** 16 or 32 px tiles, one character footprint
   (1 tile wide × 2 tall is the jam default), one design resolution (e.g. 320×180 / 480×270),
   nearest-neighbour scaling. Pixel games die when camera scale and sprite scale disagree.
   ([sorceress.games](https://sorceress.games/blog/forge-how-to-make-a-pixel-art-game-browser-slice))
3. **8–16 colours for a first slice.** 32×32 is the default character cell for indie work; a style
   sheet (grid + palette + outline rule + light direction) beats raw drawing talent.
   ([gtstu](https://gtstu.com/pixel-art-indie-game-beginner-guide/), [sorceress 32×32](https://sorceress.games/blog/size-an-image-to-pixel-art-32x32-game-sprite-pack-2026))
4. **Fun is proven with placeholder art.** If the loop is not fun with grey boxes, polish cannot save
   it. Prototype → vertical slice → content → polish, in that order.
   ([strayspark](https://www.strayspark.studio/blog/game-design-document-template-indie-developers-2026))
5. **One page of design beats a 50-page GDD.** Pitch, loop, out-of-scope, art direction, release.
   Update it weekly; a GDD that doesn't match the build is worse than none.
   ([ziva](https://ziva.sh/blogs/game-design-document), [pixelfork](https://pixelfork.ai/blog/posts/game-design-document-template))
6. **Block/voxel games have one hard part: the mesh.** Never one cube per block. Bounded world
   (~32³), per-chunk surface-only mesh, face culling first then greedy meshing (10–50× faster),
   chunk deltas for saves. Mining/placing/hotbar/crafting are easy *after* that. ([summerengine](https://www.summerengine.com/blog/make-a-game-like-minecraft), [sdlc](https://sdlccorp.com/post/how-to-develop-a-game-like-minecraft/))
7. **Ship state = boring checklist.** Title screen, core loop, win, lose, sound, restart path,
   progress save, shareable build. Realistic first-game timeline: **2–6 weeks part-time** if scope stays tiny.

> Verdict: your repo is already a *good genre pick* (single-screen-ish top-down room dungeon, 5–15 min
> run, one win condition). The agenda below is therefore mostly **tightening**, not restarting.

---

## 1. Lock the contract (30 minutes, before touching code)

Fill this in and keep it at the top of this file. This is the whole GDD.

```
PITCH        A star-built guide walks four rooms under an observatory to break a
             thirteenth bell before sunrise.
CORE LOOP    step to object -> resolve (fight / loot / door) -> spend (shop, potions) -> next room
WIN          clear room 4 (Bellkeeper)
LOSE         HP hits 0 -> full-health retry, keep gold
SESSION      8–12 minutes, one sitting, mobile-first
PILLARS      1) readable at 32px  2) one thumb  3) every room teaches one rule
OUT OF SCOPE procedural dungeons · multiplayer · crafting trees · inventory grids ·
             more than 3 heroes · dialogue trees · stamina/hunger systems · 3D
```

- [ ] Contract written and pasted above
- [ ] Out-of-scope list has at least 5 items (if nothing is cut, scope is not real)
- [ ] Each of the 3 pillars maps to a testable check in §6

---

## 2. Art contract for pixel work

Your sprites are procedural SVG on a `0 0 32 32` viewBox with `shape-rendering="crispEdges"` —
that is already a pixel grid, so treat it as one:

| Rule | Value | Status in repo |
|---|---|---|
| Sprite grid | 32×32 units, integer `translate` only | ✅ `art.js` |
| Tile size | 32 (isometric diamond = 28×14) | ✅ `roomArt()` |
| Palette | target **12–16** colours total | ❌ **49 unique hex values** |
| Outline | single dark tone `#202538` | ✅ `t = #202538` |
| Light direction | top-left, fixed | ⚠️ mostly, some props unshaded |
| Scaler | integer only, no smoothing | ✅ SVG |
| Motion | `steps()` timing, ≤ 4 frames | ✅ `steps(3)` hit flash |

Actions:
- [ ] Keep a palette table in this file (or `palette.css`) — max 16 hex values, name each one
      (`ink`, `stone`, `gold`, `ice`, `skin`, `danger`, …)
- [ ] Map all 49 existing colours down: pick the 16 nearest, delete the rest, re-render every sprite
- [ ] Add a `?debug=grid` overlay that draws the 32px grid + palette swatches (2 lines of CSS)
- [ ] Preview every sprite at 1× and 4× on the same screen before adding a new one

Fast palette rule if you get stuck: pick a Lospec palette (Endesga 32, PICO-8, or a 12-colour
Game Boy-ish set) and refuse to invent a colour outside it.

---

## 3. Build order (the actual agenda)

Estimates assume part-time. Exit criteria are what let you move on.

### Phase 0 — Contract & health (today, ~1h)
- [x] Research pass (this §0)
- [ ] Contract in §1
- [ ] Run `node --check *.js` before every commit (works today, keep it that way)
- [ ] Un-minify: `art.js`, `expedition.js`, `screens.js` are **3 files / 23 lines total**. One-line
      files make diffs unreviewable and bugs invisible. Keep readable source in `src/`, minify only
      into `dist/` if you ever need bytes.
- **Exit:** readable source, contract written, page still loads from `index.html`.

### Phase 1 — Prove the loop is fun (weekend 1)
- [ ] One room, one enemy, one door only — hide the shop and hero select behind a flag
- [ ] Combat feel: hit flash (have it) + 80ms hitstop + screen shake + one click sfx per action
- [ ] Make the "heavy strike incoming" telegraph *visible on the sprite*, not just text
- [ ] Timed self-test: from page load to first fight under 8 seconds, three times in a row
- **Exit:** you play 5 rounds voluntarily without adding a feature.

### Phase 2 — Vertical slice (weekend 2)
- [ ] 3 rooms + boss, all four look/sound like the final game
- [ ] Save/load survives a refresh mid-battle (state, not just room index)
- [ ] Options: sound, music, reduced motion, text size
- [ ] Every screen reachable with keyboard only, one visible focus ring
- **Exit:** a stranger can finish it without you talking.

### Phase 3 — Content, data-driven (week 3)
- [ ] Move `H`, `E`, `rooms`, `story` out of `expedition.js` into `content.json`
      (heroes, enemies, rooms, shop items) — content edits must never touch logic
- [ ] 8 rooms, 3 enemies + elite variants, 1 boss with 2 phases
- [ ] Balance pass via a small table: expected turns-to-kill per enemy at each gear level
- **Exit:** adding a room is a JSON edit + one art id.

### Phase 4 — Juice & clarity (week 4)
- [ ] Screen transitions (200ms), room-enter title cards, damage numbers
- [ ] Death → retry in ≤ 2 taps, no `confirm()` dialogs
- [ ] Replace `confirm()` calls with in-panel confirm screens (iframes/mobile webviews can suppress them)
- [ ] Respect `prefers-reduced-motion` (already partly done ✅)
- **Exit:** every action gives feedback within 100ms.

### Phase 5 — Playtest (week 5)
- [ ] 5 people, you say nothing for the first 3 minutes, take notes on where they hesitate
- [ ] Fix the top 3 confusions only. Log the rest in §7 cut list.
- [ ] Instrument: count deaths per room, potions used, time per room (localStorage → one JSON blob)
- **Exit:** median finish time 8–12 min, room-1 death rate under 40%.

### Phase 6 — Ship (week 6)
- [ ] Title screen, credits, mute, restart, "continue" works after a week away
- [ ] Runs from a static host with no console errors; test at 320px width and 1440px
- [ ] `aria-live` region announces battle results (only the battle note has it today)
- [ ] Shareable build + a 3-screenshot page (itch.io is fine)
- **Exit:** link works on someone else's phone.

---

## 4. Repo audit — concrete findings (2026-11-23)

Read from `index.html`, `art.js`, `expedition.js`, `screens.js`:

**Working well**
- Zero dependencies, one static page — fastest possible iteration loop, and it loads offline.
- State machine is small and complete: `atlas → room → battle → reward|defeat → victory`.
- Save is versioned (`{version:1, game, options}`) — most hobby games skip this and regret it.
- Tap targets already `min-height:44px`; reduced-motion already respected; SVG sprites scale free.
- Combat has real texture: elemental weakness, a 3-turn heavy-strike rhythm, cooldowns, per-hero
  signatures. That is more design than most jam games have.

**Fix these, in this order**
1. **49 colours** → down to 16 (§2). Cheapest visible quality win you have.
2. **One-line files** → readable source. You will otherwise stop being able to change your own game.
3. **Global coupling**: `art.js` reads `g` directly (e.g. `roomArt()` uses `g.room`, `g.x`).
   Pass a view-model argument instead: `roomArt({room, x, y, step, cleared, looted})`. Makes it
   screenshot-testable.
4. **Combat math is inline in `battleAct()`** → extract pure `resolveTurn(state, action) -> {state, log}`.
   Then you can unit-test balance in Node with no DOM.
5. **No save migration** — add `migrate(save)` that upgrades `version:1 → 2` before you add content,
   because Phase 3 will change the shape.
6. **`confirm()` for "replace save" and "retreat"** → in-panel confirm screen (Phase 4).
7. **Music timer keeps ticking in a hidden tab** (`setInterval` survives even though `play()` checks
   `document.hidden`) → clear it on `visibilitychange`.
8. **No focus management**: `draw()` rewrites `innerHTML`, so focus is lost after every action.
   Store the clicked action key and refocus the matching button after render.
9. **Accessibility gap**: battle log uses `aria-live`, but `msg` on the room screen does not.

---

## 5. Separate track — if a project is truly **block/voxel** (Minecraft-like)

Do not mix this with the 2D pixel track above. Order is not optional:

- [ ] 3D first-person controller + mouse look (use a template, don't hand-roll it)
- [ ] Bounded world **32×32×32** stored as a flat `Uint16Array` (16-bit block id)
- [ ] Chunk it (e.g. 16³), mesh **only visible outer faces** — this is step 1 of real work
- [ ] Greedy meshing per chunk (10–50× draw-call reduction); texture atlas, per-face UVs
- [ ] Raycast targeting + break (with progress) + place; rebuild only the touched chunk's mesh
- [ ] 3–4 block types (dirt, stone, wood, glowstone) and a 9-slot hotbar
- [ ] Save = **chunk deltas only** (edits), seed for generation — never full-world dumps
- [ ] One crafting recipe, one night threat, then stop and playtest

Explicitly **not** in v1: infinite terrain, biomes, caves, water, mobs with pathfinding,
multiplayer, shaders. Those are the next game, not this one.

---

## 6. Definition of done (identical for both tracks)

- [ ] Title screen → play → win/lose → restart, no reload needed
- [ ] Sound on/off works and is remembered
- [ ] Save survives refresh, tab close, and a day away
- [ ] Playable one-handed at 320px wide
- [ ] Keyboard-only path through every screen
- [ ] No console errors; no dead ends (every screen has an exit)
- [ ] 5 outside testers finished it or rage-quit in a way you can name
- [ ] Someone other than you has the link

**Playtest script (say only this):** "Play until you're bored or done. Think out loud."
Watch: first 30 seconds, first death, first time they open a menu. Ask after: *What were you trying
to do? What was confusing? Would you play a second run?* Never explain mid-run.

---

## 7. Cut list & risks

| Tempting feature | Decision | Why |
|---|---|---|
| Procedural dungeon layout | **Cut v1** | kills hand-tuned difficulty curve, huge test surface |
| 6 heroes | **Cut** (3 is plenty) | each hero = art + balance + UI copy |
| Inventory grid / drag-drop | **Cut** | hotbar+2 trinkets already reads fine |
| Crafting | **Cut** (2D track) | only earns its place if gathering is the loop |
| Dialogue trees | **Cut** | static notes cost 1% and land 80% as hard |
| Multiplayer | **Cut** | rewrites state, save, and netcode |
| More rooms as filler | **Risk** | 8 designed rooms > 30 generated ones |

| Risk | Mitigation |
|---|---|
| Art stalls the project | 16-colour palette + procedural SVG (already your strength) |
| Files unreadable after a break | un-minify in Phase 0, commit small |
| Balance by vibes | `resolveTurn()` pure function + table in Phase 3 |
| Scope creep at week 3 | re-read §1 out-of-scope before every session |
| Nobody plays it | playtest in week 5, not week 9 |

---

## 8. References

- One-page GDD: [unity.com](https://unity.com/blog/one-page-game-design-document) · [ziva.sh](https://ziva.sh/blogs/game-design-document)
- Milestones & cut rules: [strayspark.studio](https://www.strayspark.studio/blog/game-design-document-template-indie-developers-2026)
- Pixel scope + grid lock: [sorceress.games](https://sorceress.games/blog/forge-how-to-make-a-pixel-art-game-browser-slice)
- Sprite sizes & palettes: [gtstu.com](https://gtstu.com/pixel-art-indie-game-beginner-guide/) · [32×32 pack guide](https://sorceress.games/blog/size-an-image-to-pixel-art-32x32-game-sprite-pack-2026)
- Voxel order of operations: [summerengine.com](https://www.summerengine.com/blog/make-a-game-like-minecraft) · [sdlccorp.com](https://sdlccorp.com/post/how-to-develop-a-game-like-minecraft/)

---

_Next action: §0 tick 1 — write the contract in §1, then Phase 0 un-minify. Nothing else this session._
