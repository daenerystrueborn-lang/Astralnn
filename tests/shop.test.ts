import { describe, expect, it } from 'vitest'
import {
  BOSS_POTION_LIMIT,
  buyShopItem,
  isBossPotion,
  sellInventoryItem,
  shopArmor,
  shopPotions,
  shopWeapons,
  useConsumable,
} from '../src/engine/shop'
import { playerAction, startBattle } from '../src/engine/battle'
import { createNewPlayer } from '../src/state/player'

const NOW = new Date('2026-11-26T12:00:00Z').getTime()

function seq(...values: number[]): () => number {
  let i = 0
  return () => Math.max(0, Math.min(0.999999, values[Math.min(i++, values.length - 1)] ?? 1))
}

describe('shop catalog & buy/sell (plugins/shop.js parity)', () => {
  it('populates non-empty shelves for potions, weapons, and armor', () => {
    expect(shopPotions.length).toBeGreaterThan(10)
    expect(shopWeapons.length).toBeGreaterThan(20)
    expect(shopArmor.length).toBeGreaterThan(20)
  })

  it('buys potions in bulk, enforces levelReq & Solars balance, and blocks mid-battle gear buys', () => {
    const p = createNewPlayer({ name: 'Astra', classId: 'warrior', raceId: 'human' }, NOW)
    p.wallet.solars = 200

    const bought = buyShopItem(p, 'health_potion', 3)
    expect(bought.ok).toBe(true)
    expect(bought.totalCost).toBe(60)
    expect(p.wallet.solars).toBe(140)
    expect(p.inventory.filter((id) => id === 'health_potion').length).toBeGreaterThanOrEqual(3)

    // Poor check
    expect(buyShopItem(p, 'health_potion', 50).ok).toBe(false)

    // Level-gated weapon refused at Lv 1
    const highWeapon = shopWeapons.find((w) => w.levelReq >= 20)!
    p.wallet.solars = 999999
    expect(buyShopItem(p, highWeapon.id, 1).ok).toBe(false)

    // Mid-battle rule: gear blocked, potions allowed
    p.battleState = { status: 'active' }
    const lv1Armor = shopArmor.find((a) => (a.levelReq ?? 1) <= 1)!
    expect(buyShopItem(p, lv1Armor.id, 1).ok).toBe(false)
    expect(buyShopItem(p, 'mana_potion', 1).ok).toBe(true)
  })

  it('sells owned items for sellPrice and blocks unsellable ghostblade', () => {
    const p = createNewPlayer({ name: 'Astra', classId: 'warrior', raceId: 'human' }, NOW)
    p.inventory.push('health_potion', 'health_potion', 'ghostblade')
    const before = p.wallet.solars
    const sold = sellInventoryItem(p, 'health_potion', 2)
    expect(sold.ok).toBe(true)
    expect(sold.earned).toBe(16)
    expect(p.wallet.solars).toBe(before + 16)

    expect(sellInventoryItem(p, 'ghostblade', 1).ok).toBe(false)
  })
})

describe('consumables & boss potion allowance (plugins/use.js + boss-potions.js)', () => {
  it('heals HP/MP, refuses wasting when already full, and tracks consumable_used', () => {
    const p = createNewPlayer({ name: 'Astra', classId: 'mage', raceId: 'elf' }, NOW)
    p.inventory.push('health_potion', 'mana_potion')

    // Full HP → refuses without consuming
    const countBefore = p.inventory.filter((x) => x === 'health_potion').length
    expect(useConsumable(p, 'health_potion').ok).toBe(false)
    expect(p.inventory.filter((x) => x === 'health_potion').length).toBe(countBefore)

    // Injured → heals & consumes 1
    p.hp = p.maxHp - 30
    const used = useConsumable(p, 'health_potion')
    expect(used.ok).toBe(true)
    expect(p.hp).toBe(p.maxHp)
    expect(p.quests.lifetime.consumable_used).toBe(1)
  })

  it('enforces BOSS_POTION_LIMIT = 7 and blocks non-drink consumables during boss fights', () => {
    const p = createNewPlayer({ name: 'Astra', classId: 'warrior', raceId: 'human' }, NOW)
    const session = startBattle('newbie_hollow', 50)
    expect(session.enemy.isBoss).toBe(true)

    p.inventory.push('burn_salve')
    expect(isBossPotion({ id: 'burn_salve', type: 'consumable', effect: { type: 'cure', targets: ['burn'] } })).toBe(false)
    expect(useConsumable(p, 'burn_salve', session).ok).toBe(false)

    // Drink 7 potions, 8th is refused
    for (let i = 0; i < BOSS_POTION_LIMIT + 1; i++) p.inventory.push('health_potion')
    for (let i = 0; i < BOSS_POTION_LIMIT; i++) {
      p.hp = 10
      const ok = useConsumable(p, 'health_potion', session)
      expect(ok.ok).toBe(true)
    }
    p.hp = 10
    const eighth = useConsumable(p, 'health_potion', session)
    expect(eighth.ok).toBe(false)
    expect(eighth.error).toContain('7 potions')
  })

  it('combat tonics (Barrier, Warcry, Regen) modify live battle rounds and Bare Hands tracks no_item_clear', () => {
    const p = createNewPlayer({ name: 'Astra', classId: 'warrior', raceId: 'human' }, NOW)
    p.maxHp = 500
    p.hp = 400
    p.inventory.push('barrier_tonic', 'warcry_tonic', 'regen_herb')
    const session = startBattle('newbie_hollow', 1, () => 0.999)
    session.enemy.hp = 500
    session.enemy.atk = 40

    // Drink all three before swinging (free actions)
    expect(useConsumable(p, 'barrier_tonic', session).ok).toBe(true)
    expect(useConsumable(p, 'warcry_tonic', session).ok).toBe(true)
    expect(useConsumable(p, 'regen_herb', session).ok).toBe(true)
    expect(session.playerShield).toBe(120)
    expect(session.warcry?.hits).toBe(3)

    // Swing: player hits (0, no crit 1), enemy hits (0, var 0.5) → absorbed by barrier, then regen heals +25 HP!
    playerAction(p, session, { kind: 'attack' }, seq(0, 1, 0, 0.5))
    expect(session.warcry?.hits).toBe(2)
    expect(session.playerShield).toBeLessThan(120)
    expect(p.hp).toBe(425) // barrier absorbed enemy hit + regen restored 25

    // Bare Hands: beating a boss WITHOUT consumables increments no_item_clear
    const p2 = createNewPlayer({ name: 'BareHands', classId: 'warrior', raceId: 'human' }, NOW)
    const bossSession = startBattle('newbie_hollow', 50)
    bossSession.enemy.hp = 1
    bossSession.enemy.def = 0
    playerAction(p2, bossSession, { kind: 'attack' }, seq(0, 1, 1))
    expect(p2.quests.lifetime.no_item_clear).toBe(1)
  })
})
