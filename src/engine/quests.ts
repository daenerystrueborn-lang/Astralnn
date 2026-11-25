// Quests — port of the bot's lib/quest-engine.js (daily + milestone tracks).
//
// V0 drops the season/scenario extras and the Astral Pass payout; the reward
// vocabulary, seeded daily draw, midnight rotation and explicit-claim rule
// are exact.

import { quests, characterMap, gearMap } from '../data/index'
import type { QuestDef } from '../data/types'

const DAILY: QuestDef[] = quests.daily ?? []
const MILESTONE: QuestDef[] = quests.milestone ?? []

/** How many quests are drawn from the daily pool each day. */
export const DAILY_COUNT = 3

const DAILY_BY_ID: Record<string, QuestDef> = Object.fromEntries(DAILY.map((q) => [q.id, q]))
const MILESTONE_BY_ID: Record<string, QuestDef> = Object.fromEntries(MILESTONE.map((q) => [q.id, q]))

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Deterministic daily pick seeded by the calendar-day index — every player
 * sees the same set, rotating at local midnight. xorshift32 + Fisher-Yates,
 * pure, no Math.random (exact bot port).
 */
export function dailyQuestIdsForDay(dayStartMs: number): string[] {
  const pool = DAILY.map((q) => q.id)
  if (pool.length <= DAILY_COUNT) return pool
  let seed = Math.floor(dayStartMs / 86_400_000) || 1
  const rand = () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return ((seed >>> 0) % 100000) / 100000
  }
  const arr = pool.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, DAILY_COUNT)
}

export interface QuestStateShape {
  day: number
  daily: Record<string, number>
  dailyClaimed: string[]
  lifetime: Record<string, number>
  milestoneClaimed: string[]
}

/** Ensure player.quests exists and matches TODAY (rotation wipes daily only). */
export function ensureQuestState(player: { quests: QuestStateShape }, now = Date.now()): QuestStateShape {
  const today = startOfDay(now)
  if (!player.quests || typeof player.quests !== 'object') {
    player.quests = { day: today, daily: {}, dailyClaimed: [], lifetime: {}, milestoneClaimed: [] }
  }
  const q = player.quests
  q.lifetime = q.lifetime ?? {}
  q.milestoneClaimed = q.milestoneClaimed ?? []
  if (q.day !== today) {
    q.day = today
    q.daily = {}
    q.dailyClaimed = []
  }
  q.daily = q.daily ?? {}
  q.dailyClaimed = q.dailyClaimed ?? []
  return q
}

export interface QuestCompleted {
  track: 'daily' | 'milestone'
  def: QuestDef
}

/**
 * Advance every quest watching `metric`. Mutates player; returns quests that
 * CROSSED their goal on this call. Never pays — claiming is explicit.
 */
export function recordQuestEvent(player: { quests: QuestStateShape }, metric: string, amount = 1): QuestCompleted[] {
  if (!metric || amount <= 0) return []
  const q = ensureQuestState(player)
  const justCompleted: QuestCompleted[] = []

  q.lifetime[metric] = (q.lifetime[metric] ?? 0) + amount

  const todaysIds = dailyQuestIdsForDay(q.day)
  for (const id of todaysIds) {
    const def = DAILY_BY_ID[id]
    if (!def || def.metric !== metric) continue
    const before = q.daily[id] ?? 0
    if (before >= def.goal) continue
    const after = Math.min(def.goal, before + amount)
    q.daily[id] = after
    if (before < def.goal && after >= def.goal) justCompleted.push({ track: 'daily', def })
  }

  for (const def of MILESTONE) {
    if (def.metric !== metric) continue
    if (q.milestoneClaimed.includes(def.id)) continue
    const before = q.lifetime[metric] - amount
    if (before < def.goal && q.lifetime[metric] >= def.goal) justCompleted.push({ track: 'milestone', def })
  }

  return justCompleted
}

export interface QuestView extends QuestDef {
  progress: number
  done: boolean
  claimed: boolean
}

function dailyView(player: { quests: QuestStateShape }): QuestView[] {
  const q = ensureQuestState(player)
  return dailyQuestIdsForDay(q.day).map((id) => {
    const def = DAILY_BY_ID[id]
    const progress = Math.min(def.goal, q.daily[id] ?? 0)
    const claimed = q.dailyClaimed.includes(id)
    return { ...def, progress, done: progress >= def.goal, claimed }
  })
}

function milestoneView(player: { quests: QuestStateShape }): QuestView[] {
  const q = ensureQuestState(player)
  const firstUnclaimedByMetric: Record<string, string> = {}
  for (const def of MILESTONE) {
    if (q.milestoneClaimed.includes(def.id)) continue
    if (!(def.metric in firstUnclaimedByMetric)) firstUnclaimedByMetric[def.metric] = def.id
  }
  const shown: QuestView[] = []
  for (const def of MILESTONE) {
    if (q.milestoneClaimed.includes(def.id)) continue
    const progress = Math.min(def.goal, q.lifetime[def.metric] ?? 0)
    const done = progress >= def.goal
    if (done || firstUnclaimedByMetric[def.metric] === def.id) {
      shown.push({ ...def, progress, done, claimed: false })
    }
  }
  return shown
}

export function getQuestBoard(player: { quests: QuestStateShape }): { daily: QuestView[]; milestone: QuestView[] } {
  return { daily: dailyView(player), milestone: milestoneView(player) }
}

/** Done-but-unclaimed quests across both tracks. */
export function claimableCount(player: { quests: QuestStateShape }): number {
  const { daily, milestone } = getQuestBoard(player)
  return daily.filter((q) => q.done && !q.claimed).length + milestone.filter((q) => q.done).length
}

// ── Rewards (the only place a reward is paid) ──────────────────────────────

export interface RewardPlayer {
  wallet: { solars: number; gems: number }
  xp: number
  stamina?: { current: number; max: number }
  inventory?: string[]
  ownedCharacters?: string[]
}

/**
 * V0 reward vocabulary: solars | gems | xp | stamina | item | weapon |
 * character. Season points are a V1 currency and are not paid here.
 * Returns a player-facing label, or null for a bad reward.
 */
export function payReward(player: RewardPlayer, reward: { type: string; amount: number; itemId?: string } | null | undefined): string | null {
  if (!reward) return null
  const amt = Math.max(0, Math.floor(Number(reward.amount) || 0))
  switch (reward.type) {
    case 'solars':
      player.wallet.solars = (player.wallet.solars ?? 0) + amt
      return `☀️ ${amt} Solars`
    case 'gems':
      player.wallet.gems = Math.round(((player.wallet.gems ?? 0) + amt) * 100) / 100
      return `💎 ${amt} Gems`
    case 'xp':
      player.xp = (player.xp ?? 0) + amt
      return `📈 ${amt} XP`
    case 'stamina':
      if (player.stamina) {
        player.stamina.current = Math.min(player.stamina.max, (player.stamina.current ?? 0) + amt)
      }
      return `⚡ ${amt} Stamina`
    case 'item':
    case 'weapon': {
      const id = reward.itemId
      if (!id) return null
      player.inventory?.push(id)
      const name = gearMap[id]?.name ?? id
      return `🎁 ${name}`
    }
    case 'character': {
      const id = reward.itemId
      if (!id || !characterMap[id]) return null
      if (player.ownedCharacters && !player.ownedCharacters.includes(id)) {
        player.ownedCharacters.push(id)
      }
      return `🎴 a new character`
    }
    default:
      return null
  }
}

export interface ClaimedQuest {
  name: string
  rewardLabel: string | null
  track: 'daily' | 'milestone'
  id: string
}

/**
 * Claim one quest by id, or every done-unclaimed quest when id is null.
 * Mutates player; returns what was claimed. XP paid here does NOT auto-level —
 * the caller runs applyLevelUps afterwards if it wants that (bot behavior).
 */
export function claimQuest(
  player: { quests: QuestStateShape } & RewardPlayer,
  id: string | null = null,
): { claimed: ClaimedQuest[]; nothing: boolean } {
  const q = ensureQuestState(player)
  const board = getQuestBoard(player)
  const claimed: ClaimedQuest[] = []

  const tryClaimDaily = (view: QuestView): void => {
    if (!view.done || view.claimed) return
    const label = payReward(player, view.reward)
    q.dailyClaimed.push(view.id)
    claimed.push({ name: view.name, rewardLabel: label, track: 'daily', id: view.id })
  }
  const tryClaimMilestone = (view: QuestView): void => {
    if (!view.done) return
    if (q.milestoneClaimed.includes(view.id)) return
    const label = payReward(player, view.reward)
    q.milestoneClaimed.push(view.id)
    claimed.push({ name: view.name, rewardLabel: label, track: 'milestone', id: view.id })
  }

  if (id) {
    const d = board.daily.find((v) => v.id === id)
    if (d) tryClaimDaily(d)
    const m = board.milestone.find((v) => v.id === id)
    if (m) tryClaimMilestone(m)
  } else {
    for (const v of board.daily) tryClaimDaily(v)
    for (const v of board.milestone) tryClaimMilestone(v)
  }

  return { claimed, nothing: claimed.length === 0 }
}

export function getDailyCount(): number {
  return DAILY_COUNT
}
