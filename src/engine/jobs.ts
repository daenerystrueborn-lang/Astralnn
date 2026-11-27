// Town Jobs & Work Shifts — pure browser port of plugins/jobs.js.
//
// 6 careers in Astral Town, 30-minute shift cooldown, +8% pay per job level
// (1..10, 8 shifts/level), random shift bonus events (tips or crafting
// materials), and +1 stat perk every 3 job levels.

import { gearMap } from '../data'
import { defaultRng, type Rng } from './rng'
import type { StatKey } from './stats'

export const WORK_COOLDOWN_MS = 30 * 60 * 1000
export const JOB_SHIFTS_PER_LEVEL = 8
export const MAX_JOB_LEVEL = 10
const NO_EVENT_WEIGHT = 74

export interface JobEventDef {
  weight: number
  payMult?: number
  bonusItem?: string
  bonusQty?: number
  line: string
}

export interface JobDef {
  id: string
  name: string
  emoji: string
  levelReq: number
  basePay: [number, number]
  statBonus: StatKey | 'all'
  bonusAmt: number
  desc: string
  narratives: string[]
  events: JobEventDef[]
}

export const JOBS: Record<string, JobDef> = {
  farmhand: {
    id: 'farmhand',
    name: 'Farmhand',
    emoji: '🌾',
    levelReq: 1,
    basePay: [5, 9],
    statBonus: 'def',
    bonusAmt: 1,
    desc: 'Tend crops and livestock on the outskirts of Astral Town.',
    narratives: [
      'You spend the shift hauling feed and mending fences.',
      'A long day in the fields, and the harvest is strong.',
      'You help herd a stubborn flock back into the pen.',
    ],
    events: [
      { weight: 10, payMult: 1.5, line: '🐄 A prize cow won the fair thanks to your care — the farmer tips you extra!' },
      { weight: 10, bonusItem: 'leather_scrap', bonusQty: 2, line: '🧵 You salvage leftover Leather Scrap while mending the pens.' },
      { weight: 6, payMult: 0.6, line: '🌧️ A sudden storm cuts the shift short.' },
    ],
  },
  fisher: {
    id: 'fisher',
    name: 'Fisher',
    emoji: '🎣',
    levelReq: 1,
    basePay: [5, 10],
    statBonus: 'lck',
    bonusAmt: 1,
    desc: 'Cast lines off the old pier and sell the catch at market.',
    narratives: [
      'You reel in a solid haul as the sun sets over the pier.',
      'The fish are shy today, yet your patience pays off.',
      'A lucky cast nets a few extra coins at the fish market.',
    ],
    events: [
      { weight: 10, payMult: 1.6, line: '🐟 You hook a massive catch that draws a crowd at the market!' },
      { weight: 8, bonusItem: 'leather_scrap', bonusQty: 1, line: '🎣 You salvage cured net leather while untangling your line.' },
      { weight: 6, payMult: 0.6, line: '⛈️ Rough water keeps the boats docked most of the shift.' },
    ],
  },
  courier: {
    id: 'courier',
    name: 'Courier',
    emoji: '📦',
    levelReq: 3,
    basePay: [8, 13],
    statBonus: 'agi',
    bonusAmt: 1,
    desc: 'Run deliveries between Astral Town and nearby outposts.',
    narratives: [
      'You sprint the delivery route and return before dusk.',
      'You dodge stray hounds along the road and deliver every parcel intact.',
      'A shortcut along the old ridge shaves ten minutes off your run.',
    ],
    events: [
      { weight: 10, payMult: 1.5, line: '⚡ You beat every deadline — the guild pays a speed bonus!' },
      { weight: 8, bonusItem: 'wood_plank', bonusQty: 2, line: '🪵 A grateful client hands you spare Wood Planks from their cart.' },
      { weight: 6, payMult: 0.6, line: '🐕 A detour around flooded roads eats into your route.' },
    ],
  },
  miner: {
    id: 'miner',
    name: 'Miner',
    emoji: '⛏️',
    levelReq: 5,
    basePay: [10, 16],
    statBonus: 'str',
    bonusAmt: 1,
    desc: 'Chip away at the eastern quarry for ore and loose gems.',
    narratives: [
      'You break through a promising vein and fill your ore cart.',
      'Hard, dusty quarry work, and the foreman pays on time.',
      'You uncover a pocket of ore the previous crew missed.',
    ],
    events: [
      { weight: 10, bonusItem: 'iron_ore', bonusQty: 3, line: '⛏️ You strike a rich vein and haul out extra Iron Ore!' },
      { weight: 8, payMult: 1.5, line: '💰 The foreman pays a bonus for a record-breaking cart.' },
      { weight: 6, payMult: 0.6, line: '🪨 Loose rubble takes half the shift to clear.' },
    ],
  },
  scribe: {
    id: 'scribe',
    name: 'Scribe',
    emoji: '📜',
    levelReq: 8,
    basePay: [12, 18],
    statBonus: 'int',
    bonusAmt: 1,
    desc: 'Copy guild ledgers and ancient tomes for the Astral Archive.',
    narratives: [
      'You finish transcribing a stack of guild ledgers.',
      'A weathered rune-scroll takes steady focus to decode.',
      'The archivist praises your clean script and settles your wage.',
    ],
    events: [
      { weight: 10, payMult: 1.6, line: '📖 You decode a lost passage the archivist has sought for years!' },
      { weight: 6, payMult: 0.6, line: '🖋️ A spilled inkwell forces you to rewrite the afternoon ledger.' },
    ],
  },
  merchant: {
    id: 'merchant',
    name: 'Merchant',
    emoji: '🪙',
    levelReq: 12,
    basePay: [14, 20],
    statBonus: 'all',
    bonusAmt: 1,
    desc: 'Run a stall along market row, trading goods for a share of profit.',
    narratives: [
      'A steady stream of adventurers keeps your stall busy all shift.',
      'You strike a sharp bargain reselling surplus supplies.',
      'Quiet morning traffic turns around when a regular buys out your stock.',
    ],
    events: [
      { weight: 10, payMult: 1.7, line: '🤝 You close a bulk trade with a passing caravan — huge margins!' },
      { weight: 6, payMult: 0.6, line: '🧾 A miscounted crate trims today’s profit.' },
    ],
  },
}

export const JOB_LIST: JobDef[] = Object.values(JOBS)

export interface JobPlayerSlice {
  level: number
  stats: Record<StatKey, number>
  wallet: { solars: number; [k: string]: number }
  inventory: string[]
  job?: string | null
  jobLevel?: number
  jobShifts?: number
  lastWorkAt?: number | null
  inDungeon?: boolean
  battleState?: unknown
  survivalProgress?: { workShifts?: number }
}

export function jobPayAtLevel(job: JobDef, jobLevel = 1): { lo: number; hi: number } {
  const [lo, hi] = job.basePay
  const mult = 1 + (Math.max(1, jobLevel) - 1) * 0.08
  return { lo: Math.round(lo * mult), hi: Math.round(hi * mult) }
}

export function workCooldownRemainingMs(
  player: Pick<JobPlayerSlice, 'lastWorkAt'>,
  now = Date.now(),
): number {
  if (!player.lastWorkAt) return 0
  return Math.max(0, player.lastWorkAt + WORK_COOLDOWN_MS - now)
}

function statCapFor(level: number): number {
  if (level >= 100) return 1000
  if (level >= 50) return 500
  return 300
}

function rollJobEvent(job: JobDef, rng: Rng): JobEventDef | null {
  if (!job.events.length) return null
  const total = job.events.reduce((s, e) => s + e.weight, 0) + NO_EVENT_WEIGHT
  let roll = rng() * total
  for (const e of job.events) {
    roll -= e.weight
    if (roll <= 0) return e
  }
  return null
}

export interface JobActionOutcome {
  ok: boolean
  error?: string
  job?: JobDef
  solarsEarned?: number
  narrative?: string
  eventLine?: string | null
  bonusGranted?: string | null
  statPerk?: string | null
  levelledUpJob?: boolean
  newJobLevel?: number
  cooldownMinutes?: number
}

export function applyForJob(player: JobPlayerSlice, jobId: string): JobActionOutcome {
  const job = JOBS[jobId]
  if (!job) return { ok: false, error: `Unknown job "${jobId}".` }
  if ((player.level ?? 1) < job.levelReq) {
    return {
      ok: false,
      error: `${job.emoji} ${job.name} requires Level ${job.levelReq} (you are Level ${player.level}).`,
    }
  }
  if (player.job === jobId) {
    return { ok: false, error: `You are already working as a ${job.name}.` }
  }
  player.job = jobId
  player.jobLevel = 1
  player.jobShifts = 0
  return { ok: true, job }
}

export function resignJob(player: JobPlayerSlice): JobActionOutcome {
  if (!player.job) return { ok: false, error: 'You do not currently hold a job.' }
  const prev = JOBS[player.job]
  player.job = null
  player.jobLevel = 0
  player.jobShifts = 0
  return { ok: true, job: prev }
}

export function workShift(
  player: JobPlayerSlice,
  now = Date.now(),
  rng: Rng = defaultRng,
): JobActionOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot work a shift during an active battle.' }
  }
  if (player.inDungeon) {
    return { ok: false, error: 'Return to Astral Town from the dungeon before working a shift.' }
  }
  if (!player.job || !JOBS[player.job]) {
    return { ok: false, error: 'Choose a career from the Job Board first.' }
  }

  const remain = workCooldownRemainingMs(player, now)
  if (remain > 0) {
    const mins = Math.max(1, Math.ceil(remain / 60_000))
    return {
      ok: false,
      cooldownMinutes: mins,
      error: `Still resting from your last shift — next shift ready in ${mins} min.`,
    }
  }

  const job = JOBS[player.job]!
  const jobLevel = Math.max(1, player.jobLevel || 1)
  const { lo, hi } = jobPayAtLevel(job, jobLevel)
  let solarsEarned = Math.floor(rng() * (hi - lo + 1)) + lo

  const ev = rollJobEvent(job, rng)
  let bonusGranted: string | null = null
  if (ev) {
    if (ev.payMult) solarsEarned = Math.max(1, Math.round(solarsEarned * ev.payMult))
    if (ev.bonusItem) {
      const qty = ev.bonusQty ?? 1
      for (let i = 0; i < qty; i++) player.inventory.push(ev.bonusItem)
      const itemName = gearMap[ev.bonusItem]?.name ?? ev.bonusItem
      bonusGranted = `${itemName} ×${qty}`
    }
  }

  player.survivalProgress = player.survivalProgress ?? {}
  player.survivalProgress.workShifts = Math.min(3, (player.survivalProgress.workShifts ?? 0) + 1)
  player.lastWorkAt = now

  const narrative =
    job.narratives[Math.min(job.narratives.length - 1, Math.floor(rng() * job.narratives.length))] ??
    job.narratives[0]!

  let statPerk: string | null = null
  if (jobLevel % 3 === 0) {
    const cap = statCapFor(player.level ?? 1)
    if (job.statBonus === 'all') {
      let any = false
      for (const s of ['str', 'agi', 'int', 'def', 'lck'] as const) {
        if ((player.stats[s] ?? 0) < cap) {
          player.stats[s] = Math.min(cap, (player.stats[s] ?? 0) + job.bonusAmt)
          any = true
        }
      }
      if (any) statPerk = `ALL STATS +${job.bonusAmt}`
    } else if ((player.stats[job.statBonus] ?? 0) < cap) {
      player.stats[job.statBonus] = Math.min(cap, (player.stats[job.statBonus] ?? 0) + job.bonusAmt)
      statPerk = `${job.statBonus.toUpperCase()} +${job.bonusAmt}`
    }
  }

  player.jobShifts = (player.jobShifts ?? 0) + 1
  let levelledUpJob = false
  if (player.jobShifts >= JOB_SHIFTS_PER_LEVEL && jobLevel < MAX_JOB_LEVEL) {
    player.jobLevel = jobLevel + 1
    player.jobShifts = 0
    levelledUpJob = true
  } else {
    player.jobLevel = jobLevel
  }

  player.wallet.solars = (player.wallet.solars ?? 0) + solarsEarned

  return {
    ok: true,
    job,
    solarsEarned,
    narrative,
    eventLine: ev?.line ?? null,
    bonusGranted,
    statPerk,
    levelledUpJob,
    newJobLevel: player.jobLevel,
  }
}
