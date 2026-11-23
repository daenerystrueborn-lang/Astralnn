# AGENTS.md — build agent command file

Instructions for **any AI model or human collaborator** working in this repository.
This file is the operating contract. `AGENDA.md` is the plan; this file is how you are allowed to
execute it. If the two ever disagree, `AGENDA.md` wins on *what*, this file wins on *how*.

> Paste the block in §9 into a fresh session to put a model on rails immediately.

---

## 1. Read order (before you touch anything)

1. `AGENDA.md` §1 — the locked contract (pitch, loop, win, win condition, out-of-scope)
2. `AGENDA.md` §3 — the phase list; find the **current phase** and its **unmet exit criteria**
3. `AGENDA.md` §7 — the cut list and risks
4. this file, §3–§8

Then state, in one short paragraph, which phase you are in and what the next unmet exit criterion is.
Only then propose a change. If you cannot fill a checkbox in §3, you are not ready to code.

---

## 2. Priority order (resolve every conflict this way)

1. **Do not break a working game.** Beat feature completeness, always.
2. **Agenda order.** Phase *n* exit criteria before phase *n+1* work.
3. **Art contract.** 32 px grid, 16-colour palette, `ink` outline, top-left light.
4. **Scope.** The cut list is binding; a cut feature is not "back" because it was fun to type.
5. **Speed.** Only after 1–4 are satisfied.

Requests that violate 1–4 are answered with: what conflicts, the smallest compliant version,
and a one-line question. Never silently over-scope.

---

## 3. Hard rules — code

- **Readable source only.** No minifying, no bundling, no one-line files. `art.js`,
  `expedition.js`, `screens.js` must stay human-diffable (target: one statement per line).
- **No dependencies, no build step, no framework.** Plain ES2022 browser JS + one HTML file.
  Adding a dependency, bundler, or engine is a stop condition (§7).
- **Keep it a static page.** It must run from `file://` or any static host with no console errors.
- **Pure logic where it can be pure.** Combat/balance goes through
  `resolveTurn(state, action) -> {state, log}`. No DOM access in rules code, ever.
- **No globals reached across files.** Pass view-models in: `roomArt({room, x, y, step, cleared, looted})`.
  A function that reads `g` from another file is a bug, not a shortcut.
- **Banned in new code:** `alert()`, `confirm()`, `prompt()`, `innerHTML` with unescaped user text,
  `setInterval` without a `visibilitychange` cleanup, hard-coded colour literals outside the palette.
- **Required in new code:** keyboard path for every action, focus restored after a re-render,
  `aria-live="polite"` on any message that changes state, `prefers-reduced-motion` respected,
  tap targets ≥ 44 px.
- **Save data is a promise.** Any shape change bumps `version` **and** ships a `migrate(save)` that
  upgrades the old object. Never discard a player's save silently.
- **Comments explain *why*, never *what*.** No TODOs without an owner line: `TODO(phase-3): …`.

---

## 4. Hard rules — art

| Rule | Value |
|---|---|
| Sprite grid | 32 × 32 units, integer `translate`/`scale` only |
| Tile | 32 px (isometric diamond 28 × 14) |
| Palette | the 16 tokens below, nothing else |
| Outline | `ink` `#202538`, 1 unit |
| Light | top-left, one direction for the whole game |
| Motion | `steps()` timing, ≤ 4 frames per action |
| Preview | check every sprite at 1× **and** 4× before committing |

**The 16-colour budget** (Phase 0b collapses the current 49 nearest-match values onto these):

```
night     #111b26   ink       #202538   slate     #344657   stone-dk  #455868
stone     #687777   mist      #c9dfd6   ice       #80dad5   teal      #28a99e
cream     #fff4d8   parchment #e6d3aa   sand      #b3976c   gold      #e8bd68
amber     #d98970   rust      #b86a52   arcane    #8f86cc   skin      #ecc194
```

A new colour is a **contract change**, not a style choice. Ask first; if approved, add it here and
remove another. The count stays 16.

---

## 5. Work loop (every task, no exceptions)

1. **Locate** — which phase, which exit criterion, which file.
2. **Plan** — 1–3 sentences, files touched, risk. If it touches the contract or palette, stop and ask.
3. **Execute small** — one concern per commit; message format `phase-N: what changed`.
4. **Verify** — run the smoke list in §6. Paste the commands and their real output, not a claim.
5. **Tick** — check the boxes in `AGENDA.md` §3 that actually closed, and only those.
6. **Report** — changed / verified / next criterion. Three lines maximum.
7. **Never** mark a phase complete while a criterion is unmet. Partial credit is written as
   "3 of 5", never rounded up to done.

---

## 6. Smoke list (run before claiming anything works)

```bash
for f in *.js; do node --check "$f" || exit 1; done   # syntax gate
grep -o '#[0-9a-fA-F]\{6\}' *.js | tr 'A-F' 'a-f' | sort -u | wc -l   # must be ≤ 16 after Phase 0b
wc -l *.js                                            # sanity: no file back to one line
```

Then in the browser: load with a clean console, new game → first fight < 8 s, win a fight, take a
potion, open+close every screen, refresh mid-battle and confirm the save restores, keyboard-only pass,
320 px width pass.

If you cannot run the browser half, say so explicitly. Do not infer it from the code.

---

## 7. Stop conditions — ask, do not decide

- Editing `AGENDA.md` §1 (the contract) or the palette in §4
- Changing the save `version` shape or removing a migration
- Adding any dependency, build step, engine, or 3D
- Un-cutting anything in `AGENDA.md` §7
- Rewriting a working screen "for cleanliness" with no agenda criterion behind it
- Anything that touches more than ~3 files or 200 lines in one pass

---

## 8. Definition of done (gate for "shippable")

Title → play → win/lose → restart without reload · mute works and is remembered · save survives
refresh and a day away · one-handed at 320 px · keyboard-only path · zero console errors · no dead
ends · 5 outside testers have played it · someone else has the link.

---

## 9. Session command (paste this into a fresh model)

```text
You are the build agent for "Astral Dungeon · The Bell Below" in this repository.

Before writing anything, read AGENDA.md (all of it) and AGENTS.md (all of it).
Then reply with exactly this, and nothing else:
  PHASE: <current phase number and name>
  MET: <exit criteria already satisfied>
  NEXT: <the single next unmet exit criterion>
  RISK: <one thing most likely to waste this session>

Rules, in priority order:
1. Don't break the working game.
2. Finish the current phase's exit criteria before starting the next phase.
3. Art contract: 32px grid, the 16-token palette only, ink outline, top-left light.
4. AGENDA.md §7 cut list is binding; out-of-scope stays out of scope.
5. Readable source, no dependencies/build step, no confirm()/alert(), pure resolveTurn() logic.

Work loop for every task: locate → 3-sentence plan → small commit (phase-N: what changed) →
verify with the §6 smoke list and paste real output → tick the matching AGENDA.md boxes → 3-line report.

Stop and ask before: changing the contract, changing the palette, altering the save format,
adding a dependency, un-cutting a cut feature, or touching more than ~3 files.

Never claim a checkbox is done unless you ran the check. If you can't verify it, say "unverified".
```

---

## 10. File map

| File | Owns | Never does |
|---|---|---|
| `index.html` | shell, CSS, `<script>` order | game logic, art strings |
| `art.js` | sprites, icons, room art, landscape (pure functions of their args) | read/write game state |
| `expedition.js` | state machine, save/migrate, combat rules, audio | build DOM strings |
| `screens.js` | screen rendering, input wiring, focus | mutate rules or save format |
| `content.json` (Phase 3) | heroes, enemies, rooms, shop, story | contain logic |
| `AGENDA.md` | plan, phases, audit, cut list | drift from the actual build |
| `AGENTS.md` | this contract | describe features |
