// Kill rewards — port of lib/xp-regulator.js (the single source of truth for
// regular-monster XP/solars) plus survivalKillXp from lib/survival-progression.js.
// The bot explicitly IGNORES monsters.json's own rewards fields for regulars.

import { levelsData, locationMap } from '../data'

// ── Tier pacing (xp-regulator.js) ──────────────────────────────────────────

/** % of the next level's XP gap a single kill awards, by depth tier. */
const TIER_PCT: Record<string, number> = {
  weak: 0.015,    // ~67 kills/level grinding weak mobs
  medium: 0.0375, // ~27 kills/level
  strong: 0.075,  // ~13 kills/level
  boss: 0.20,     // a milestone, not a full level
}
const ELITE_MULT = 2.5
const SOLARS_PER_XP = 0.35

/**
 * xpForLevel(level) — XP from `level` to `level+1`.
 * At the cap the final step extrapolates from the last real table gap.
 */
export function xpForLevel(level: number): number {
  const cap = levelsData.levelCap ?? 100
  const capped = Math.max(1, Math.min(level, cap))
  const at = (L: number) => levelsData.xpTable[String(L)] ?? null
  const curr = at(capped) ?? 100
  const next = at(capped + 1)
  if (next == null) {
    const prev = at(capped - 1)
    return Math.max(1, prev == null ? curr : curr - prev)
  }
  return Math.max(1, next - curr)
}

/** Linear interpolation of a dungeon's levelRange across its floors. */
export function expectedLevelAtFloor(locationId: string, floor: number): number {
  const loc = locationMap[locationId]
  if (!loc?.levelRange) return 1
  const [lo, hi] = loc.levelRange
  const totalFloors = loc.floors ?? 1
  if (totalFloors <= 1) return lo
  const pct = Math.max(0, Math.min(1, (floor - 1) / (totalFloors - 1)))
  return Math.round(lo + (hi - lo) * pct)
}

/** Depth bands the WHOLE dungeon: weak first 40%, medium next 35%, strong last 25%. */
export function monsterTierAtFloor(locationId: string, floor: number): 'weak' | 'medium' | 'strong' {
  const loc = locationMap[locationId]
  const total = loc?.floors ?? floor
  const pct = total <= 1 ? 1 : Math.max(0, Math.min(1, (floor - 1) / (total - 1)))
  if (pct <= 0.40) return 'weak'
  if (pct <= 0.75) return 'medium'
  return 'strong'
}

/**
 * regulateMonsterXp — the single source of truth for a regular monster's
 * XP/solars. Clamped to [50, 700] XP; solars = 35% of XP.
 */
export function regulateMonsterXp(
  locationId: string,
  floor: number,
  isElite = false,
): { xp: number; solars: number; tier: string } {
  const level = expectedLevelAtFloor(locationId, floor)
  const need = xpForLevel(level)
  const tier = monsterTierAtFloor(locationId, floor)
  let xp = need * TIER_PCT[tier]
  if (isElite) xp *= ELITE_MULT
  xp = Math.max(50, Math.min(700, Math.round(xp)))
  const solars = Math.max(1, Math.round(xp * SOLARS_PER_XP))
  return { xp, solars, tier }
}

// ── Survival progression (survival-progression.js) ─────────────────────────

export function levelGap(level: number): number {
  const n = Math.max(1, Math.min(199, Math.floor(Number(level) || 1)))
  return Math.max(1, Number(levelsData.xpTable[String(n + 1)]) - (n === 1 ? 0 : Number(levelsData.xpTable[String(n)] ?? 0)))
}

export function targetFights(level: number): number {
  return level <= 10 ? 4 : level < 20 ? 10 : level < 40 ? 18 : level < 60 ? 28 : level < 80 ? 40 : 55
}

/**
 * survivalKillXp — what a dungeon kill actually pays (the path creditKill
 * takes for ordinary dungeon regulars): sized as a fraction of the level gap
 * divided by the fights that gap should take, with an obsolescence factor
 * when the player has out-levelled the zone.
 */
export function survivalKillXp(
  level: number,
  expectedLevel: number,
  { boss = false, elite = false }: { boss?: boolean; elite?: boolean } = {},
): number {
  const band = Math.max(1, Math.min(Number(level) || 1, Number(expectedLevel) || 1))
  const gap = Math.max(0, level - expectedLevel)
  const obsolete = gap <= 5 ? 1 : gap <= 15 ? 0.5 : 0.1
  return Math.max(
    1,
    Math.floor((levelGap(band) / targetFights(band)) * obsolete * (boss ? 5 : elite ? 2 : 1)),
  )
}
