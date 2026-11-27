// Mining & Fishing Gathering — pure browser port of plugins/mine.js,
// plugins/fish.js, and lib/housing-engine.js (FISH + rollFish + castSlots).

import { gearMap, housingData } from '../data'
import type { FishDef } from '../data/types'
import { refreshStamina } from './combat'
import { efficiencyChance, type EnchantCarrier } from './enchant'
import { equippedItemId } from './equipment'
import { recordQuestEvent, type QuestStateShape } from './quests'
import { defaultRng, type Rng } from './rng'

// ── Mining (plugins/mine.js) ───────────────────────────────────────────────

export const MINE_STAMINA_COST = 3
export const MINE_COOLDOWN_MS = 5_000

export const ORE_POOL = [
  { id: 'iron_ore', name: 'Iron Ore', minLevel: 1, weight: 40 },
  { id: 'wood_plank', name: 'Wood Plank', minLevel: 1, weight: 35 },
  { id: 'leather_scrap', name: 'Leather Scrap', minLevel: 1, weight: 30 },
  { id: 'silver_ore', name: 'Silver Ore', minLevel: 5, weight: 25 },
  { id: 'mythril_ore', name: 'Mythril Ore', minLevel: 20, weight: 18 },
  { id: 'diamond_ore', name: 'Diamond Ore', minLevel: 40, weight: 12 },
  { id: 'titanium_ore', name: 'Titanium Ore', minLevel: 65, weight: 7 },
  { id: 'celestial_ore', name: 'Celestial Ore', minLevel: 85, weight: 4 },
] as const

const BONUS_ORE_POOL = [
  { id: 'mythril_ore', name: 'Mythril Ore', minLevel: 20, weight: 40 },
  { id: 'diamond_ore', name: 'Diamond Ore', minLevel: 40, weight: 30 },
  { id: 'titanium_ore', name: 'Titanium Ore', minLevel: 65, weight: 20 },
  { id: 'celestial_ore', name: 'Celestial Ore', minLevel: 85, weight: 10 },
] as const

const DAILY_BONUS_THRESHOLD = 100
const BONUS_CHANCE_BASE = 0.15
const BONUS_CHANCE_PER_50 = 0.05
const BONUS_CHANCE_CAP = 0.6

function pickOre<T extends { id: string; name: string; minLevel: number; weight: number }>(
  pool: readonly T[],
  level: number,
  rareWeightMult: number,
  rng: Rng,
): T | null {
  const available = pool.filter((o) => level >= o.minLevel)
  if (!available.length) return null
  const weightOf = (o: T) => (o.minLevel >= 20 && rareWeightMult > 1 ? o.weight * rareWeightMult : o.weight)
  const total = available.reduce((s, o) => s + weightOf(o), 0)
  let roll = rng() * total
  for (const ore of available) {
    roll -= weightOf(ore)
    if (roll <= 0) return ore
  }
  return available[available.length - 1]!
}

function bonusChanceFor(minesToday: number): number {
  if (minesToday < DAILY_BONUS_THRESHOLD) return 0
  const extra = Math.floor((minesToday - DAILY_BONUS_THRESHOLD) / 50) * BONUS_CHANCE_PER_50
  return Math.min(BONUS_CHANCE_CAP, BONUS_CHANCE_BASE + extra)
}

export interface MinePlayerSlice extends EnchantCarrier {
  level: number
  inventory: string[]
  stamina: { current: number; max: number; resetAt: number }
  quests: QuestStateShape
  lastMineAt?: number | null
  miningStats?: { date: string; count: number }
  battleState?: unknown
}

export interface MineOutcome {
  ok: boolean
  error?: string
  oreId?: string
  oreName?: string
  qty?: number
  efficiencyExtra?: number
  bonusOreName?: string | null
  staminaAfter?: number
}

/**
 * Swing the equipped pickaxe to gather crafting & enchanting ores (exact plugins/mine.js math):
 *  - Requires an equipped tool (pickaxe).
 *  - Costs 3 stamina, 5s anti-spam cooldown.
 *  - Rolls 1..3 ores + pickaxe extraOreChance + Efficiency enchant + bonus rare ore.
 *  - Records `mine` quest/achievement metric.
 */
export function mineOre(
  player: MinePlayerSlice,
  now = Date.now(),
  rng: Rng = defaultRng,
): MineOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot mine during an active battle.' }
  }
  const toolId = equippedItemId(player.equipped ?? {}, 'tool')
  const tool = toolId ? gearMap[toolId] : null
  if (!tool) {
    return {
      ok: false,
      error: 'Equip a Pickaxe in your Tool slot first (buy one in Bag & Shop → Tools).',
    }
  }

  const cdLeft = MINE_COOLDOWN_MS - (now - (player.lastMineAt ?? 0))
  if (cdLeft > 0) {
    return { ok: false, error: `Catch your breath — mine again in ${Math.ceil(cdLeft / 1000)}s.` }
  }

  const st = refreshStamina(player.stamina, now)
  if (st.current < MINE_STAMINA_COST) {
    return {
      ok: false,
      error: `Need ⚡ ${MINE_STAMINA_COST} stamina to mine (have ⚡ ${st.current}).`,
    }
  }

  player.lastMineAt = now
  st.current -= MINE_STAMINA_COST
  player.stamina = st

  const today = new Date(now).toDateString()
  if (player.miningStats?.date !== today) {
    player.miningStats = { date: today, count: 0 }
  }
  player.miningStats.count += 1

  recordQuestEvent(player, 'mine', 1)

  const mb = tool.miningBonus ?? {}
  let qty = 1 + Math.floor(rng() * 3)
  const ore = pickOre(ORE_POOL, player.level ?? 1, mb.rareWeightMult ?? 1, rng)!
  const drops: string[] = Array(qty).fill(ore.id)

  const toolExtraChance = Math.max(0, Number(mb.extraOreChance) || 0)
  if (toolExtraChance > 0 && rng() < toolExtraChance) {
    drops.push(ore.id)
    qty += 1
  }

  let efficiencyExtra = 0
  const eff = efficiencyChance(player)
  if (eff > 0 && rng() < eff) {
    drops.push(ore.id)
    efficiencyExtra = 1
  }

  let bonusOreName: string | null = null
  const rareChance = Math.min(
    0.75,
    bonusChanceFor(player.miningStats.count) + Math.max(0, Number(mb.bonusOreChance) || 0),
  )
  if (rareChance > 0 && rng() < rareChance) {
    const bonus = pickOre(BONUS_ORE_POOL, player.level ?? 1, mb.rareWeightMult ?? 1, rng)
    if (bonus) {
      drops.push(bonus.id)
      bonusOreName = bonus.name
    }
  }

  player.inventory.push(...drops)

  return {
    ok: true,
    oreId: ore.id,
    oreName: ore.name,
    qty: qty + efficiencyExtra,
    efficiencyExtra,
    bonusOreName,
    staminaAfter: st.current,
  }
}

// ── Fishing (plugins/fish.js + lib/housing-engine.js) ──────────────────────

export const FISH_LIST: FishDef[] = housingData.fish ?? []
export const FISH_MAP: Record<string, FishDef> = Object.fromEntries(FISH_LIST.map((f) => [f.id, f]))
export const FISH_COOLDOWN_MS = 8 * 60 * 1000

export function rollFish(rng: Rng = defaultRng): FishDef {
  const total = FISH_LIST.reduce((s, f) => s + f.weight, 0)
  let roll = rng() * total
  for (const f of FISH_LIST) {
    roll -= f.weight
    if (roll <= 0) return f
  }
  return FISH_LIST[0]!
}

export function castSlots(difficulty: number): number {
  return Math.min(8, Math.max(2, Number(difficulty) || 2))
}

export interface FishPlayerSlice {
  wallet: { solars: number; [k: string]: number }
  quests: QuestStateShape
  home?: { bucket?: Record<string, number>; lastFish?: number | null }
  battleState?: unknown
}

export function fishCooldownRemainingMs(
  player: Pick<FishPlayerSlice, 'home'>,
  now = Date.now(),
): number {
  const last = player.home?.lastFish
  if (typeof last !== 'number') return 0
  return Math.max(0, last + FISH_COOLDOWN_MS - now)
}

export interface FishCastOutcome {
  ok: boolean
  error?: string
  caught?: boolean
  fish?: FishDef
  slots?: number
  chosenSpot?: number
  winningSpot?: number
  cooldownMinutes?: number
}

/**
 * Cast a fishing line (exact plugins/fish.js spot-calling minigame):
 *  - Rolls a fish from FISH_LIST (`slots = castSlots(fish.difficulty)` from 2..8).
 *  - Player calls a spot `1..slots` (or lets luck pick one when omitted).
 *  - Matching the float spot lands the fish into `player.home.bucket` and
 *    records the `fish` quest/achievement metric.
 */
export function castFishingLine(
  player: FishPlayerSlice,
  spotGuess?: number | null,
  now = Date.now(),
  rng: Rng = defaultRng,
): FishCastOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot fish during an active battle.' }
  }

  const remain = fishCooldownRemainingMs(player, now)
  if (remain > 0) {
    const mins = Math.max(1, Math.ceil(remain / 60_000))
    return {
      ok: false,
      cooldownMinutes: mins,
      error: `The water is still rippling — cast again in ${mins} min.`,
    }
  }

  const home = (player.home ??= {})
  home.bucket ??= {}
  home.lastFish = now

  const fish = rollFish(rng)
  const slots = castSlots(fish.difficulty)
  const winningSpot = 1 + Math.floor(rng() * slots)
  const chosenSpot =
    spotGuess && spotGuess >= 1 && spotGuess <= slots
      ? Math.floor(spotGuess)
      : 1 + Math.floor(rng() * slots)

  const caught = chosenSpot === winningSpot
  if (caught) {
    home.bucket[fish.id] = (home.bucket[fish.id] ?? 0) + 1
    recordQuestEvent(player, 'fish', 1)
  }

  return {
    ok: true,
    caught,
    fish,
    slots,
    chosenSpot,
    winningSpot,
  }
}

export interface BucketSummary {
  entries: { fish: FishDef; count: number; totalWorth: number }[]
  totalCount: number
  totalWorth: number
}

export function getFishBucketSummary(player: Pick<FishPlayerSlice, 'home'>): BucketSummary {
  const bucket = player.home?.bucket ?? {}
  const entries: BucketSummary['entries'] = []
  let totalCount = 0
  let totalWorth = 0
  for (const [id, n] of Object.entries(bucket)) {
    if (n <= 0 || !FISH_MAP[id]) continue
    const fish = FISH_MAP[id]!
    const worth = fish.sell * n
    entries.push({ fish, count: n, totalWorth: worth })
    totalCount += n
    totalWorth += worth
  }
  return { entries, totalCount, totalWorth }
}

export function sellFishBucket(
  player: FishPlayerSlice,
  onlyFishId?: string | null,
): { ok: boolean; error?: string; earned?: number; soldCount?: number } {
  if (player.battleState) {
    return { ok: false, error: 'Cannot sell fish during battle.' }
  }
  const bucket = player.home?.bucket ?? {}
  const targets = onlyFishId ? [onlyFishId] : Object.keys(bucket)
  let earned = 0
  let soldCount = 0
  for (const id of targets) {
    const n = bucket[id] ?? 0
    const fish = FISH_MAP[id]
    if (n <= 0 || !fish) continue
    earned += fish.sell * n
    soldCount += n
    bucket[id] = 0
  }
  if (soldCount <= 0) {
    return { ok: false, error: 'Your fish bucket is empty.' }
  }
  player.wallet.solars = (player.wallet.solars ?? 0) + earned
  return { ok: true, earned, soldCount }
}
