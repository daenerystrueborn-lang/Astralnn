// Asset manifest validation — every entry must be well-formed and every
// registered path must exist under public/. See ART_DIRECTION.md §9.

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import manifestRaw from '../src/data/manifest.json'

interface ManifestEntry {
  path?: string
  size?: [number, number]
  frame?: [number, number]
  license: string
  source: string
  replaces?: string
  placeholder?: boolean
  animations?: Record<string, { frames: number; fps: number }>
}

interface Manifest {
  version: number
  assets: Record<string, ManifestEntry>
}

const manifest = manifestRaw as unknown as Manifest

describe('asset manifest (ART_DIRECTION.md §9)', () => {
  it('has the current schema version and an assets map', () => {
    expect(manifest.version).toBe(1)
    expect(typeof manifest.assets).toBe('object')
    expect(manifest.assets).not.toBeNull()
  })

  it('every entry carries license + source (no unprovenanced files)', () => {
    for (const [id, entry] of Object.entries(manifest.assets)) {
      expect(id, `entry ${id} must be id-shaped (snake_case segments)`).toMatch(/^[a-z0-9_]+(\/[a-z0-9_]+)+$/)
      expect(entry.license, `${id} missing license`).toBeTruthy()
      expect(entry.source, `${id} missing source`).toBeTruthy()
    }
  })

  it('every registered path exists under public/', () => {
    for (const [id, entry] of Object.entries(manifest.assets)) {
      if (!entry.path) continue
      const abs = resolve(__dirname, '..', 'public', entry.path.replace(/^assets\//, 'assets/'))
      expect(existsSync(abs), `${id} → ${entry.path} does not exist`).toBe(true)
    }
  })

  it('sprite-sheet entries declare frame size and animations', () => {
    for (const [id, entry] of Object.entries(manifest.assets)) {
      if (!entry.animations) continue
      expect(entry.frame, `${id} has animations but no frame size`).toBeTruthy()
      expect(Object.keys(entry.animations).length).toBeGreaterThan(0)
      for (const [name, anim] of Object.entries(entry.animations)) {
        expect(anim.frames, `${id}.${name} frames`).toBeGreaterThan(0)
        expect(anim.fps, `${id}.${name} fps`).toBeGreaterThan(0)
      }
    }
  })

  it('registry file exists and covers the fonts row', () => {
    const registry = readFileSync(resolve(__dirname, '..', 'docs', 'asset-licenses.md'), 'utf8')
    expect(registry).toContain('cinzel.woff2')
    expect(registry).toContain('unverified')
  })
})

describe('asset helpers (src/ui/icon)', () => {
  it('iconOr returns an <img> for registered ids and the emoji fallback otherwise', async () => {
    const { iconOr, assetSrc, hasAsset } = await import('../src/ui/icon')
    expect(hasAsset('icons/coin_crown')).toBe(true)
    expect(assetSrc('icons/coin_crown')).toBe('/assets/icons/coin_crown.png')
    expect(iconOr('icons/coin_crown', '☀️')).toContain('<img class="i"')
    expect(iconOr('icons/not_a_real_icon', '☀️')).toBe('☀️')
  })

  it('monsterOr serves specific art, then elemental fallback, then emoji', async () => {
    const { monsterOr, hasAsset } = await import('../src/ui/icon')
    // 1. specific zone art
    expect(hasAsset('monsters/nh_dust_rat')).toBe(true)
    expect(monsterOr('nh_dust_rat', '🐀')).toContain('<img class="monster-portrait"')
    // 2. elemental fallback for unregistered big-pool monsters
    expect(hasAsset('monsters/elem_flame')).toBe(true)
    expect(monsterOr('ent_grim_gargoyle', '🐀', 'fire')).toContain('elem_flame') // alias
    expect(monsterOr('some_pool_monster', '👾', 'void')).toContain('elem_void')
    // 3. every data element has a fallback portrait now…
    expect(monsterOr('x_unknown', '👾', 'blood')).toContain('elem_blood')
    expect(monsterOr('x_unknown', '👾', 'water')).toContain('elem_water')
    // …but unknown/absent elements still degrade to emoji
    expect(monsterOr('x_unknown', '👾', 'banana')).toBe('👾')
    expect(monsterOr('x_unknown', '👾')).toBe('👾')
    // specific art still wins over element (incl. Season 01 Ruins + Stormpeak bosses)
    expect(monsterOr('nh_hollow_gatekeeper', '🗝️', 'void')).toContain('nh_hollow_gatekeeper')
    expect(monsterOr('the_last_prayer', '🕯️', 'flame')).toContain('the_last_prayer')
    expect(monsterOr('boss_storm_100', '⚡', 'storm')).toContain('boss_storm_100')
  })

  it('every class maps to an owned battler sheet with an idle animation', async () => {
    const { CLASS_BATTLER, classBattler } = await import('../src/ui/icon')
    const { classes } = await import('../src/data/index')
    for (const classId of Object.keys(classes)) {
      expect(CLASS_BATTLER[classId], `class ${classId} needs a battler mapping`).toBeTruthy()
      const html = classBattler(classId)
      expect(html, `class ${classId} battler must render`).toContain('class="battler"')
      expect(html).toContain('characters/')
      expect(html).toContain('idle.png')
    }
    expect(classBattler('unknown_class')).toBe('')
  })
})
