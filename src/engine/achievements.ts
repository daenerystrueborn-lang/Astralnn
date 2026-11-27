// Achievements — pure browser port of lib/achievement-engine.js.
//
// Permanent Bronze / Silver / Gold / Diamond goals across Combat, Adventure,
// Collection, Wealth, Social, and Mastery. Sticky-stamps unlocks so spending
// Solars never un-completes a wealth goal, and pays rewards only on explicit
// claim.

import { achievementsCatalog } from '../data'
import type { AchievementDef } from '../data/types'
import { ensureQuestState, payReward, type QuestStateShape, type RewardPlayer } from './quests'

export const ACHIEVEMENT_TIERS = achievementsCatalog.tiers ?? {}
export const ACHIEVEMENT_TRACKS = achievementsCatalog.tracks ?? {}

const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond']

/**
 * Filter out entries whose reward currency (`seasonPoints`) does not exist in
 * the standalone browser build so every displayed achievement pays real rewards.
 */
export const ACHIEVEMENTS: AchievementDef[] = (achievementsCatalog.achievements ?? []).filter(
  (a) => a.reward?.type !== 'seasonPoints',
)
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
)

function tierRank(tier: string): number {
  const i = TIER_ORDER.indexOf(tier)
  return i === -1 ? TIER_ORDER.length : i
}

export function tierEmoji(tier: string): string {
  return ACHIEVEMENT_TIERS[tier]?.emoji ?? '🏅'
}

export function tierPoints(tier: string): number {
  return ACHIEVEMENT_TIERS[tier]?.points ?? 0
}

export interface AchievementStateShape {
  unlocked: string[]
  claimed: string[]
}

export interface AchievementPlayerSlice extends RewardPlayer {
  level: number
  ownedCharacters: string[]
  skills: string[]
  dailyStreak: number
  title?: string
  quests: QuestStateShape
  achievements?: AchievementStateShape
  enchantingBook?: { unlocked?: boolean }
  storyProgress?: { volumes?: Record<string, unknown> }
}

export function ensureAchievementState(
  player: { achievements?: AchievementStateShape },
): AchievementStateShape {
  if (!player.achievements || typeof player.achievements !== 'object') {
    player.achievements = { unlocked: [], claimed: [] }
  }
  const a = player.achievements
  a.unlocked = Array.isArray(a.unlocked) ? a.unlocked : []
  a.claimed = Array.isArray(a.claimed) ? a.claimed : []
  return a
}

const STAT_EVALUATORS: Record<string, (p: AchievementPlayerSlice) => number> = {
  level: (p) => p.level ?? 1,
  solars: (p) => Math.floor(p.wallet?.solars ?? 0),
  gems: (p) => Math.floor(p.wallet?.gems ?? 0),
  vault: (p) => Math.floor((p.wallet as Record<string, number> | undefined)?.vault ?? 0),
  seasonPoints: () => 0,
  characters: (p) => (p.ownedCharacters ?? []).length,
  pets: () => 0,
  skills: (p) => (p.skills ?? []).length,
  streak: (p) => p.dailyStreak ?? 0,
  guild: () => 0,
  bio: () => 0,
  pfp: () => 0,
  title: (p) => (p.title ? 1 : 0),
  chest: () => 0,
  ender: () => 0,
  enchantBook: (p) => (p.enchantingBook?.unlocked ? 1 : 0),
  premium: () => 0,
  storyVolumes: (p) => Object.keys(p.storyProgress?.volumes ?? {}).length,
  pvpWins: () => 0,
  pokeWins: () => 0,
  pvpStreak: () => 0,
  pvpRating: () => 0,
  reborn: () => 0,
  achievements: (p) => ensureAchievementState(p).claimed.length,
}

export function achievementProgress(
  player: AchievementPlayerSlice,
  def: AchievementDef,
): { current: number; goal: number; done: boolean; pct: number } {
  const check = def.check ?? { goal: 1 }
  const goal = Math.max(1, Math.floor(Number(check.goal) || 1))
  let current = 0
  if (check.metric) {
    const q = ensureQuestState(player)
    current = q.lifetime[check.metric] ?? 0
  } else if (check.stat && STAT_EVALUATORS[check.stat]) {
    current = STAT_EVALUATORS[check.stat]!(player)
  }
  current = Math.max(0, Math.floor(Number(current) || 0))
  return {
    current: Math.min(goal, current),
    goal,
    done: current >= goal,
    pct: goal > 0 ? Math.min(1, current / goal) : 0,
  }
}

/** Sticky-stamp newly completed achievements into `player.achievements.unlocked`. */
export function refreshAchievements(player: AchievementPlayerSlice): AchievementDef[] {
  const state = ensureAchievementState(player)
  const newly: AchievementDef[] = []
  for (const def of ACHIEVEMENTS) {
    if (state.unlocked.includes(def.id) || state.claimed.includes(def.id)) continue
    if (achievementProgress(player, def).done) {
      state.unlocked.push(def.id)
      newly.push(def)
    }
  }
  return newly
}

export interface AchievementView extends AchievementDef {
  progress: number
  goal: number
  pct: number
  done: boolean
  unlocked: boolean
  claimed: boolean
  claimable: boolean
}

export interface AchievementSummary {
  total: number
  unlocked: number
  claimed: number
  claimable: number
  points: number
  pointsTotal: number
}

function summarize(items: AchievementView[]): AchievementSummary {
  const unlocked = items.filter((i) => i.unlocked).length
  const claimed = items.filter((i) => i.claimed).length
  const claimable = items.filter((i) => i.claimable).length
  const points = items.filter((i) => i.claimed).reduce((s, i) => s + tierPoints(i.tier), 0)
  const pointsTotal = items.reduce((s, i) => s + tierPoints(i.tier), 0)
  return { total: items.length, unlocked, claimed, claimable, points, pointsTotal }
}

function toView(
  player: AchievementPlayerSlice,
  def: AchievementDef,
  state: AchievementStateShape,
): AchievementView {
  const prog = achievementProgress(player, def)
  const unlocked = state.unlocked.includes(def.id) || prog.done
  const claimed = state.claimed.includes(def.id)
  return {
    ...def,
    progress: prog.current,
    goal: prog.goal,
    pct: prog.pct,
    done: prog.done,
    unlocked,
    claimed,
    claimable: unlocked && !claimed,
  }
}

export function getAchievementBoard(
  player: AchievementPlayerSlice,
  track: string | null = null,
): {
  groups: ({ track: string; name: string; items: AchievementView[] } & AchievementSummary)[]
  summary: AchievementSummary
} {
  const state = ensureAchievementState(player)
  const wanted = track && track !== 'all' ? track.toLowerCase() : null
  const items = ACHIEVEMENTS.filter((d) => !wanted || d.track.toLowerCase() === wanted).map((d) =>
    toView(player, d, state),
  )

  const groups = []
  for (const key of Object.keys(ACHIEVEMENT_TRACKS)) {
    if (wanted && key !== wanted) continue
    const inTrack = items.filter((i) => i.track === key)
    if (!inTrack.length) continue
    inTrack.sort((a, b) => {
      if (a.claimable !== b.claimable) return a.claimable ? -1 : 1
      return tierRank(a.tier) - tierRank(b.tier)
    })
    const label = key.charAt(0).toUpperCase() + key.slice(1)
    groups.push({ track: key, name: label, items: inTrack, ...summarize(inTrack) })
  }
  return { groups, summary: summarize(items) }
}

export function claimableAchievementCount(player: AchievementPlayerSlice): number {
  const state = ensureAchievementState(player)
  return ACHIEVEMENTS.map((d) => toView(player, d, state)).filter((i) => i.claimable).length
}

export function claimAchievements(
  player: AchievementPlayerSlice,
  id: string | null = null,
): {
  claimed: { id: string; name: string; tier: string; rewardLabel: string | null }[]
  nothing: boolean
} {
  refreshAchievements(player)
  const state = ensureAchievementState(player)
  const claimed: { id: string; name: string; tier: string; rewardLabel: string | null }[] = []

  const tryClaim = (def: AchievementDef | undefined) => {
    if (!def || state.claimed.includes(def.id)) return
    if (!state.unlocked.includes(def.id)) return
    const rewardLabel = payReward(player, def.reward)
    state.claimed.push(def.id)
    claimed.push({ id: def.id, name: def.name, tier: def.tier, rewardLabel })
  }

  if (id) {
    tryClaim(ACHIEVEMENT_BY_ID[id])
  } else {
    for (const def of ACHIEVEMENTS) tryClaim(def)
  }

  // Re-stamp in case claiming pushed `achievements` count across `ach_completionist`.
  refreshAchievements(player)
  return { claimed, nothing: claimed.length === 0 }
}
