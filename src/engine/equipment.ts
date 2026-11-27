// Equipment — port of the bot's lib/equipment-slots.js, plugins/equip.js,
// plugins/unequip.js and combat-engine applyEquipmentBonus.
//
// V0 scope: 7 physical slots, legacy alias folding (relic/amulet → offhand,
// armor → chestplate), level/power gating, stat-bonus folding. Durability,
// full-armor suits and starter-set bonuses are data-less or V1 in this build
// (no items.json entry carries those fields) — the code paths are stubbed to
// the bot's null-set behavior.

import { characterMap, gearMap } from '../data/index'
import type { CharacterDef, GearDef, TotalStats } from '../data/types'
import { attackStatKey } from './stats'
import { recordTutorialEvent, type TutorialStateShape } from './tutorial'

/** The slots a character actually wears. `relic` is an alias, not a slot. */
export const PHYSICAL_EQUIPMENT_SLOTS = [
  'weapon',
  'offhand',
  'helmet',
  'chestplate',
  'boots',
  'accessory',
  'tool',
] as const

export type PhysicalSlot = (typeof PHYSICAL_EQUIPMENT_SLOTS)[number]

/** `relic`/`amulet` are the offhand; `armor` is the chestplate. */
export function physicalEquipmentSlot(slot: string): string {
  const key = String(slot ?? '').toLowerCase()
  if (key === 'relic' || key === 'amulet') return 'offhand'
  if (key === 'armor') return 'chestplate'
  return key
}

export interface EquipmentMap {
  [slot: string]: string | null
}

/** The item id in a physical slot, honouring the legacy offhand aliases. */
export function equippedItemId(equipped: EquipmentMap, slot: string): string | null {
  const key = physicalEquipmentSlot(slot)
  if (key === 'offhand') return equipped?.offhand ?? equipped?.relic ?? equipped?.amulet ?? null
  return equipped?.[key] ?? null
}

/** Empty a physical slot and every alias that could still point at it. */
export function clearEquipmentSlot(equipped: EquipmentMap, slot: string): void {
  if (!equipped || typeof equipped !== 'object') return
  const key = physicalEquipmentSlot(slot)
  if (key === 'offhand') {
    equipped.offhand = null
    equipped.relic = null
    equipped.amulet = null
    return
  }
  equipped[key] = null
}

/** Fold a preset/snapshot's equipment into physical slots (alias-safe). */
export function canonicalEquipmentMap(source: EquipmentMap = {}): EquipmentMap {
  const out: EquipmentMap = {}
  for (const slot of PHYSICAL_EQUIPMENT_SLOTS) {
    out[slot] = equippedItemId(source, slot)
  }
  return out
}

// ── Gating (lib/survival-progression.js) ────────────────────────────────────

/**
 * Power gate: big bonuses need a high level regardless of the item's own
 * levelReq. Tiers: core≥250/hp≥1000→60, ≥100/400→30, ≥40/150→15, else 1.
 */
export function gearRequiredLevel(item: Partial<GearDef>): number {
  const b = (item?.statBonuses ?? {}) as Record<string, number>
  const core = Math.max(...['str', 'agi', 'int', 'def', 'lck'].map((k) => Number(b[k]) || 0))
  const hp = Number(b.maxHp) || 0
  const powerGate =
    core >= 250 || hp >= 1000 ? 60 : core >= 100 || hp >= 400 ? 30 : core >= 40 || hp >= 150 ? 15 : 1
  return Math.max(item?.levelReq ?? 1, (item as { levelRequirement?: number })?.levelRequirement ?? 1, powerGate)
}

/**
 * Personal-floor count — exact port of survival-progression personalFloorKeys
 * for a save with no survivalProgress (V0): grandfather floors from
 * dungeonProgress as distinct `location:floor` keys, capped at 10 total.
 */
export function personalFloorCount(player: {
  dungeonProgress?: Record<string, { highestFloor: number }>
  survivalProgress?: { soloFloors?: Record<string, boolean>; personalFloorsVersion?: number }
}): number {
  const keys = new Set<string>()
  const progress = player?.survivalProgress ?? {}
  for (const [k, v] of Object.entries(progress.soloFloors ?? {})) {
    if (v === true) keys.add(k)
    if (keys.size >= 10) break
  }
  if (progress.personalFloorsVersion !== 1) {
    for (const [location, checkpoint] of Object.entries(player?.dungeonProgress ?? {})) {
      const highest = Number(checkpoint?.highestFloor)
      if (!Number.isSafeInteger(highest) || highest < 1) continue
      for (let floor = 1; floor <= Math.min(10, highest) && keys.size < 10; floor++) {
        keys.add(`${location}:${floor}`)
      }
      if (keys.size >= 10) break
    }
  }
  return [...keys].slice(0, 10).length
}

/** Level ≥20 and ≥10 personally cleared floors (bot's trade mastery). */
export function hasTradeMastery(player: {
  level: number
  dungeonProgress?: Record<string, { highestFloor: number }>
}): boolean {
  return (player?.level ?? 1) >= 20 && personalFloorCount(player) >= 10
}

/**
 * Job shifts toward preparation. Jobs are a V1 survival system, so the shift
 * half of the gate is collapsed to satisfied in V0 — the quest half below
 * still applies exactly as the bot writes it.
 */
export function preparationShifts(_player: unknown): number {
  return 3
}

/** At least one quest claimed ever (daily or milestone) — exact bot rule. */
export function preparationQuestClaimed(player: {
  quests?: { milestoneClaimed?: string[]; dailyClaimed?: string[] }
}): boolean {
  return (
    (player?.quests?.milestoneClaimed?.length ?? 0) > 0 ||
    (player?.quests?.dailyClaimed?.length ?? 0) > 0
  )
}

/**
 * Field preparation: 3 job shifts AND a quest claim. Jobs are a V1 system in
 * this build, so the shift half is collapsed to satisfied and the gate keeps
 * its quest half — a V0 player must have claimed a quest before attuning
 * level-30+ gear, exactly as a bot player who never worked would be blocked.
 */
export function preparationReady(player: {
  quests?: { milestoneClaimed?: string[]; dailyClaimed?: string[] }
}): boolean {
  return preparationShifts(player) >= 3 && preparationQuestClaimed(player)
}

/** Activation gate. Ownership is untouched — see bot survival-progression. */
export function gearRefusal(
  player: {
    level: number
    dungeonProgress?: Record<string, { highestFloor: number }>
    quests?: { milestoneClaimed?: string[]; dailyClaimed?: string[] }
  },
  item: GearDef,
): string | null {
  const required = gearRequiredLevel(item)
  if ((player?.level ?? 1) < required) {
    return `🔒 ${item.name} requires Level ${required} for combat attunement. You still own it.`
  }
  if (required >= 30 && !hasTradeMastery(player)) {
    return `🔒 ${item.name} requires 10 personally cleared dungeon floors before attunement.`
  }
  if (required >= 30 && !preparationReady(player)) {
    // Bot copy names .jobs/.work commands; browser wording keeps the same rule.
    return `🔒 ${item.name} needs field preparation: claim a quest first.`
  }
  return null
}

// ── Stat folding (combat-engine applyEquipmentBonus) ───────────────────────

export interface EquipmentPlayer {
  classId: string
  stats: Record<string, number>
  hp: number
  maxHp: number
  maxMp: number
  mp: number
}

/**
 * Fold an item's statBonuses in (sign +1) or out (sign −1) of the player's
 * live stats. `atk` folds into the class primary stat. maxMp clamps current MP.
 * The starter armor set bonus is a no-op in V0 data (no set pieces exist).
 */
export function applyEquipmentBonus(
  player: EquipmentPlayer,
  item: { slot?: string | null; statBonuses?: Partial<TotalStats & { atk: number }> },
  sign: 1 | -1,
): void {
  const b = (item?.statBonuses ?? {}) as Record<string, number>
  player.stats = player.stats ?? {}

  for (const key of ['str', 'agi', 'int', 'def', 'lck']) {
    if (b[key]) player.stats[key] = Math.max(0, (player.stats[key] ?? 0) + sign * b[key])
  }
  if (b.atk) {
    const key = attackStatKey(player)
    player.stats[key] = Math.max(0, (player.stats[key] ?? 0) + sign * b.atk)
  }
  if (b.maxHp) player.maxHp = Math.max(1, (player.maxHp ?? 0) + sign * b.maxHp)
  if (b.maxMp) {
    player.maxMp = Math.max(0, (player.maxMp ?? 0) + sign * b.maxMp)
    player.mp = Math.min(player.mp ?? player.maxMp, player.maxMp)
  }
  // V0: no starter armor sets in items.json → only clamp HP into range.
  player.hp = Math.min(player.hp ?? player.maxHp, player.maxHp)
}

// ── Equip / unequip (plugins/equip.js, plugins/unequip.js) ────────────────

export interface EquipmentPlayerFull extends EquipmentPlayer {
  level: number
  inventory: string[]
  equipped: Record<string, string | null>
  dungeonProgress?: Record<string, { highestFloor: number }>
}

export interface EquipOutcome {
  ok: boolean
  error?: string
  /** Names of items returned to the inventory by the swap. */
  replaced?: string[]
  slot?: string
  itemId?: string
}

function findInInventory(inventory: string[], query: string): string | null {
  const q = query.toLowerCase().trim()
  if (inventory.includes(q)) return q
  for (const id of inventory) {
    const item = gearMap[id]
    if (item && item.name.toLowerCase().includes(q)) return id
  }
  return null
}

/**
 * Equip one inventory item into its slot (partial name or exact id).
 * Mirrors plugins/equip.js: refusals → levelReq → gearRefusal → swap →
 * applyEquipmentBonus(+1). V0 skips durability and full-armor suits (no data).
 */
export function equipItem(player: EquipmentPlayerFull, query: string): EquipOutcome {
  const foundId = findInInventory(player.inventory ?? [], query)
  if (!foundId) {
    return { ok: false, error: `❌ "${query}" not found in your inventory.` }
  }
  const item = gearMap[foundId]
  if (!item) {
    return { ok: false, error: `❌ Item data for *${foundId}* is missing.` }
  }
  if (item.type === 'consumable') {
    return { ok: false, error: `❌ ${item.name} is a consumable — it can't be equipped.` }
  }
  if (item.type === 'material') {
    return { ok: false, error: `❌ ${item.name} is a crafting material — it can't be equipped.` }
  }

  const slot = item.slot === 'relic' ? 'offhand' : item.slot
  if (!slot) {
    return { ok: false, error: `❌ Don't know how to equip item type "${item.type}".` }
  }
  if (player.level < item.levelReq) {
    return {
      ok: false,
      error: `❌ You need to be level ${item.levelReq} to equip ${item.name}. You are level ${player.level}.`,
    }
  }
  const refusal = gearRefusal(player, item)
  if (refusal) return { ok: false, error: refusal }

  const idx = player.inventory.indexOf(foundId)
  if (idx === -1) return { ok: false, error: `❌ ${item.name} is no longer in your inventory.` }

  const replaced: string[] = []
  const equipped = player.equipped

  // Vacate the target slot (and the offhand's legacy aliases).
  const existing = equippedItemId(equipped, slot)
  if (existing) {
    applyEquipmentBonus(player, gearMap[existing] ?? {}, -1)
    replaced.push(gearMap[existing]?.name ?? existing)
    player.inventory.push(existing)
    clearEquipmentSlot(equipped, slot)
  }

  player.inventory.splice(player.inventory.indexOf(foundId), 1)
  equipped[slot] = foundId
  if (slot === 'offhand') equipped.relic = null
  applyEquipmentBonus(player, { ...item, slot }, +1)

  return { ok: true, replaced, slot, itemId: foundId }
}

/** Unequip a physical slot back into the inventory. */
export function unequipSlot(player: EquipmentPlayerFull, rawSlot: string): EquipOutcome {
  const slot = physicalEquipmentSlot(rawSlot)
  if (!(PHYSICAL_EQUIPMENT_SLOTS as readonly string[]).includes(slot)) {
    return { ok: false, error: `❌ "${rawSlot}" is not a valid slot.` }
  }
  const current = equippedItemId(player.equipped, slot)
  if (!current) return { ok: false, error: `❌ Your ${slot} slot is already empty.` }

  const item = gearMap[current]
  applyEquipmentBonus(player, item ?? {}, -1)
  player.inventory.push(current)
  clearEquipmentSlot(player.equipped, slot)
  return { ok: true, itemId: current, slot }
}

// ── Character Companion Equip / Unequip (plugins/character.js) ──────────────

export interface CharacterEquipPlayer extends EquipmentPlayer {
  ownedCharacters: string[]
  equippedCharacter: string | null
  characterBonusApplied?: string | null
  wallet?: Record<string, number>
  tutorial?: TutorialStateShape
}

export interface CharacterEquipOutcome {
  ok: boolean
  error?: string
  character?: CharacterDef | null
}

/**
 * Idempotently ensure a save whose `equippedCharacter` was set before character
 * stat folding existed has its active character's `statBonuses` applied once.
 */
export function syncEquippedCharacterBonus(player: CharacterEquipPlayer): void {
  const activeId = player.equippedCharacter ?? null
  const appliedId = player.characterBonusApplied ?? null
  if (activeId === appliedId) return

  if (appliedId) {
    const oldDef = characterMap[appliedId]
    if (oldDef?.statBonuses) applyEquipmentBonus(player, oldDef, -1)
  }
  if (activeId) {
    const newDef = characterMap[activeId]
    if (newDef?.statBonuses) applyEquipmentBonus(player, newDef, +1)
  }
  player.characterBonusApplied = activeId
}

/**
 * Equip or unequip an owned character companion (port of plugins/character.js):
 *  - Swaps outgoing/incoming `statBonuses` via `applyEquipmentBonus`.
 *  - Fires `character_claimed` tutorial step on equip.
 */
export function equipCharacter(
  player: CharacterEquipPlayer,
  charId: string | null,
): CharacterEquipOutcome {
  syncEquippedCharacterBonus(player)

  if (!charId) {
    const prevId = player.equippedCharacter
    if (!prevId) return { ok: true, character: null }
    const oldDef = characterMap[prevId]
    if (oldDef?.statBonuses) applyEquipmentBonus(player, oldDef, -1)
    player.equippedCharacter = null
    player.characterBonusApplied = null
    return { ok: true, character: null }
  }

  if (!(player.ownedCharacters ?? []).includes(charId)) {
    return { ok: false, error: 'You do not own that character.' }
  }
  const nextDef = characterMap[charId]
  if (!nextDef) {
    return { ok: false, error: `Unknown character "${charId}".` }
  }
  if (player.equippedCharacter === charId) {
    return { ok: true, character: nextDef }
  }

  const prevId = player.equippedCharacter
  if (prevId) {
    const oldDef = characterMap[prevId]
    if (oldDef?.statBonuses) applyEquipmentBonus(player, oldDef, -1)
  }
  if (nextDef.statBonuses) applyEquipmentBonus(player, nextDef, +1)
  player.equippedCharacter = charId
  player.characterBonusApplied = charId
  if (player.tutorial && player.wallet) {
    recordTutorialEvent(
      player as CharacterEquipPlayer & { wallet: Record<string, number>; tutorial: TutorialStateShape },
      'character_claimed',
    )
  }
  return { ok: true, character: nextDef }
}

/** Format a character's statBonuses for Roster / HUD badges. */
export function describeCharacterBonuses(char: Pick<CharacterDef, 'statBonuses' | 'combat'>): string {
  const b = char.statBonuses ?? {}
  const parts: string[] = []
  if (b.atk) parts.push(`ATK+${b.atk}`)
  if (b.str) parts.push(`STR+${b.str}`)
  if (b.agi) parts.push(`AGI+${b.agi}`)
  if (b.int) parts.push(`INT+${b.int}`)
  if (b.def) parts.push(`DEF+${b.def}`)
  if (b.lck) parts.push(`LCK+${b.lck}`)
  if (b.maxHp) parts.push(`HP+${b.maxHp}`)
  if (b.maxMp) parts.push(`MP+${b.maxMp}`)
  if (parts.length > 0) return parts.join(' · ')
  return `Duel ATK ${char.combat.atk} · DEF ${char.combat.def} · AGI ${char.combat.agi}`
}
