// Shop, Sell & Consumables — pure engine port of lib/shop-catalog.js,
// plugins/shop.js (handleBuy / handleSell), plugins/use.js, and
// lib/boss-potions.js (BOSS_POTION_LIMIT = 7).

import { gearMap, items, tools, weapons } from '../data/index'
import type { GearDef, ItemEffectDef } from '../data/types'
import { recordQuestEvent, type QuestStateShape } from './quests'

// ── Catalog (lib/shop-catalog.js) ──────────────────────────────────────────

function byLevelThenPrice(a: GearDef, b: GearDef): number {
  const lv = (a.levelReq ?? 1) - (b.levelReq ?? 1)
  if (lv !== 0) return lv
  return (a.buyPrice ?? 0) - (b.buyPrice ?? 0)
}

/** Buyable Solars weapons (excludes season/guild-bound items, exact bot rule). */
export const shopWeapons: GearDef[] = weapons
  .filter((w) => typeof w.buyPrice === 'number' && w.buyPrice > 0 && !w.seasonId && !w.guildBound)
  .sort(byLevelThenPrice)

/** Buyable Solars armor & offhand/relic items. */
export const shopArmor: GearDef[] = items
  .filter(
    (i) =>
      typeof i.buyPrice === 'number' &&
      i.buyPrice > 0 &&
      i.type !== 'consumable' &&
      !i.seasonId &&
      !i.guildBound,
  )
  .sort(byLevelThenPrice)

/** Buyable Solars consumables (potions, tonics, draughts, cures, elixirs). */
export const shopPotions: GearDef[] = items
  .filter(
    (i) =>
      typeof i.buyPrice === 'number' &&
      i.buyPrice > 0 &&
      i.type === 'consumable' &&
      !i.seasonId &&
      !i.guildBound,
  )
  .sort((a, b) => (a.buyPrice ?? 0) - (b.buyPrice ?? 0))

/** Buyable Solars tools (pickaxes from tools.json). */
export const shopTools: GearDef[] = tools
  .filter((t) => typeof t.buyPrice === 'number' && t.buyPrice > 0)
  .sort(byLevelThenPrice)

export interface ShopPlayer {
  level: number
  wallet: { solars: number; gems?: number }
  inventory: string[]
  battleState?: unknown
}

export interface BuyOutcome {
  ok: boolean
  error?: string
  item?: GearDef
  qty?: number
  totalCost?: number
}

export function buyShopItem(player: ShopPlayer, itemId: string, qty = 1): BuyOutcome {
  const count = Math.max(1, Math.min(99, Math.floor(Number(qty) || 1)))
  const item = gearMap[itemId]
  if (!item || typeof item.buyPrice !== 'number' || item.buyPrice <= 0 || item.guildBound || item.seasonId) {
    return { ok: false, error: `❌ "${itemId}" is not sold in the town shop.` }
  }
  // Mid-battle rule from plugins/shop.js:739 — only potions may be bought mid-fight.
  if (player.battleState && item.type !== 'consumable') {
    return { ok: false, error: `⚔️ You're mid-battle — only potions can be bought right now.` }
  }
  const req = item.levelReq ?? 1
  if (player.level < req) {
    return {
      ok: false,
      error: `❌ ${item.name} requires Level ${req}. You are Level ${player.level}.`,
    }
  }
  const totalCost = Math.max(0, Math.round(item.buyPrice * count))
  const solars = player.wallet?.solars ?? 0
  if (solars < totalCost) {
    return {
      ok: false,
      error: `❌ Not enough Solars! ${item.name}${count > 1 ? ` ×${count}` : ''} costs ☀️ ${totalCost} (you have ☀️ ${Math.floor(solars)}).`,
    }
  }

  player.wallet.solars = solars - totalCost
  for (let i = 0; i < count; i++) player.inventory.push(item.id)
  return { ok: true, item, qty: count, totalCost }
}

export interface SellOutcome {
  ok: boolean
  error?: string
  item?: GearDef
  qty?: number
  earned?: number
}

export function sellInventoryItem(player: ShopPlayer, itemId: string, qty = 1): SellOutcome {
  const item = gearMap[itemId]
  if (
    !item ||
    !(Number(item.sellPrice) > 0) ||
    item.exclusive ||
    item.starterPackExclusive ||
    item.id === 'ghostblade'
  ) {
    return { ok: false, error: `❌ "${item?.name ?? itemId}" cannot be sold here.` }
  }
  const bag = player.inventory ?? []
  const owned = bag.filter((id) => id === item.id).length
  if (owned === 0) {
    return { ok: false, error: `❌ You don't have any ${item.name} to sell.` }
  }
  const sellQty = Math.max(1, Math.min(owned, Math.floor(Number(qty) || 1)))
  let toRemove = sellQty
  for (let i = bag.length - 1; i >= 0 && toRemove > 0; i--) {
    if (bag[i] === item.id) {
      bag.splice(i, 1)
      toRemove--
    }
  }
  const earned = Math.round(item.sellPrice * sellQty)
  player.wallet.solars = (player.wallet?.solars ?? 0) + earned
  return { ok: true, item, qty: sellQty, earned }
}

// ── Boss Potion Allowance (lib/boss-potions.js) ────────────────────────────

export const BOSS_POTION_LIMIT = 7

const DRINKABLE_EFFECTS = new Set([
  'heal', 'cure', 'regen', 'strengthen', 'shield', 'damage_boost',
  'damage_reduction', 'warcry', 'ironskin', 'sleep_ward', 'decay_cure',
  'prevent_death', 'restore_pp',
])

const NOT_DRINKS = new Set([
  'phoenix_down', 'burn_salve', 'warm_cloth', 'smelling_salts',
  'focus_vial', 'cracked_warplate', 'honed_whetstone', 'revival_stone',
  'revival_drink',
])

export function isBossPotion(item?: Partial<GearDef> | null): boolean {
  if (!item || item.type !== 'consumable' || (item.id && NOT_DRINKS.has(item.id))) return false
  const effects = Array.isArray(item.effect) ? item.effect : item.effect ? [item.effect] : []
  return effects.length > 0 && effects.every((eff) => DRINKABLE_EFFECTS.has(String(eff?.type ?? '')))
}

export function bossPotionsRemaining(session?: { bossPotionUses?: number } | null): number {
  const used = Math.max(0, Math.floor(Number(session?.bossPotionUses) || 0))
  return Math.max(0, BOSS_POTION_LIMIT - used)
}

// ── Consumable Use (plugins/use.js) ────────────────────────────────────────

export interface ConsumableSession {
  status: 'active' | 'won' | 'lost'
  enemy: { isBoss: boolean; name: string }
  bossPotionUses?: number
  usedConsumable?: boolean
  playerShield?: number
  warcry?: { percent: number; hits: number } | null
  ironskin?: { percent: number; hits: number } | null
  statBuffs?: Record<string, { value: number; remaining: number }>
  regen?: { stat: 'hp' | 'mp'; amount: number; remaining: number } | null
}

export interface ConsumablePlayer {
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  inventory: string[]
  quests: QuestStateShape
}

export interface UseOutcome {
  ok: boolean
  error?: string
  item?: GearDef
  lines?: string[]
  bossPotionsLeft?: number | null
}

export function describeConsumable(item: Partial<GearDef>): string {
  const list: ItemEffectDef[] = Array.isArray(item.effect)
    ? item.effect
    : item.effect
      ? [item.effect]
      : []
  if (!list.length) return item.description ?? 'Consumable'
  return list
    .map((e) => {
      if (e.type === 'heal') {
        const amt = Number(e.amount) >= 99999 ? 'FULL' : `+${e.amount}`
        return `${amt} ${(e.stat ?? 'hp').toUpperCase()}`
      }
      if (e.type === 'shield') return `🛡️ +${e.amount} Barrier`
      if (e.type === 'warcry') return `🔥 +${e.percent}% DMG (${e.hits} hits)`
      if (e.type === 'ironskin') return `🪨 -${e.percent}% DMG taken (${e.hits} hits)`
      if (e.type === 'strengthen') return `+${e.value ?? e.amount} ${(e.stat ?? '').toUpperCase()} (${e.duration}t)`
      if (e.type === 'regen') return `+${e.amount} ${(e.stat ?? 'hp').toUpperCase()}/t (${e.duration}t)`
      if (e.type === 'cure') return `Cure ${Array.isArray(e.targets) ? e.targets.join('/') : e.targets ?? 'status'}`
      return e.type
    })
    .join(' · ')
}

/** True when an item has an in-game effect supported in V0/V1 combat or camp. */
export function isUsableConsumable(item?: Partial<GearDef> | null, inBattle = false): boolean {
  if (!item || item.type !== 'consumable' || !item.effect) return false
  const list = Array.isArray(item.effect) ? item.effect : [item.effect]
  return list.some((e) => {
    if (e.type === 'heal' || e.type === 'cure' || e.type === 'sleep_ward' || e.type === 'decay_cure') {
      return true
    }
    if (inBattle && ['shield', 'warcry', 'ironskin', 'strengthen', 'regen'].includes(e.type)) {
      return true
    }
    return false
  })
}

export function useConsumable(
  player: ConsumablePlayer,
  itemId: string,
  session?: ConsumableSession | null,
): UseOutcome {
  const bag = player.inventory ?? []
  const idx = bag.indexOf(itemId)
  if (idx === -1) return { ok: false, error: `❌ You don't have "${itemId}" in your bag.` }

  const item = gearMap[itemId]
  if (!item || item.type !== 'consumable' || !item.effect) {
    return { ok: false, error: `❌ ${item?.name ?? itemId} cannot be used.` }
  }

  const activeBattle = Boolean(session && session.status === 'active')
  const bossFight = Boolean(activeBattle && session?.enemy?.isBoss)
  if (bossFight) {
    if (!isBossPotion(item)) {
      return {
        ok: false,
        error: `⚠️ During a boss fight, only drinkable potions are allowed (up to ${BOSS_POTION_LIMIT} per boss).`,
      }
    }
    if (bossPotionsRemaining(session) <= 0) {
      return {
        ok: false,
        error: `⚠️ You have used all ${BOSS_POTION_LIMIT} potions allowed in this boss fight.`,
      }
    }
  }

  const effects = Array.isArray(item.effect) ? item.effect : [item.effect]
  const snap = {
    hp: player.hp,
    mp: player.mp,
    shield: session?.playerShield,
    warcry: session?.warcry ? { ...session.warcry } : session?.warcry,
    ironskin: session?.ironskin ? { ...session.ironskin } : session?.ironskin,
    regen: session?.regen ? { ...session.regen } : session?.regen,
    statBuffs: session?.statBuffs ? JSON.parse(JSON.stringify(session.statBuffs)) : session?.statBuffs,
  }

  const lines: string[] = []
  let anyChanged = false

  for (const eff of effects) {
    if (eff.type === 'heal') {
      const stat = eff.stat === 'mp' ? 'mp' : 'hp'
      const max = stat === 'mp' ? player.maxMp : player.maxHp
      const before = player[stat]
      const amt = Math.max(0, Number(eff.amount) || 0)
      player[stat] = Math.min(max, before + amt)
      const gained = player[stat] - before
      if (gained > 0) anyChanged = true
      lines.push(
        stat === 'mp'
          ? `💙 +${gained} MP (${player.mp}/${player.maxMp})`
          : `❤️ +${gained} HP (${player.hp}/${player.maxHp})`,
      )
      continue
    }

    if (eff.type === 'cure' || eff.type === 'sleep_ward' || eff.type === 'decay_cure') {
      anyChanged = true
      lines.push(`✨ ${item.name} cleanses lingering ailments.`)
      continue
    }

    if (!activeBattle || !session) {
      // Restore snapshot and refuse contextual combat-only tonics outside battle.
      player.hp = snap.hp
      player.mp = snap.mp
      return { ok: false, error: `⚠️ Drink ${item.name} during battle so its combat effect applies.` }
    }

    if (eff.type === 'shield') {
      const amt = Math.max(1, Math.round(Number(eff.amount) || 0))
      session.playerShield = (session.playerShield ?? 0) + amt
      anyChanged = true
      lines.push(`🛡️ Barrier +${amt} (${session.playerShield} total).`)
      continue
    }

    if (eff.type === 'warcry') {
      const percent = Math.max(1, Number(eff.percent) || 20)
      const hits = Math.max(1, Number(eff.hits) || 3)
      session.warcry = { percent, hits }
      anyChanged = true
      lines.push(`🔥 Warcry: +${percent}% damage on next ${hits} landed hits!`)
      continue
    }

    if (eff.type === 'ironskin') {
      const percent = Math.max(1, Number(eff.percent) || 30)
      const hits = Math.max(1, Number(eff.hits) || 3)
      session.ironskin = { percent, hits }
      anyChanged = true
      lines.push(`🪨 Ironskin: -${percent}% incoming damage on next ${hits} hits!`)
      continue
    }

    if (eff.type === 'strengthen') {
      const stat = String(eff.stat ?? 'str')
      const val = Math.max(1, Number(eff.value ?? eff.amount) || 8)
      const dur = Math.max(1, Number(eff.duration) || 3)
      session.statBuffs = session.statBuffs ?? {}
      const prev = session.statBuffs[stat]
      session.statBuffs[stat] = {
        value: Math.max(val, prev?.value ?? 0),
        remaining: dur,
      }
      anyChanged = true
      lines.push(`✨ +${val} ${stat.toUpperCase()} for ${dur} turns!`)
      continue
    }

    if (eff.type === 'regen') {
      const stat = eff.stat === 'mp' ? 'mp' : 'hp'
      const amt = Math.max(1, Number(eff.amount) || 25)
      const dur = Math.max(1, Number(eff.duration) || 4)
      session.regen = { stat, amount: amt, remaining: dur }
      anyChanged = true
      lines.push(`💚 Regen: +${amt} ${stat.toUpperCase()}/turn for ${dur} turns.`)
      continue
    }

    // Unsupported niche V2 effect (mend/affinity scroll/starter chest)
    player.hp = snap.hp
    player.mp = snap.mp
    if (session) {
      session.playerShield = snap.shield
      session.warcry = snap.warcry
      session.ironskin = snap.ironskin
      session.regen = snap.regen
      session.statBuffs = snap.statBuffs
    }
    return { ok: false, error: `⚠️ ${item.name} cannot be used yet.` }
  }

  if (!anyChanged) {
    return { ok: false, error: `⚠️ Already at full strength — ${item.name} was not spent.` }
  }

  bag.splice(idx, 1)
  recordQuestEvent(player, 'consumable_used', 1)
  let bossPotionsLeft: number | null = null
  if (activeBattle && session) {
    session.usedConsumable = true
    if (bossFight) {
      session.bossPotionUses = Math.min(BOSS_POTION_LIMIT, (session.bossPotionUses ?? 0) + 1)
      bossPotionsLeft = bossPotionsRemaining(session)
    }
  }

  return { ok: true, item, lines, bossPotionsLeft }
}
