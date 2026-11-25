// Stat derivation — port of lib/game-data.js getTotalStats() plus the
// primary-stat map from lib/combat-engine.js.

import { classes, races, levelsData, defaultWallet } from '../data'
import type { TotalStats } from '../data/types'

export type StatKey = 'str' | 'agi' | 'int' | 'def' | 'lck'
export const STAT_KEYS: StatKey[] = ['str', 'agi', 'int', 'def', 'lck']

/** The stat a class builds its attacks from (lib/combat-engine.js PRIMARY_STAT). */
export const PRIMARY_STAT: Record<string, StatKey> = {
  warrior: 'str',
  samurai: 'str',
  knight: 'str',
  berserker: 'str',
  rogue: 'agi',
  duelist: 'agi',
  assassin: 'agi',
  mage: 'int',
  cleric: 'int',
}

export function attackStatKey(player: { classId: string }): StatKey {
  return PRIMARY_STAT[player?.classId] ?? 'str'
}

/**
 * getTotalStats(classId, raceId, level) — exact port of lib/game-data.js:
 * class base + race modifiers + per-level growth × (level − 1).
 * Primary stat grows at growth.primaryStat, everything else at secondaryStat.
 */
export function getTotalStats(classId: string, raceId: string, level: number): TotalStats {
  const cls = classes[classId]
  const race = races[raceId]
  if (!cls) throw new Error(`Unknown classId: ${classId}`)
  if (!race) throw new Error(`Unknown raceId: ${raceId}`)

  const growth = levelsData.statGrowthPerLevel
  const levelsGained = Math.max(0, level - 1)
  const primary = cls.primaryStat

  const stats = {} as TotalStats
  for (const key of STAT_KEYS) {
    const rate = key === primary ? growth.primaryStat : growth.secondaryStat
    stats[key] =
      (cls.baseStats[key] ?? 0) + (race.statModifiers[key] ?? 0) + rate * levelsGained
  }
  stats.maxHp = (cls.baseStats.maxHp ?? 0) + growth.maxHp * levelsGained
  stats.maxMp = (cls.baseStats.maxMp ?? 0) + growth.maxMp * levelsGained
  return stats
}

/** Starting wallet shape (data/currency.json). */
export function makeDefaultWallet(): Record<string, number> {
  return { ...defaultWallet }
}
