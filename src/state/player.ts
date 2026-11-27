// Player record — V0 port of the bot's lib/player-factory.js.
// The factory is the SINGLE place a new player record is built (the bot's
// own rule: one factory, every creation path, byte-identical shape).
//
// V0 trims vs the bot (see GAME_SPEC.md §2): no guild/premium/pending-payment
// fields, no sect profile (V2), no season blocks (V2), wallet is
// solars+gems only (Monds/bank/loan dropped with their systems).

import { classes, races, skills, skillMap, levelsData } from '../data'
import { getTotalStats, STAT_KEYS, type StatKey } from '../engine/stats'
import type { StatPointsState } from '../engine/progression'
import { ensureUniversalNeutralSkills, autoFillSkillSlots } from './skill-slots'

export const SAVE_SCHEMA_VERSION = 1

/** Loose battle session shape; Slice 3 defines the full session. */
export interface BattleState {
  [key: string]: unknown
}

export interface QuestState {
  /** start-of-day ms for the current daily period */
  day: number
  daily: Record<string, number>
  dailyClaimed: string[]
  lifetime: Record<string, number>
  milestoneClaimed: string[]
}

/** Bot's tutorial-engine shape: id-based, conditional, one-shot rewards. */
export interface TutorialState {
  completed: string[]
  graduated: boolean
  graduationRewarded: boolean
  graduatedAt: number | null
  startedAt: number
  skipped: boolean
}

export interface StaminaState {
  current: number
  max: number
  resetAt: number
}

export interface Player {
  schemaVersion: number
  id: string
  name: string
  classId: string
  raceId: string

  level: number
  xp: number
  hp: number
  maxHp: number
  mp: number
  maxMp: number

  stats: Record<StatKey, number> & { wins: number; losses: number }
  baseStats: Record<string, number>
  statPoints: StatPointsState

  /** V0 currencies only: solars + gems (GAME_SPEC decision). */
  wallet: { solars: number; gems: number }

  equipped: {
    weapon: string | null
    offhand: string | null
    helmet: string | null
    chestplate: string | null
    boots: string | null
    accessory: string | null
    tool: string | null
    pet: string | null
  }
  inventory: string[]

  skills: string[]
  equippedSkills: string[]

  // V1 systems, initialised empty so no migration is needed later.
  abilityInventory: string[]
  equippedAbilities: string[]
  abilitySlots: number

  ownedCharacters: string[]
  equippedCharacter: string | null
  /** Tracks which character's statBonuses are currently folded into live stats. */
  characterBonusApplied?: string | null

  location: string
  inDungeon: boolean
  dungeonFloor: number
  dungeonCheckpoint: number
  battleState: BattleState | null
  dungeonProgress: Record<string, { highestFloor: number; conquered?: boolean }>
  /** Active conquest title earned from clearing a dungeon's final boss. */
  title?: string
  titles?: string[]

  stamina: StaminaState
  quests: QuestState
  achievements?: { unlocked: string[]; claimed: string[] }
  tutorial: TutorialState

  job?: string | null
  jobLevel?: number
  jobShifts?: number
  lastWorkAt?: number | null
  survivalProgress?: {
    workShifts?: number
    soloFloors?: Record<string, boolean>
    personalFloorsVersion?: number
  }

  dailyStreak: number
  lastDailyClaim: number | null
  /** One-time streak milestones already paid (3/7/14/30/60/100 days). */
  streakMilestones: number[]
  bestDailyStreak: number

  // V1 forward-compat (story mode reads these from day one).
  storyProgress: { volumes: Record<string, unknown> }
  storyFlags: string[]

  registeredAt: number
  updatedAt: number
}

export interface RegistrationInput {
  name: string
  classId: string
  raceId: string
}

export interface RegistrationResult {
  ok: boolean
  error?: string
  name?: string
  classId?: string
  raceId?: string
}

/** Bot's name rules: 2–20 chars, letters/numbers/_ . - only. */
export function validateRegistration(input: RegistrationInput): RegistrationResult {
  const cleanName = String(input?.name ?? '').trim()
  const cls = String(input?.classId ?? '').toLowerCase().trim()
  const race = String(input?.raceId ?? '').toLowerCase().trim()

  if (!cleanName) return { ok: false, error: 'Pick a character name.' }
  if (cleanName.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' }
  if (cleanName.length > 20) return { ok: false, error: 'Name must be 20 characters or fewer.' }
  if (!/^[A-Za-z0-9_.-]+$/.test(cleanName)) {
    return { ok: false, error: 'Name can only use letters, numbers, and _ . -' }
  }
  if (!Object.prototype.hasOwnProperty.call(classes, cls)) {
    return { ok: false, error: `Unknown class "${input.classId}".` }
  }
  if (!Object.prototype.hasOwnProperty.call(races, race) || races[race]?.hidden === true) {
    return { ok: false, error: `Unknown race "${input.raceId}".` }
  }
  return { ok: true, name: cleanName, classId: cls, raceId: race }
}

/** Local midnight (tomorrow) as the stamina reset stamp — bot behavior. */
function tomorrowMidnight(now: number): number {
  const tom = new Date(now)
  tom.setHours(24, 0, 0, 0)
  return tom.getTime()
}

/** Local start-of-day for the quest period — mirrors quest-engine. */
function startOfDay(now: number): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function makeId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return `p_${c.randomUUID()}`
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * createNewPlayer — builds (does not persist) a fresh V0 player record.
 * Throws on invalid registration; use validateRegistration() first for
 * human-readable errors.
 */
export function createNewPlayer(
  input: RegistrationInput,
  now = Date.now(),
): Player {
  const v = validateRegistration(input)
  if (!v.ok) throw new Error(v.error)

  const classId = v.classId!
  const raceId = v.raceId!
  const total = getTotalStats(classId, raceId, 1)
  const cls = classes[classId]!

  const player: Player = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: makeId(),
    name: v.name!,
    classId,
    raceId,

    level: 1,
    xp: 0,
    hp: total.maxHp,
    maxHp: total.maxHp,
    mp: total.maxMp,
    maxMp: total.maxMp,

    stats: {
      str: total.str, agi: total.agi, int: total.int, def: total.def, lck: total.lck,
      wins: 0, losses: 0,
    },
    baseStats: {
      str: total.str, agi: total.agi, int: total.int, def: total.def, lck: total.lck,
      maxHp: total.maxHp, maxMp: total.maxMp,
    },
    statPoints: {
      version: 2,
      earned: 15,
      spent: 0,
      unallocated: 15,
      allocations: { str: 0, agi: 0, int: 0, def: 0, lck: 0 },
    },

    wallet: { solars: 100, gems: 0 },

    equipped: {
      weapon: null, offhand: null, helmet: null, chestplate: null,
      boots: null, accessory: null, tool: null, pet: null,
    },
    inventory: [...cls.startingItems],

    skills: [],
    equippedSkills: [],

    abilityInventory: [],
    equippedAbilities: [],
    abilitySlots: 1,

    ownedCharacters: [],
    equippedCharacter: null,

    location: 'astral_town',
    inDungeon: false,
    dungeonFloor: 0,
    dungeonCheckpoint: 0,
    battleState: null,
    dungeonProgress: {},

    stamina: { current: 30, max: 30, resetAt: tomorrowMidnight(now) },
    quests: {
      day: startOfDay(now),
      daily: {},
      dailyClaimed: [],
      lifetime: {},
      milestoneClaimed: [],
    },
    tutorial: {
      completed: [],
      graduated: false,
      graduationRewarded: false,
      graduatedAt: null,
      startedAt: now,
      skipped: false,
    },

    dailyStreak: 0,
    lastDailyClaim: null,
    streakMilestones: [],
    bestDailyStreak: 0,

    storyProgress: { volumes: {} },
    storyFlags: [],

    registeredAt: now,
    updatedAt: now,
  }

  // Same order as the bot's factory: Universal Neutral first (iron palm at
  // Lv 1), class starting skills after, deduped — then auto-fill the 4 slots.
  player.skills = [
    'neutral_iron_palm',
    ...cls.startingSkills.filter((id) => id !== 'neutral_iron_palm'),
  ]
  ensureUniversalNeutralSkills(player)
  autoFillSkillSlots(player, skills)

  return player
}

/** Grant any Universal Neutral skills the player's level has unlocked. */
export { ensureUniversalNeutralSkills }

/** Sanity used by tests/UI: every skill id the player owns must resolve. */
export function ownedActiveSkills(player: Player) {
  return player.skills
    .map((id) => skillMap[id])
    .filter((s): s is NonNullable<typeof s> => Boolean(s && s.type === 'active'))
}
