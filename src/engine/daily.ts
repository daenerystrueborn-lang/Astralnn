// Daily reward — port of plugins/daily.js (claim math only).
//
// Once per local day: solars = 50 + level×3 + min(streak,7)×15,
// xp = 20 + level×2, stamina +10, streak milestones at 3/7/14/30/60/100.
// Premium gems, Astral Pass and Guild Clash lines are V1 systems — skipped.

import { applyLevelUps, getRankForLevel, type ProgressPlayer } from './progression'
import { recordTutorialEvent, type TutorialResult } from './tutorial'

const BASE_SOLARS = 50
const PER_LEVEL_SOLARS = 3
const STREAK_BONUS_PER_DAY = 15
const STREAK_CAP = 7
const STAMINA_RESTORE = 10
const BASE_XP = 20
const XP_PER_LEVEL = 2

export interface StreakMilestone {
  days: number
  solars: number
  xp: number
  gems: number
  label: string
  emoji: string
}

/** One-time bonuses when the raw (uncapped) streak first reaches each day. */
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 3, solars: 150, xp: 50, gems: 0, label: '3-Day Streak', emoji: '🔥' },
  { days: 7, solars: 500, xp: 150, gems: 3, label: '1-Week Streak', emoji: '🔥🔥' },
  { days: 14, solars: 1000, xp: 300, gems: 5, label: '2-Week Streak', emoji: '🔥🔥🔥' },
  { days: 30, solars: 2500, xp: 500, gems: 10, label: '1-Month Streak', emoji: '💎🔥💎' },
  { days: 60, solars: 5000, xp: 1000, gems: 20, label: '2-Month Streak', emoji: '👑💎👑' },
  { days: 100, solars: 10000, xp: 2000, gems: 50, label: '100-Day Streak', emoji: '🌟👑🌟' },
]

const MILESTONE_MAP = Object.fromEntries(STREAK_MILESTONES.map((m) => [m.days, m]))

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export type DailyPlayer = ProgressPlayer & {
  dailyStreak: number
  lastDailyClaim: number | null
  streakMilestones: number[]
  bestDailyStreak: number
  stamina?: { current: number; max: number }
  tutorial: Parameters<typeof recordTutorialEvent>[0]['tutorial']
}

export type DailyOutcome =
  | { already: true; next: Date }
  | {
      already: false
      solarsReward: number
      xpReward: number
      streak: number
      staminaAfter: number
      staminaMax: number
      milestoneHit: StreakMilestone | null
      lvlMsgs: string[]
      rankChange: { from: string; to: string } | null
      tutorial: TutorialResult | null
    }

/**
 * Claim today's reward. Mutates the player (single-writer: call inside a
 * store mutation). XP is settled through applyLevelUps exactly like the bot.
 */
export function claimDaily(player: DailyPlayer, now = Date.now()): DailyOutcome {
  const todayStart = startOfDay(now)
  const last = player.lastDailyClaim ?? 0
  const lastDayStart = last ? startOfDay(last) : null

  if (lastDayStart === todayStart) {
    return { already: true, next: new Date(todayStart + 24 * 60 * 60 * 1000) }
  }

  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000
  const isConsecutive = lastDayStart === yesterdayStart

  player.dailyStreak = isConsecutive ? (player.dailyStreak ?? 0) + 1 : 1
  player.lastDailyClaim = now

  const streakDays = Math.min(player.dailyStreak ?? 1, STREAK_CAP)
  const solarsReward = BASE_SOLARS + player.level * PER_LEVEL_SOLARS + streakDays * STREAK_BONUS_PER_DAY
  const xpReward = BASE_XP + player.level * XP_PER_LEVEL

  player.wallet.solars = (player.wallet.solars ?? 0) + solarsReward
  player.xp = (player.xp ?? 0) + xpReward

  // Streak milestone — raw (uncapped) streak triggers, once each ever.
  let milestoneHit: StreakMilestone | null = null
  const rawStreak = player.dailyStreak ?? 1
  if (!Array.isArray(player.streakMilestones)) player.streakMilestones = []
  const milestone = MILESTONE_MAP[rawStreak]
  if (milestone && !player.streakMilestones.includes(rawStreak)) {
    player.streakMilestones.push(rawStreak)
    player.wallet.solars = (player.wallet.solars ?? 0) + milestone.solars
    player.xp = (player.xp ?? 0) + milestone.xp
    if (milestone.gems > 0) player.wallet.gems = (player.wallet.gems ?? 0) + milestone.gems
    milestoneHit = milestone
  }

  if (!player.bestDailyStreak || rawStreak > player.bestDailyStreak) {
    player.bestDailyStreak = rawStreak
  }

  const tutorial = recordTutorialEvent(player, 'daily_claimed')

  const rankBefore = getRankForLevel(player.level)
  const { msgs: lvlMsgs, levelled } = applyLevelUps(player)
  const rankAfter = getRankForLevel(player.level)
  const rankChange =
    levelled && rankAfter.title !== rankBefore.title
      ? { from: rankBefore.title, to: rankAfter.title }
      : null

  let staminaAfter = player.stamina?.current ?? 0
  let staminaMax = player.stamina?.max ?? 0
  if (player.stamina) {
    player.stamina.current = Math.min(player.stamina.max, player.stamina.current + STAMINA_RESTORE)
    staminaAfter = player.stamina.current
    staminaMax = player.stamina.max
  }

  return {
    already: false,
    solarsReward,
    xpReward,
    streak: player.dailyStreak,
    staminaAfter,
    staminaMax,
    milestoneHit,
    lvlMsgs,
    rankChange,
    tutorial,
  }
}
