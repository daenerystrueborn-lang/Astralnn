// Progression — port of lib/stat-progression.js, applyLevelUps() from
// lib/combat-engine.js, and lib/rank-engine.js.
// V0: no reborn, no stat packs, no prestige titles — those hook points are
// noted where the bot adds bonuses we drop to 0.

import { levelsData, classes, races, ranks } from '../data'
import { getTotalStats, STAT_KEYS, type StatKey } from './stats'

export const STAT_POINT_VERSION = 2

export interface StatPointsState {
  version: number
  earned: number
  spent: number
  unallocated: number
  allocations: Record<StatKey, number>
}

/** The player slice progression functions read/mutate. */
export interface ProgressPlayer {
  name: string
  level: number
  xp: number
  classId: string
  raceId: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  stats: Record<StatKey, number> & { wins?: number; losses?: number }
  baseStats: Record<string, number>
  statPoints: StatPointsState
  wallet: Record<string, number>
}

export function emptyAllocations(): Record<StatKey, number> {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>
}

/** Lifetime point ceiling for a level: min(maxStatPoints, level × perLevel). */
export function statPointCap(level: number, player: ProgressPlayer | null = null): number {
  void player // V0: reborn personal ceilings arrive with the reborn system
  const max = levelsData.maxStatPoints ?? 1500
  const perLevel = levelsData.statPointsPerLevel ?? 15
  return Math.min(max, Math.max(0, Math.floor(Number(level) || 0) * perLevel))
}

/**
 * ensureStatPoints — backfill/rebase a save onto the v2 point state without
 * changing current power (same rebase logic as the bot, minus reborn/stat-pack
 * flat bonuses which are 0 in V0).
 */
export function ensureStatPoints(player: ProgressPlayer): StatPointsState {
  const sp = player.statPoints
  if (sp?.version === STAT_POINT_VERSION && Number.isFinite(sp.unallocated)) {
    return sp
  }

  const level = Math.min(levelsData.levelCap, Math.max(1, Number(player.level) || 1))
  const canonical = getTotalStats(player.classId, player.raceId, level)
  const oldBase = player.baseStats ?? (player.stats as Record<string, number>) ?? {}
  const allocations = emptyAllocations()

  for (const key of STAT_KEYS) {
    allocations[key] = Math.max(0, Math.floor(Number(oldBase[key] ?? 0) - Number(canonical[key] ?? 0)))
  }

  const cap = statPointCap(level, player)
  let remaining = cap
  for (const key of STAT_KEYS) {
    allocations[key] = Math.min(allocations[key], remaining)
    remaining -= allocations[key]
  }
  const spent = cap - remaining
  const state: StatPointsState = {
    version: STAT_POINT_VERSION,
    earned: cap,
    spent,
    unallocated: cap - spent,
    allocations,
  }
  player.statPoints = state

  player.baseStats = {
    ...canonical,
    ...Object.fromEntries(
      STAT_KEYS.map((key) => [key, canonical[key] + allocations[key]]),
    ),
    maxHp: canonical.maxHp,
    maxMp: canonical.maxMp,
  }
  for (const key of STAT_KEYS) {
    const gearDelta = Number(player.stats?.[key] ?? 0) - Number(oldBase[key] ?? 0)
    player.stats[key] = canonical[key] + allocations[key] + gearDelta
  }
  const hpGearDelta = Number(player.maxHp ?? 0) - Number(oldBase.maxHp ?? 0)
  const mpGearDelta = Number(player.maxMp ?? 0) - Number(oldBase.maxMp ?? 0)
  player.maxHp = canonical.maxHp + hpGearDelta
  player.maxMp = canonical.maxMp + mpGearDelta
  player.hp = Math.min(Number(player.hp ?? 0), player.maxHp)
  player.mp = Math.min(Number(player.mp ?? 0), player.maxMp)
  return state
}

/** Grant the points earned between two levels (usually level N−1 → N). */
export function grantLevelStatPoints(
  player: ProgressPlayer,
  previousLevel: number,
  nextLevel: number,
): number {
  const state = ensureStatPoints(player)
  const added = Math.max(0, statPointCap(nextLevel, player) - statPointCap(previousLevel, player))
  const room = Math.max(0, statPointCap(nextLevel, player) - state.earned)
  const granted = Math.min(added, room)
  state.earned += granted
  state.unallocated += granted
  return granted
}

/** Spend unallocated points into baseStats + stats. */
export function addAllocation(
  player: ProgressPlayer,
  stat: string,
  amount: number,
): { ok: boolean; error?: string; points?: number; stat?: string; remaining?: number; available?: number } {
  const state = ensureStatPoints(player)
  const key = String(stat).toLowerCase()
  const points = Math.floor(Number(amount))
  if (!(STAT_KEYS as string[]).includes(key) || !Number.isFinite(points) || points <= 0) {
    return { ok: false, error: 'invalid' }
  }
  if (points > state.unallocated) {
    return { ok: false, error: 'not_enough', available: state.unallocated }
  }

  state.unallocated -= points
  state.spent += points
  state.allocations[key as StatKey] += points
  player.baseStats[key] = Number(player.baseStats[key] ?? 0) + points
  player.stats[key as StatKey] = Number(player.stats[key as StatKey] ?? 0) + points
  return { ok: true, points, stat: key, remaining: state.unallocated }
}

/** Training price per point: baseCost + level × costPerLevel (min 1). */
export function trainCostPerPoint(level: number): number {
  const training = levelsData.statTraining ?? { baseCostPerPoint: 100, costPerLevel: 25 }
  return Math.max(
    1,
    Math.floor(
      (training.baseCostPerPoint ?? 100) +
        (Math.max(1, Number(level) || 1) * (training.costPerLevel ?? 25)),
    ),
  )
}

/** Buy stat points with Solars, room-limited to the level's cap. */
export function trainPlayer(
  player: ProgressPlayer,
  amount: number,
): { ok: boolean; error?: string; points?: number; cost?: number; have?: number; cap?: number; remaining?: number } {
  const state = ensureStatPoints(player)
  const cap = statPointCap(player.level, player)
  const room = Math.max(0, cap - state.earned)
  const points = Math.floor(Number(amount))
  if (!Number.isFinite(points) || points <= 0) return { ok: false, error: 'invalid' }
  if (room <= 0) return { ok: false, error: 'full', cap }

  const granted = Math.min(points, room)
  const cost = granted * trainCostPerPoint(player.level)
  const wallet = player.wallet ?? (player.wallet = {})
  if ((wallet.solars ?? 0) < cost) {
    return { ok: false, error: 'poor', cost, have: wallet.solars ?? 0, points: granted }
  }

  wallet.solars -= cost
  state.earned += granted
  state.unallocated += granted
  return { ok: true, points: granted, cost, remaining: state.unallocated }
}

export interface LevelUpResult {
  player: ProgressPlayer
  msgs: string[]
  levelled: boolean
}

/**
 * applyLevelUps — exact port of the bot's loop:
 * hit level N the moment xp >= xpTable[N]; stat deltas from getTotalStats
 * diffs; baseStats rebuilt from class+race+level+allocations (the anchor
 * that prevents stat doubling); full heal; points granted per level.
 * V0: reborn cap (200), reborn/stat-pack bonuses and fairy MP floor are out.
 */
export function applyLevelUps(player: ProgressPlayer): LevelUpResult {
  const msgs: string[] = []
  const cap = levelsData.levelCap ?? 100
  let levelled = false
  ensureStatPoints(player)

  while (player.level < cap) {
    const next = player.level + 1
    const needed = levelsData.xpTable[String(next)]
    if (needed == null || player.xp < needed) break

    const oldStats = getTotalStats(player.classId, player.raceId, player.level)
    const newStats = getTotalStats(player.classId, player.raceId, next)
    for (const k of STAT_KEYS) {
      player.stats[k] = (player.stats[k] ?? 0) + (newStats[k] - oldStats[k])
    }
    player.maxHp += newStats.maxHp - oldStats.maxHp
    player.maxMp += newStats.maxMp - oldStats.maxMp
    player.hp = player.maxHp
    player.mp = player.maxMp

    player.baseStats = {
      str: newStats.str + (player.statPoints.allocations.str ?? 0),
      agi: newStats.agi + (player.statPoints.allocations.agi ?? 0),
      int: newStats.int + (player.statPoints.allocations.int ?? 0),
      def: newStats.def + (player.statPoints.allocations.def ?? 0),
      lck: newStats.lck + (player.statPoints.allocations.lck ?? 0),
      maxHp: newStats.maxHp,
      maxMp: newStats.maxMp,
    }
    player.hp = player.maxHp
    player.mp = player.maxMp

    player.level = next
    const granted = grantLevelStatPoints(player, next - 1, next)
    levelled = true
    msgs.push(
      `🎉 LEVEL UP! ${player.name} is now Level ${next}! ` +
        `+${granted} stat points available (${player.statPoints.unallocated} unallocated) ` +
        `❤️ HP: ${player.maxHp} 💧 MP: ${player.maxMp}`,
    )
  }
  return { player, msgs, levelled }
}

// ── Ranks (lib/rank-engine.js) ──────────────────────────────────────────────

/** The rank tier a level falls in (E-Rank Hunter → Shadow Sovereign). */
export function getRankForLevel(level: number) {
  return ranks.find((r) => level >= r.min && level <= r.max) ?? ranks[ranks.length - 1]
}

/** The next rank tier above the given level, or null at the top. */
export function getNextRank(level: number) {
  const idx = ranks.findIndex((r) => level >= r.min && level <= r.max)
  if (idx === -1 || idx === ranks.length - 1) return null
  return ranks[idx + 1]
}

export interface XpProgress {
  pct: number
  intoLevel: number
  forLevel: number
  xpToNext: number
  maxed: boolean
}

/**
 * getXpProgress — xpTable is a direct threshold: level N at xp >= xpTable[N].
 * xpTable[level] is the threshold at which the CURRENT level was reached
 * (level 1's floor is 0, not xpTable["1"]).
 */
export function getXpProgress(level: number, xp: number, capOverride: number | null = null): XpProgress {
  const cap = capOverride ?? levelsData.levelCap ?? 100
  if (level >= cap) {
    return { pct: 1, intoLevel: 0, forLevel: 0, xpToNext: 0, maxed: true }
  }

  const currThreshold = level <= 1 ? 0 : (levelsData.xpTable[String(level)] ?? 0)
  const nextThreshold = levelsData.xpTable[String(level + 1)] ?? currThreshold

  const forLevel = Math.max(1, nextThreshold - currThreshold)
  const intoLevel = Math.max(0, Math.min(forLevel, xp - currThreshold))
  const xpToNext = Math.max(0, nextThreshold - xp)
  const pct = intoLevel / forLevel

  return { pct, intoLevel, forLevel, xpToNext, maxed: false }
}

// re-export for convenience
export { STAT_KEYS }
export type { StatKey }
