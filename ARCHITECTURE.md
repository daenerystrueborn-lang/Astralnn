# ARCHITECTURE — technical foundation (plan step 5)

The V0 shell is a **DOM-first TypeScript game** ported from the Astral bot's
gaming logic. This document is the structural contract: layers, data flow,
persistence, determinism, testing, and the recipes for extending each part.
`tests/architecture.test.ts` enforces the dependency rules mechanically —
convention here is compiled, not aspirational.

Companions: `GAME_SPEC.md` (what to build), `WIREFRAMES.md` (where screens
go), `ART_DIRECTION.md` (how it looks), `BOT_LOGIC_PORT_NOTES.md` (parity
ledger vs the bot).

---

## 1. Layer model

```
        ┌────────────────────────────────────────────┐
  UI    │  src/ui/**   screens (render fn per screen)│  DOM, events, alerts
        │  app.ts = router + guards (G1–G5)          │  dynamic-imports screens
        │  icon.ts  = manifest asset helpers          │
        ├────────────────────────────────────────────┤
  STATE │  src/state/** single-writer GameStore       │  save/load/export/import
        │  player.ts (shape + SAVE_SCHEMA_VERSION)   │  notify → re-render
        │  skill-slots.ts                            │
        ├────────────────────────────────────────────┤
  ENGINE│  src/engine/** pure game logic              │  no DOM, no storage
        │  rng injected (mulberry32 / defaultRng)    │  bot-parity formulas
        ├────────────────────────────────────────────┤
  DATA  │  src/data/** raw JSON + derived indexes    │  immutable inputs
        │  types.ts · index.ts · manifest.json       │  (66 chars, 1027 skills…)
        └────────────────────────────────────────────┘
```

**Dependency rule (enforced):** arrows point down only.

| Layer | May import | Must never import |
|-------|-----------|--------------------|
| `data` | itself (relative), JSON | engine, state, ui |
| `engine` | `./` (engines), `../data` | state, ui, DOM, storage |
| `state` | `./` (state), `../data`, `../engine` | ui |
| `ui` | everything below + `./app`, `./icon` | other screens (static) |
| `main.ts` | `./ui/app`, `./ui/styles.css` | — (entry only) |

Additional rules:
- **Static `ui → ui` imports** are limited to `app.ts` (context/router) and
  `icon.ts` (asset helpers). Screens share nothing else directly — they
  communicate through `UiContext` + the store.
- **Dynamic imports of screens** (ui layer) exist only in `ui/app.ts` —
  that's the code-split router. Lazy imports of *lower* layers are allowed
  anywhere (e.g. hub lazily pulls `engine/xp` to keep startup light).
- **`localStorage` / `sessionStorage`** appear only in `state/store.ts`.
  Tests inject `MemoryStorage`; sandboxed iframes fall back to memory.

## 2. Module inventory

| Layer | Modules | Responsibility |
|-------|---------|----------------|
| data | `raw/*.json` (13) | bot exports: classes, races, skills, monsters, locations, xp, gear, quests, banners… |
| data | `index.ts` | derived maps (`skillMap`, `gearMap`, `characterMap`, …) |
| data | `manifest.json` | asset registry (schema §9 of ART_DIRECTION) |
| engine | `rng` | mulberry32 seed stream, `defaultRng`, `roundGems` |
| engine | `stats`, `combat`, `matchup` | total stats, damage product, 18×18 chart |
| engine | `xp`, `progression` | xpForLevel, level-ups, ranks, stat points |
| engine | `battle` | full turn loop (bot's `combat-engine.js` port) |
| engine | `equipment`, `gacha`, `quests`, `tutorial`, `daily` | subsystem logic, seeded where the bot seeds |
| state | `player.ts` | Player shape, factory, `SAVE_SCHEMA_VERSION = 1` (version constant lives here) |
| state | `store.ts` | single writer, persistence, migration chain |
| state | `skill-slots.ts` | 7-slot equip rules, neutral auto-fill |
| ui | `app.ts` | `ScreenId`, `UiContext`, guards, dynamic router |
| ui | `register…settings` (12) | one render fn each, rebuild DOM per navigation |
| ui | `icon.ts` | manifest lookups, `iconOr`, `classBattler` |

## 3. Data flow (single writer)

```
 event (click) → ctx.store.update(player => mutate)
                        │
                        ├─ save()  → storage (every mutation)
                        └─ notify() → listeners → screen re-render
 navigation: ctx.navigate(screen) → guards → dynamic import → render(root)
```

- **One writer:** no screen mutates `player` directly; every change runs
  through `GameStore.update()`, so the save can never race a second writer.
- **Screens are stateless renders:** `render(root, ctx)` rebuilds their DOM
  from `store.getState()`. UI-local state (picked floor, open panel) lives
  in closures inside the render call — it dies on navigation by design.
- **`UiContext`** carries `store`, `navigate`, `lastResult`, `battleLog`
  (battle log survives re-renders within a battle; cleared on entry).

## 4. Persistence

```
SaveFile { schemaVersion: 1, savedAt, player }  under key 'astral-fantasy-save'
```

- **Load:** `JSON.parse → migrateSave → GameStore.player`. Migration runs
  the chain from the file's `schemaVersion` to `SAVE_SCHEMA_VERSION`; a
  file from the *future* (`> current`) is rejected (import → error alert).
- **Migration stub:** `migratePlayer(player, fromVersion)` is a no-op at v1;
  v1→v2 transforms go there, in order, then the version constant bumps.
  Rule: **schema bump + migration step + state test travel together.**
- **Export / Settings** writes the same `SaveFile` JSON (portable across
  devices); **Import** validates through `migrateSave` and re-saves.
- **Reset** removes the key → guards send the player to `register` (G5).
- Round-trip guarantee (spec §4): save → reload → identical state; covered
  in `state.test.ts` and the `ui.test.ts` end-to-end reload step.

## 5. RNG & determinism

- Gameplay randomness takes an **injected `rng: () => number`**; tests pass
  `mulberry32(seed)` and replay exactly (gacha, duels, battle variance).
- `defaultRng = Math.random` for live play — matches the bot's behavior.
- Known non-gameplay exception: id generation in `player.ts` (not seeded,
  never asserted).
- Quest daily draws use the bot's xorshift32 + Fisher-Yates (seeded by
  calendar day) — deterministic per day for everyone.

## 6. Router

- `ScreenId` union (12) — `app.ts` is the only place that maps ids to
  render functions.
- **Guards G1–G5** run before every render (table in `WIREFRAMES.md` §2):
  no-save → register, save → off-register → hub, active battle → battle,
  stale battle → hub, post-reset → register.
- Screens are **dynamic imports** → per-screen code splitting; the shell
  (`app.ts` + store) is the only eager graph besides styles.

## 7. Testing strategy

| Tier | Where | What it proves |
|------|-------|----------------|
| Parity fixtures | `combat`, `xp`, `progression`, `matchup`, `gacha`… tests | bot math reproduced (numbers from BOT_LOGIC_PORT_NOTES) |
| Engine unit | `equipment`, `quests`, `tutorial`, `daily`, `stats` | subsystem rules incl. V0 adaptations |
| State | `state.test.ts` | single-writer, export/import, migration, reset |
| Contract | `manifest.test.ts`, `journeys.test.ts`, `architecture.test.ts` | docs ↔ code sync (assets, navigation, layers) |
| E2E (happy-dom) | `ui.test.ts` | register → battle → results → reload; tutorial; quests; import/export |

Run: `npm test` (vitest), `npm run build` (`tsc --noEmit` + vite).
**No gameplay test may depend on wall-clock or unseeded randomness.**

## 8. Tooling & budgets

- **Vite 6 + TS + vitest**, React-free DOM rendering; `phaser` dependency
  retained but unused in V0 (spec §: revisit for V1 action scenes).
- Dev server: `npm run dev` binds `0.0.0.0`, `allowedHosts: true` (preview
  proxies need it).
- **Asset budget:** `public/assets` ≤ 6 MB (ART_DIRECTION §9); intake via
  the manifest pipeline — never ship a file the registry doesn't list.
- Ship gate: registry rows must reach `verified` provenance (see
  `docs/asset-licenses.md`).

## 9. Extension recipes

**Add a screen (V1: story, market…):**
1. Add to `ScreenId` + switch in `app.ts` (dynamic import)
2. Write `ui/<name>.ts` (`render(root, ctx)`)
3. Add tab/edge + wireframe in `WIREFRAMES.md` → `journeys.test.ts` passes
4. Guards if the screen must not be reachable in some state

**Add an engine feature:**
1. New `engine/<feature>.ts` — pure, data-only imports, rng injected
2. Parity fixture test against the bot source
3. Wire through `store.update` from the screen; never read storage/DOM

**Change the save shape:**
1. Bump `SAVE_SCHEMA_VERSION`, write the step in `migratePlayer`
2. State test: old fixture → migrated shape
3. Update export/import docs in Settings copy if user-visible

**Replace a placeholder asset:** point the manifest entry (§9 pipeline in
ART_DIRECTION) → `npx vitest run tests/manifest.test.ts` → spot-check →
commit. UI code must not change (helpers resolve through the manifest).

## 10. Acceptance

- [x] Layer rules written and enforced (`tests/architecture.test.ts`)
- [x] Single-writer store; storage confined to `store.ts`
- [x] Versioned save + migration stub + export/import
- [x] Seeded RNG for all gameplay randomness
- [x] Router = guards + dynamic screens; screens share only via context
- [x] Test pyramid documented; contract tests cover the three docs
- [x] Extension recipes for screens / engines / schema / assets
