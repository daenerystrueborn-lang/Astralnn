// Plan step 4 — WIREFRAMES.md stays in sync with the router code.
//
// The wireframe doc is the navigation contract: every user-triggered
// edge in src/ui must be enumerated in its edge table, and every
// ScreenId must be documented. Guards (§2) are router-internal and
// excluded from the edge scan.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..')
const doc = readFileSync(join(ROOT, 'WIREFRAMES.md'), 'utf8')

// ScreenIds — mirror of the union in src/ui/app.ts (compile-time check
// below asserts the two stay aligned).
type ScreenId =
  | 'register' | 'hub' | 'battle' | 'results' | 'death'
  | 'roster' | 'spin' | 'inventory' | 'dungeon' | 'quests'
  | 'profile' | 'settings'
const SCREEN_IDS: ScreenId[] = [
  'register', 'hub', 'battle', 'results', 'death',
  'roster', 'spin', 'inventory', 'dungeon', 'quests',
  'profile', 'settings',
]

/** Edge table rows: | # | `from` | `to` | trigger | */
function docEdges(): Array<{ from: string; to: string }> {
  const edges: Array<{ from: string; to: string }> = []
  for (const line of doc.split('\n')) {
    const m = line.match(/^\|\s*\d+\s*\|\s*`([a-z]+)`\s*\|\s*`([a-z]+)`\s*\|/)
    if (m) edges.push({ from: m[1], to: m[2] })
  }
  return edges
}

/** All user-facing navigation targets in the UI sources. */
function codeEdges(): Array<{ file: string; to: string }> {
  const out: Array<{ file: string; to: string }> = []
  const dir = join(ROOT, 'src', 'ui')
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(dir, file), 'utf8')
    for (const m of src.matchAll(/navigate\('([a-z]+)'\)/g)) {
      out.push({ file, to: m[1] })
    }
    for (const m of src.matchAll(/data-nav="([a-z]+)"/g)) {
      out.push({ file, to: m[1] })
    }
  }
  return out
}

describe('WIREFRAMES.md navigation contract (plan step 4)', () => {
  const edges = docEdges()

  it('edge table parses with a substantial edge set', () => {
    expect(edges.length).toBeGreaterThanOrEqual(25)
  })

  it('documents every ScreenId', () => {
    const documented = new Set(edges.flatMap((e) => [e.from, e.to]))
    // register's only edge is 1; death via 11/13 — all must appear.
    for (const id of SCREEN_IDS) {
      expect(documented.has(id), `screen ${id} missing from edge table`).toBe(true)
      expect(doc, `screen ${id} not mentioned in doc`).toContain(`\`${id}\``)
    }
  })

  it('every edge names a real ScreenId, and the local list matches app.ts', () => {
    // Extract the ScreenId union straight from the router source so this
    // file can't drift when screens are added.
    const appSrc = readFileSync(join(ROOT, 'src', 'ui', 'app.ts'), 'utf8')
    const union = appSrc.match(/export type ScreenId =([\s\S]*?)\n\n/)?.[1] ?? ''
    const routerIds = [...union.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(routerIds.sort()).toEqual([...SCREEN_IDS].sort())
    for (const e of edges) {
      expect(SCREEN_IDS, `bad from ${e.from}`).toContain(e.from)
      expect(SCREEN_IDS, `bad to ${e.to}`).toContain(e.to)
    }
  })

  it('every navigate()/data-nav edge in code appears in the table', () => {
    const documented = new Set(edges.map((e) => e.to))
    const missing = codeEdges().filter((e) => !documented.has(e.to))
    expect(
      missing,
      `undocumented navigation: ${missing.map((m) => `${m.file}→${m.to}`).join(', ')}`,
    ).toEqual([])
  })

  it('route guards G1–G5 are documented', () => {
    for (const g of ['G1', 'G2', 'G3', 'G4', 'G5']) {
      expect(doc, `${g} undocumented`).toContain(g)
    }
  })

  it('journeys J1–J9 are documented', () => {
    for (const j of ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7', 'J8', 'J9']) {
      expect(doc, `${j} undocumented`).toContain(j)
    }
  })
})
