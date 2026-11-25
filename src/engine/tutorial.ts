// Tutorial — port of the bot's lib/tutorial-engine.js.
//
// Conditional, not linear: stateCheck predicates complete steps the player's
// record already proves done; recordTutorialEvent completes ANY incomplete
// step its trigger matches. Rewards are solars/gems only (no XP, so no
// level-up ordering at hook sites). Finishing all steps pays the graduation
// gift exactly once. Instructions are reworded for the browser UI — the bot's
// .command copy would point players at WhatsApp commands that don't exist here.

export interface TutorialStep {
  id: string
  title: string
  instruction: string
  hint: string
  reward: { solars?: number; gems?: number }
  trigger: string
  stateCheck: ((p: never) => boolean) | null
}

/** The ordered tutorial steps. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'claim_character',
    title: 'Claim Your Character',
    instruction: 'Registration creates your character.',
    hint: 'Your character defines your class, stats, and playstyle.',
    reward: { solars: 100 },
    trigger: 'character_claimed',
    stateCheck: () => true,
  },
  {
    id: 'claim_daily',
    title: 'Claim Your Daily Reward',
    instruction: 'Claim your daily reward from the Profile tab.',
    hint: 'Come back every day to build your streak bonus!',
    reward: { solars: 50 },
    trigger: 'daily_claimed',
    stateCheck: (p) => !!(p as { lastDailyClaim?: number | null }).lastDailyClaim,
  },
  {
    id: 'equip_weapon',
    title: 'Equip a Weapon',
    instruction: 'Equip a weapon from the Inventory tab.',
    hint: 'Weapons boost your damage in combat. Your class starts with one.',
    reward: { solars: 50 },
    trigger: 'weapon_equipped',
    stateCheck: (p) => !!(p as { equipped?: Record<string, string | null> }).equipped?.weapon,
  },
  {
    id: 'fight_monster',
    title: 'Fight a Monster',
    instruction: 'Win a battle from the Battle tab.',
    hint: 'Combat earns you XP, Solars, and item drops.',
    reward: { solars: 125 },
    trigger: 'monster_killed',
    stateCheck: (p) => ((p as { stats?: { wins?: number } }).stats?.wins ?? 0) > 0,
  },
  {
    id: 'check_inventory',
    title: 'Check Your Inventory',
    instruction: 'Open the Inventory tab to see what you own.',
    hint: 'Your inventory holds weapons, items, materials, and more.',
    reward: { solars: 25 },
    trigger: 'inventory_viewed',
    stateCheck: null,
  },
  {
    id: 'check_profile',
    title: 'View Your Profile',
    instruction: 'Open the Profile tab to see your stats and progress.',
    hint: 'Your profile shows your level, class, rank, and equipment.',
    reward: { solars: 25 },
    trigger: 'profile_viewed',
    stateCheck: null,
  },
  {
    id: 'enter_dungeon',
    title: 'Enter a Dungeon',
    instruction: 'Enter a dungeon floor from the Battle tab.',
    hint: 'Dungeons have multiple floors with tougher monsters and better loot.',
    reward: { solars: 250 },
    trigger: 'dungeon_entered',
    stateCheck: (p) =>
      Object.keys((p as { dungeonProgress?: Record<string, unknown> }).dungeonProgress ?? {}).length > 0,
  },
  {
    id: 'complete_quest',
    title: 'Complete a Quest',
    instruction: 'Claim a completed quest from the Quests tab.',
    hint: 'Quests give bonus rewards on top of what you earn normally.',
    reward: { solars: 200, gems: 5 },
    trigger: 'quest_completed',
    stateCheck: (p) => {
      const q = (p as { quests?: { dailyClaimed?: string[]; milestoneClaimed?: string[] } }).quests
      return ((q?.dailyClaimed?.length ?? 0) + (q?.milestoneClaimed?.length ?? 0)) > 0
    },
  },
]

const TRIGGER_MAP: Record<string, TutorialStep & { index: number }> = Object.fromEntries(
  TUTORIAL_STEPS.map((s, i) => [s.trigger, { ...s, index: i }]),
)

/** Graduation reward for completing all steps. */
export const GRADUATION_REWARD = { solars: 500, gems: 10 }

export interface TutorialStateShape {
  completed: string[]
  graduated: boolean
  graduationRewarded: boolean
  graduatedAt: number | null
  startedAt: number
  skipped: boolean
}

export interface TutorialHost {
  tutorial: TutorialStateShape
  wallet: Record<string, number>
}

/** Ensure player.tutorial has the bot's shape (lazy, tolerant of old saves). */
export function ensureTutorial(player: { tutorial?: Partial<TutorialStateShape> }): TutorialStateShape | null {
  if (!player) return null
  const t = (player.tutorial ??= {}) as TutorialStateShape
  if (!Array.isArray(t.completed)) t.completed = []
  if (typeof t.graduated !== 'boolean') t.graduated = false
  if (typeof t.graduationRewarded !== 'boolean') t.graduationRewarded = false
  if (typeof t.graduatedAt !== 'number') t.graduatedAt = null
  if (typeof t.startedAt !== 'number') t.startedAt = Date.now()
  if (typeof t.skipped !== 'boolean') t.skipped = false
  return t
}

/** "☀️ 100 Solars, 💎 5 Gems" — shared reward label. */
export function rewardLabel(reward: { solars?: number; gems?: number } | null | undefined): string {
  if (!reward) return ''
  const parts: string[] = []
  if (reward.solars) parts.push(`☀️ ${reward.solars} Solars`)
  if (reward.gems) parts.push(`💎 ${reward.gems} Gems`)
  return parts.join(', ')
}

function payReward(player: { wallet: Record<string, number> }, reward: { solars?: number; gems?: number }): void {
  if (!reward) return
  if (reward.solars) player.wallet.solars = (player.wallet.solars ?? 0) + reward.solars
  if (reward.gems) player.wallet.gems = (player.wallet.gems ?? 0) + reward.gems
}

function completeStep(player: TutorialHost, t: TutorialStateShape, step: TutorialStep): void {
  t.completed.push(step.id)
  payReward(player, step.reward)
}

function finalizeGraduation(player: TutorialHost, t: TutorialStateShape): boolean {
  if (t.completed.length < TUTORIAL_STEPS.length || t.graduated) return false
  t.graduated = true
  t.graduatedAt = Date.now()
  if (!t.graduationRewarded) {
    t.graduationRewarded = true
    payReward(player, GRADUATION_REWARD)
  }
  return true
}

export interface CurrentStep extends TutorialStep {
  index: number
  total: number
}

/** The current step, or null when finished/skipped. */
export function getCurrentStep(player: TutorialHost): CurrentStep | null {
  const t = ensureTutorial(player)
  if (!t || t.graduated || t.skipped) return null
  for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
    if (!t.completed.includes(TUTORIAL_STEPS[i]!.id)) {
      return { ...TUTORIAL_STEPS[i]!, index: i, total: TUTORIAL_STEPS.length }
    }
  }
  return null
}

export function isStepComplete(player: TutorialHost, stepId: string): boolean {
  const t = ensureTutorial(player)
  return t?.completed?.includes(stepId) ?? false
}

export function tutorialProgress(player: TutorialHost): {
  completed: number
  total: number
  percent: number
  graduated: boolean
} {
  const t = ensureTutorial(player)
  const completed = t?.completed?.length ?? 0
  const total = TUTORIAL_STEPS.length
  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 100,
    graduated: t?.graduated ?? false,
  }
}

export interface TutorialResult {
  steps: TutorialStep[]
  graduated: boolean
  next: CurrentStep | null
}

/**
 * Complete every step the player's record already proves done, paying each
 * reward. Returns null when nothing changed.
 */
export function syncTutorialProgress(player: TutorialHost): TutorialResult | null {
  const t = ensureTutorial(player)
  if (!t || t.graduated || t.skipped) return null

  const steps: TutorialStep[] = []
  for (const step of TUTORIAL_STEPS) {
    if (t.completed.includes(step.id)) continue
    if (typeof step.stateCheck === 'function' && (step.stateCheck as (p: unknown) => boolean)(player)) {
      completeStep(player, t, step)
      steps.push(step)
    }
  }
  if (!steps.length) return null

  const graduated = finalizeGraduation(player, t)
  return { steps, graduated, next: getCurrentStep(player) }
}

/**
 * Record a tutorial event (call inside a store mutation): state-syncs first,
 * then completes ANY incomplete step matching the trigger. Order doesn't matter.
 */
export function recordTutorialEvent(player: TutorialHost, trigger: string): TutorialResult | null {
  const t = ensureTutorial(player)
  if (!t || t.graduated || t.skipped) return null

  const result = syncTutorialProgress(player) ?? { steps: [], graduated: false, next: null }

  const step = TRIGGER_MAP[trigger]
  if (step && !t.completed.includes(step.id)) {
    completeStep(player, t, step)
    result.steps.push(step)
  }

  if (!result.steps.length) return null
  if (!result.graduated) result.graduated = finalizeGraduation(player, t)
  result.next = getCurrentStep(player)
  return result
}

/**
 * Skip the tutorial: opts out of guidance AND forfeits the graduation gift
 * (skipping is not graduating), but marks every step complete for trackers.
 */
export function skipTutorial(player: TutorialHost): boolean {
  const t = ensureTutorial(player)
  if (!t) return false
  if (t.graduated) return false
  t.skipped = true
  t.completed = TUTORIAL_STEPS.map((s) => s.id)
  t.graduated = true
  t.graduatedAt = Date.now()
  return true
}
