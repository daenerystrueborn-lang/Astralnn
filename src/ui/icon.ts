// Manifest-driven asset helpers (ART_DIRECTION.md §9/§11).
// UI never hard-codes asset paths — it asks for a manifest id, and falls
// back to the placeholder emoji when the id isn't registered yet.

import manifestRaw from '../data/manifest.json'

interface ManifestEntry {
  path?: string
  size?: [number, number]
  frame?: [number, number]
  license: string
  source: string
  replaces?: string
  placeholder?: boolean
  animations?: Record<string, { frames: number; fps: number; sprite?: [number, number] }>
}

const manifest = manifestRaw as unknown as { version: number; assets: Record<string, ManifestEntry> }

/** Public URL for a manifest id, or null when unregistered. */
export function assetSrc(id: string): string | null {
  const entry = manifest.assets[id]
  if (!entry?.path) return null
  return '/' + entry.path.replace(/^\.?\//, '')
}

/** True when the manifest registers this id (used by tests/audit). */
export function hasAsset(id: string): boolean {
  return Boolean(manifest.assets[id]?.path)
}

/**
 * Inline <img> for a manifest id. Returns '' when unregistered so callers
 * can render their emoji fallback instead:
 *   iconOr('icons/coin_crown', '☀️')
 */
export function iconOr(id: string, fallbackEmoji: string, alt = ''): string {
  const src = assetSrc(id)
  if (!src) return fallbackEmoji
  return `<img class="i" src="${src}" alt="${alt || id}" draggable="false" />`
}

/**
 * Monster portrait for a battle enemy: generated art when the manifest
 * registers `monsters/<id>` (see docs/asset-licenses.md intake log),
 * emoji fallback otherwise (all zones beyond Newcomer's Hollow today).
 */
export function monsterOr(monsterId: string, fallbackEmoji: string): string {
  const src = assetSrc(`monsters/${monsterId}`)
  if (!src) return fallbackEmoji
  return `<img class="monster-portrait" src="${src}" alt="" draggable="false" />`
}

// ── Battlers ───────────────────────────────────────────────────────────────

/** Class → owned battler sheet (V0 stand-in mapping; see ART_DIRECTION §7). */
export const CLASS_BATTLER: Record<string, string> = {
  warrior: 'samurai',
  samurai: 'samurai_commander',
  knight: 'samurai_commander',
  berserker: 'ninja_monk',
  cleric: 'ninja_monk',
  assassin: 'kunoichi',
  duelist: 'kunoichi',
  rogue: 'ninja_peasant',
  mage: 'ninja_peasant',
}

export interface BattlerOptions {
  animation?: string
  /** Display scale multiplier (1 = native frame size). */
  scale?: number
}

/**
 * Animated pixel battler for a class, or '' when no sheet is registered —
 * callers keep their emoji fallback. Reads frame/fps from the manifest so
 * code never hard-codes strip geometry.
 */
export function classBattler(classId: string, opts: BattlerOptions = {}): string {
  const sheetId = CLASS_BATTLER[classId]
  if (!sheetId) return ''
  const entry = manifest.assets[`characters/${sheetId}/sheets`]
  const anim = opts.animation ?? 'idle'
  const animData = entry?.animations?.[anim]
  // Sheet entries register the DIRECTORY; per-animation files live inside it.
  const dir = assetSrc(`characters/${sheetId}/sheets`)
  const src = dir ? `${dir}${anim}.png` : null
  if (!entry?.frame || !animData || !src) return ''
  const [fw, fh] = entry.frame
  const scale = opts.scale ?? 1
  return (
    `<span class="battler" role="img" aria-label="${classId} ${anim}" ` +
    `style="--fw:${fw}px;--fh:${fh}px;--frames:${animData.frames};` +
    `--dur:${(animData.frames / animData.fps).toFixed(3)}s;--scale:${scale}">` +
    `<img src="${src}" alt="" draggable="false" /></span>`
  )
}
