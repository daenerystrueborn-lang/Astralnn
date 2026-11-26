// Plan step 5 — ARCHITECTURE.md layer rules, enforced mechanically.
//
// The architecture doc is only worth having if the dependency graph
// actually obeys it: this suite parses every import in src/ and fails
// when a layer reaches across its boundary, when storage leaks out of
// the store, or when the router stops being the only dynamic entry.

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, relative, dirname } from 'path'

const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'src')

function tsFiles(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...tsFiles(p))
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

/** All import specifiers in a file: static `from '…'` + dynamic `import('…')`. */
function specifiers(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) out.push(m[1])
  for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1])
  // bare side-effect imports: import './x.css'
  for (const m of src.matchAll(/import\s+['"]([^'"]+)['"]/g)) out.push(m[1])
  return out
}

function layerOf(file: string): string {
  const rel = relative(SRC, file).split(/[\\/]/)
  return rel.length > 1 ? rel[0] : '(root)'
}

/** Layer the specifier resolves into, or null for non-relative imports. */
function targetLayer(spec: string, file: string): string | null {
  if (!spec.startsWith('.')) return null
  const target = join(dirname(file), spec)
  const rel = relative(SRC, target).split(/[\\/]/)
  return rel[0]
}

/** True when the specifier resolves outside the importing file's own layer. */
function leavesLayer(spec: string, file: string): boolean {
  const tl = targetLayer(spec, file)
  if (tl === null) return false // package imports (none expected in src)
  return tl !== layerOf(file)
}

describe('architecture: layer dependency rules (ARCHITECTURE.md §1)', () => {
  const files = tsFiles(SRC)

  it('src layout matches the documented four layers', () => {
    const layers = new Set(files.map(layerOf))
    for (const l of ['data', 'engine', 'state', 'ui']) {
      expect(layers.has(l), `missing layer src/${l}`).toBe(true)
    }
  })

  it('engine imports only engines + data (no state, no ui)', () => {
    for (const f of files.filter((f) => layerOf(f) === 'engine')) {
      for (const spec of specifiers(readFileSync(f, 'utf8'))) {
        if (!leavesLayer(spec, f)) continue
        expect(
          spec.startsWith('../data') || spec.startsWith('./'),
          `${relative(ROOT, f)} imports ${spec} (engine may reach only ./ and ../data)`,
        ).toBe(true)
      }
    }
  })

  it('state imports only state + data + engine (never ui)', () => {
    for (const f of files.filter((f) => layerOf(f) === 'state')) {
      for (const spec of specifiers(readFileSync(f, 'utf8'))) {
        if (!leavesLayer(spec, f)) continue
        expect(
          spec.startsWith('../data') || spec.startsWith('../engine') || spec.startsWith('./'),
          `${relative(ROOT, f)} imports ${spec} (state must not reach ui)`,
        ).toBe(true)
      }
    }
  })

  it('data imports nothing above itself', () => {
    for (const f of files.filter((f) => layerOf(f) === 'data')) {
      for (const spec of specifiers(readFileSync(f, 'utf8'))) {
        expect(
          leavesLayer(spec, f),
          `${relative(ROOT, f)} imports ${spec} (data layer must stay self-contained)`,
        ).toBe(false)
      }
    }
  })

  it('static ui→ui imports are limited to app.ts and icon.ts', () => {
    const allowed = new Set(['app', 'icon'])
    for (const f of files.filter((f) => layerOf(f) === 'ui')) {
      const src = readFileSync(f, 'utf8')
      // Static imports only — every `from '…'`; dynamic import() is the
      // router's privilege (checked in the next test).
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]
        if (targetLayer(spec, f) !== 'ui') continue // ui→state/engine/data is fine
        const target = spec.split('/').pop()!.replace(/\.ts$/, '')
        expect(
          allowed.has(target),
          `${relative(ROOT, f)} statically imports ${spec} — screens may only import ./app and ./icon`,
        ).toBe(true)
      }
    }
  })

  it('dynamic screen (ui-layer) imports live only in app.ts', () => {
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      const isRouter = f.replace(/\\/g, '/').endsWith('src/ui/app.ts')
      for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const spec = m[1]
        // Lazy imports of lower layers (hub → engine/xp) are fine; only
        // screen code-splitting is the router's privilege.
        if (targetLayer(spec, f) !== 'ui') continue
        expect(
          isRouter,
          `${relative(ROOT, f)} dynamically imports ${spec} — only ui/app.ts may code-split screens`,
        ).toBe(true)
      }
    }
  })
})

describe('architecture: persistence + determinism (ARCHITECTURE.md §4–5)', () => {
  it('localStorage/sessionStorage appear only in state/store.ts', () => {
    for (const f of tsFiles(SRC)) {
      const src = readFileSync(f, 'utf8')
      if (!/local[Ss]ession|localStorage|sessionStorage/.test(src)) continue
      expect(
        f.replace(/\\/g, '/').endsWith('src/state/store.ts'),
        `${relative(ROOT, f)} touches web storage — only state/store.ts may`,
      ).toBe(true)
    }
  })

  it('SAVE_SCHEMA_VERSION stays in lockstep with the docs', async () => {
    const { SAVE_SCHEMA_VERSION } = await import('../src/state/player')
    expect(SAVE_SCHEMA_VERSION).toBe(1)
    const arch = readFileSync(join(ROOT, 'ARCHITECTURE.md'), 'utf8')
    expect(arch).toContain('SAVE_SCHEMA_VERSION = 1')
    const spec = readFileSync(join(ROOT, 'GAME_SPEC.md'), 'utf8')
    expect(spec).toContain('versioned schema')
  })

  it('GameStore is the single mutation entry point (update/save/export)', async () => {
    const storeSrc = readFileSync(join(ROOT, 'src/state/store.ts'), 'utf8')
    expect(storeSrc).toContain('single-writer')
    // screens must not write the storage key directly
    for (const f of tsFiles(join(SRC, 'ui'))) {
      expect(
        readFileSync(f, 'utf8'),
        `${relative(ROOT, f)} references the save key`,
      ).not.toContain('astral-fantasy-save')
    }
  })
})
