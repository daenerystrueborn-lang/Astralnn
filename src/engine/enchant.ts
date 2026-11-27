// Gear Enchanting — pure browser port of lib/enchantments.js + plugins/enchant.js.
//
// Enchantments bind to an item id (`player.enchants[itemId][enchantId] = level`)
// and feed combat/gathering funnels directly:
//   Sharpness   → calcPlayerDamage()
//   Protection  → mitigateIncomingPlayerHit() (capped at MAX_PROTECTION = 35%)
//   Looting     → rollDrops()
//   Efficiency  → mineOre()

import { enchantmentData, gearMap } from '../data'
import type { EnchantDef, EnchantLevelDef, GearDef } from '../data/types'
import { PHYSICAL_EQUIPMENT_SLOTS, equippedItemId, physicalEquipmentSlot } from './equipment'

export const ENCHANTS: EnchantDef[] = enchantmentData.enchants ?? []
export const ENCHANT_MAP: Record<string, EnchantDef> = Object.fromEntries(
  ENCHANTS.map((e) => [e.id, e]),
)

export const ENCHANT_BOOK_SOLARS = Number(enchantmentData.prices?.bookSolars ?? 500_000)
export const ENCHANT_SOLARS = Number(enchantmentData.prices?.perEnchantSolars ?? 50_000)
export const MAX_PROTECTION = 0.35

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function roman(level: number): string {
  return ROMAN[level] ?? String(level)
}

export function fmtPct(fraction: number): string {
  const n = Math.round((Number(fraction) || 0) * 1000) / 10
  return `${Number.isInteger(n) ? n : n.toFixed(1)}%`
}

export function levelStep(enchantId: string, level: number): EnchantLevelDef | null {
  return ENCHANT_MAP[enchantId]?.levels?.[level - 1] ?? null
}

export function levelName(enchantId: string, level: number): string {
  const def = ENCHANT_MAP[enchantId]
  return def ? `${def.name} ${roman(level)}` : `${enchantId} ${roman(level)}`
}

export function levelText(enchantId: string, level: number): string {
  const step = levelStep(enchantId, level)
  if (!step) return '—'
  switch (enchantId) {
    case 'mending':
      return `auto-repairs ${step.chunk} durability under ${fmtPct(step.threshold ?? 0)} (${step.daily}/day)`
    case 'unbreaking':
      return `−${fmtPct(step.wear ?? 0)} durability wear`
    case 'sharpness':
      return `+${fmtPct(step.damagePct ?? 0)} outgoing damage`
    case 'protection':
      return `−${fmtPct(step.reductionPct ?? 0)} incoming damage`
    case 'efficiency':
      return `${fmtPct(step.chance ?? 0)} extra ore chance per mine`
    case 'looting':
      return `${fmtPct(step.chance ?? 0)} bonus drop roll per kill`
    default:
      return '—'
  }
}

export interface EnchantCarrier {
  equipped?: Record<string, string | null>
  enchants?: Record<string, Record<string, number>>
  enchantingBook?: { unlocked: boolean; unlockedAt?: number }
}

export function isEnchantableItem(item: GearDef | null | undefined): boolean {
  if (!item?.slot) return false
  const slot = physicalEquipmentSlot(item.slot)
  return ENCHANTS.some((e) => e.slots.includes(slot))
}

export function enchantLevel(
  player: EnchantCarrier | null | undefined,
  itemId: string,
  enchantId: string,
): number {
  const lv = player?.enchants?.[itemId]?.[enchantId]
  return Number.isFinite(lv) ? lv! : 0
}

function equippedSlotEnchantLevel(
  player: EnchantCarrier | null | undefined,
  slot: string,
  enchantId: string,
): number {
  const eq = player?.equipped
  if (!eq) return 0
  const itemId = equippedItemId(eq, slot)
  if (!itemId) return 0
  return enchantLevel(player, itemId, enchantId)
}

export function enchantBadge(player: EnchantCarrier | null | undefined, itemId: string): string {
  const map = player?.enchants?.[itemId]
  if (!map) return ''
  const parts = ENCHANTS.filter((def) => (map[def.id] ?? 0) > 0).map(
    (def) => `${def.icon} ${def.name} ${roman(map[def.id]!)}`,
  )
  return parts.length ? `✨ ${parts.join(' · ')}` : ''
}

/** Outgoing damage multiplier from the equipped weapon's Sharpness (1 when unenchanted). */
export function sharpnessMultiplier(player: EnchantCarrier | null | undefined): number {
  const lv = equippedSlotEnchantLevel(player, 'weapon', 'sharpness')
  const pct = levelStep('sharpness', lv)?.damagePct
  return 1 + (Number.isFinite(pct) ? pct! : 0)
}

/** Incoming damage multiplier from Protection across offhand/helmet/chestplate/boots. */
export function protectionMultiplier(player: EnchantCarrier | null | undefined): number {
  let total = 0
  for (const slot of ['offhand', 'helmet', 'chestplate', 'boots']) {
    const lv = equippedSlotEnchantLevel(player, slot, 'protection')
    const pct = levelStep('protection', lv)?.reductionPct
    if (Number.isFinite(pct)) total += pct!
  }
  return 1 - Math.min(MAX_PROTECTION, total)
}

/** Extra ore roll probability from the equipped tool's Efficiency. */
export function efficiencyChance(player: EnchantCarrier | null | undefined): number {
  const lv = equippedSlotEnchantLevel(player, 'tool', 'efficiency')
  const ch = levelStep('efficiency', lv)?.chance
  return Number.isFinite(ch) ? ch! : 0
}

/** Bonus second-chance drop probability from the equipped weapon's Looting. */
export function lootingChance(player: EnchantCarrier | null | undefined): number {
  const lv = equippedSlotEnchantLevel(player, 'weapon', 'looting')
  const ch = levelStep('looting', lv)?.chance
  return Number.isFinite(ch) ? ch! : 0
}

export interface EnchantPlayerFull extends EnchantCarrier {
  inventory: string[]
  wallet: { solars: number; [k: string]: number }
  battleState?: unknown
}

export interface EnchantOutcome {
  ok: boolean
  error?: string
  itemId?: string
  enchant?: EnchantDef
  newLevel?: number
  solarsSpent?: number
}

/** One-time purchase of the Enchanting Book (500,000 Solars). */
export function buyEnchantingBook(player: EnchantPlayerFull, now = Date.now()): EnchantOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot purchase the Enchanting Book during battle.' }
  }
  if (player.enchantingBook?.unlocked) {
    return { ok: false, error: 'You have already unlocked the Enchanting Book.' }
  }
  const solars = player.wallet?.solars ?? 0
  if (solars < ENCHANT_BOOK_SOLARS) {
    return {
      ok: false,
      error: `Need ☀️ ${ENCHANT_BOOK_SOLARS.toLocaleString()} Solars to unlock the Enchanting Book.`,
    }
  }
  player.wallet.solars = solars - ENCHANT_BOOK_SOLARS
  player.enchantingBook = { unlocked: true, unlockedAt: now }
  return { ok: true, solarsSpent: ENCHANT_BOOK_SOLARS }
}

/** List all unique enchantable items the player currently wears or carries. */
export function playerEnchantableItems(player: EnchantPlayerFull): GearDef[] {
  const ids = new Set<string>()
  for (const slot of PHYSICAL_EQUIPMENT_SLOTS) {
    const eqId = player.equipped ? equippedItemId(player.equipped, slot) : null
    if (eqId) ids.add(eqId)
  }
  for (const id of player.inventory ?? []) ids.add(id)

  const out: GearDef[] = []
  for (const id of ids) {
    const def = gearMap[id]
    if (def && isEnchantableItem(def)) out.push(def)
  }
  return out
}

/** Upgrade `enchantId` by +1 level on `itemId`, consuming materials + ENCHANT_SOLARS. */
export function applyItemEnchant(
  player: EnchantPlayerFull,
  itemId: string,
  enchantId: string,
): EnchantOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot enchant gear during an active battle.' }
  }
  if (!player.enchantingBook?.unlocked) {
    return { ok: false, error: 'Unlock the Enchanting Book first to use the Enchanting Table.' }
  }

  const item = gearMap[itemId]
  const enchant = ENCHANT_MAP[enchantId]
  if (!item || !enchant) {
    return { ok: false, error: 'Unknown item or enchantment.' }
  }

  const ownedOrWorn =
    (player.inventory ?? []).includes(itemId) ||
    PHYSICAL_EQUIPMENT_SLOTS.some((s) => equippedItemId(player.equipped ?? {}, s) === itemId)
  if (!ownedOrWorn) {
    return { ok: false, error: `You do not own ${item.name}.` }
  }

  const slot = item.slot ? physicalEquipmentSlot(item.slot) : ''
  if (!enchant.slots.includes(slot)) {
    return { ok: false, error: `${enchant.name} cannot be applied to ${item.name} (${slot}).` }
  }

  const curLevel = enchantLevel(player, itemId, enchantId)
  if (curLevel >= enchant.maxLevel) {
    return { ok: false, error: `${item.name} already has max ${levelName(enchantId, curLevel)}.` }
  }

  const nextLevel = curLevel + 1
  const reqs = enchant.cost[curLevel]?.items ?? []
  const counts = new Map<string, number>()
  for (const id of player.inventory ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)

  const missing: string[] = []
  for (const r of reqs) {
    const have = counts.get(r.itemId) ?? 0
    if (have < r.qty) {
      missing.push(`${gearMap[r.itemId]?.name ?? r.itemId} ×${r.qty - have}`)
    }
  }
  const solars = player.wallet?.solars ?? 0
  if (solars < ENCHANT_SOLARS) {
    missing.push(`☀️ ${(ENCHANT_SOLARS - Math.floor(solars)).toLocaleString()} more Solars`)
  }
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing materials for ${levelName(enchantId, nextLevel)}: ${missing.join(', ')}.`,
    }
  }

  for (const r of reqs) {
    for (let i = 0; i < r.qty; i++) {
      const idx = player.inventory.indexOf(r.itemId)
      if (idx !== -1) player.inventory.splice(idx, 1)
    }
  }
  player.wallet.solars = solars - ENCHANT_SOLARS
  player.enchants = player.enchants ?? {}
  player.enchants[itemId] = { ...(player.enchants[itemId] ?? {}), [enchantId]: nextLevel }

  return {
    ok: true,
    itemId,
    enchant,
    newLevel: nextLevel,
    solarsSpent: ENCHANT_SOLARS,
  }
}
