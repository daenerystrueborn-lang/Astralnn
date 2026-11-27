import { describe, expect, it } from 'vitest'
import { createNewPlayer } from '../src/state/player'
import { gearMap } from '../src/data'
import { refreshAchievements } from '../src/engine/achievements'
import { calcPlayerDamage, rollDrops } from '../src/engine/combat'
import { equipItem } from '../src/engine/equipment'
import {
  ENCHANT_BOOK_SOLARS,
  ENCHANT_MAP,
  ENCHANT_SOLARS,
  MAX_PROTECTION,
  applyItemEnchant,
  buyEnchantingBook,
  enchantBadge,
  protectionMultiplier,
  sharpnessMultiplier,
} from '../src/engine/enchant'
import {
  FISH_COOLDOWN_MS,
  MINE_STAMINA_COST,
  castFishingLine,
  getFishBucketSummary,
  mineOre,
  sellFishBucket,
} from '../src/engine/gather'
import { shopTools } from '../src/engine/shop'
import { depositToVault, getVaultBalance, withdrawFromVault } from '../src/engine/vault'

describe('Enchanting, Mining, Fishing & Astral Vault', () => {
  it('resolves every enchantment reagent in gearMap and unlocks + imbues Sharpness/Protection/Looting', () => {
    for (const enc of Object.values(ENCHANT_MAP)) {
      for (const tier of enc.cost) {
        for (const req of tier.items) {
          expect(gearMap[req.itemId], `missing reagent ${req.itemId} for ${enc.id}`).toBeDefined()
        }
      }
    }

    const p = createNewPlayer({ name: 'Runesmith', classId: 'warrior', raceId: 'human' }, 1_000)
    p.wallet.solars = ENCHANT_BOOK_SOLARS + ENCHANT_SOLARS * 2
    p.inventory.push('iron_sword', 'iron_ore', 'iron_ore', 'iron_ore', 'iron_ore', 'monster_fang')
    equipItem(p as never, 'iron_sword')

    const baseDmg = calcPlayerDamage(p, null, 1, 0, () => 0.99).rawDmg

    const bookRes = buyEnchantingBook(p, 2_000)
    expect(bookRes.ok).toBe(true)
    expect(p.enchantingBook?.unlocked).toBe(true)

    const encRes = applyItemEnchant(p, 'iron_sword', 'sharpness')
    expect(encRes.ok).toBe(true)
    expect(encRes.newLevel).toBe(1)
    expect(sharpnessMultiplier(p)).toBeCloseTo(1.04, 5)
    expect(enchantBadge(p, 'iron_sword')).toContain('Sharpness I')

    // Boost STR so +4% crosses integer floor cleanly
    p.stats.str = 100
    const unenchanted = calcPlayerDamage({ ...p, enchants: {} }, null, 1, 0, () => 0.99).rawDmg
    const enchanted = calcPlayerDamage(p, null, 1, 0, () => 0.99).rawDmg
    expect(enchanted).toBeGreaterThan(unenchanted)
    void baseDmg

    // Protection clamps at MAX_PROTECTION (35%) even across 4 x Lv4 pieces (48%)
    p.equipped = {
      ...p.equipped,
      offhand: 'wooden_shield',
      helmet: 'leather_cap',
      chestplate: 'leather_vest',
      boots: 'leather_boots',
    }
    p.enchants = {
      ...p.enchants,
      wooden_shield: { protection: 4 },
      leather_cap: { protection: 4 },
      leather_vest: { protection: 4 },
      leather_boots: { protection: 4 },
    }
    expect(protectionMultiplier(p)).toBeCloseTo(1 - MAX_PROTECTION, 5)

    // Looting gives failed drop rolls a second chance without inventing 0-chance loot
    p.enchants.iron_sword = { looting: 3 } // 25% second roll
    const rolls = [0.95, 0.1] // first roll fails 10% chance, second roll (< 0.25) hits!
    let idx = 0
    const dropped = rollDrops(
      [
        { itemId: 'iron_ore', chance: 0.1 },
        { itemId: 'never_drops', chance: 0 },
      ],
      () => rolls[idx++] ?? 0.99,
      p,
    )
    expect(dropped).toEqual(['iron_ore'])
  })

  it('equips pickaxes from shopTools and mines dungeon ores with stamina + Efficiency', () => {
    expect(shopTools.length).toBeGreaterThanOrEqual(5)
    const p = createNewPlayer({ name: 'Delver', classId: 'warrior', raceId: 'dwarf' }, 10_000)

    // Without a pickaxe equipped, mining refuses cleanly
    expect(mineOre(p, 10_000).ok).toBe(false)

    p.inventory.push('wooden_pickaxe')
    const eq = equipItem(p as never, 'wooden_pickaxe')
    expect(eq.ok).toBe(true)
    expect(p.equipped.tool).toBe('wooden_pickaxe')

    p.enchants = { wooden_pickaxe: { efficiency: 3 } }
    const res = mineOre(p, 20_000, () => 0.05)
    expect(res.ok).toBe(true)
    expect(res.staminaAfter).toBe(30 - MINE_STAMINA_COST)
    expect(res.efficiencyExtra).toBe(1)
    expect(p.inventory.length).toBeGreaterThanOrEqual(2)
    expect(p.quests.lifetime.mine).toBe(1)

    // Cooldown prevents instant double-swing within 5s
    expect(mineOre(p, 22_000).ok).toBe(false)
  })

  it('casts a fishing line with spot-calling and sells the bucket for Solars', () => {
    const p = createNewPlayer({ name: 'Angler', classId: 'mage', raceId: 'elf' }, 50_000)
    const startSolars = p.wallet.solars

    // Deterministic RNG -> first fish (minnow, diff 1 -> 2 slots), winningSpot = 1
    const cast = castFishingLine(p, 1, 50_000, () => 0)
    expect(cast.ok).toBe(true)
    expect(cast.caught).toBe(true)
    expect(cast.fish?.id).toBe('minnow')
    expect(p.quests.lifetime.fish).toBe(1)

    // Cooldown blocks immediate recast
    expect(castFishingLine(p, 1, 50_000 + 60_000).ok).toBe(false)
    // Ready after FISH_COOLDOWN_MS
    expect(castFishingLine(p, 2, 50_000 + FISH_COOLDOWN_MS + 1, () => 0).caught).toBe(false)

    const summary = getFishBucketSummary(p)
    expect(summary.totalCount).toBe(1)
    expect(summary.totalWorth).toBeGreaterThan(0)

    const sold = sellFishBucket(p)
    expect(sold.ok).toBe(true)
    expect(p.wallet.solars).toBe(startSolars + summary.totalWorth)
    expect(getFishBucketSummary(p).totalCount).toBe(0)
  })

  it('deposits & withdraws Solars in the Astral Vault and unlocks Vault + Enchanting achievements', () => {
    const p = createNewPlayer({ name: 'Banker', classId: 'rogue', raceId: 'human' }, 1_000)
    p.wallet.solars = 60_000
    p.enchantingBook = { unlocked: true, unlockedAt: 1_000 }

    const dep = depositToVault(p, 50_000)
    expect(dep.ok).toBe(true)
    expect(getVaultBalance(p)).toBe(50_000)
    expect(p.wallet.solars).toBe(10_000)

    const unlocked = refreshAchievements(p)
    const ids = unlocked.map((a) => a.id)
    expect(ids).toContain('ach_vault_keeper')
    expect(ids).toContain('ach_enchanter')

    const wd = withdrawFromVault(p, 20_000)
    expect(wd.ok).toBe(true)
    expect(getVaultBalance(p)).toBe(30_000)
    expect(p.wallet.solars).toBe(30_000)
  })
})
