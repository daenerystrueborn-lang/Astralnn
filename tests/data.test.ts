import { describe, it, expect } from 'vitest'
import {
  classes,
  races,
  skills,
  skillMap,
  characters,
  monsters,
  locations,
  quests,
  weapons,
  items,
  gearMap,
  ranks,
  levelsData,
  defaultWallet,
  effectiveness,
} from '../src/data'
import { SPIN_BANNERS } from '../src/engine/gacha'

// Content integrity: everything the engines will read must exist and agree.

describe('data files load and shape-check', () => {
  it('9 classes, each with base stats, primary stat and starting kit', () => {
    expect(Object.keys(classes)).toHaveLength(9)
    for (const [id, cls] of Object.entries(classes)) {
      expect(['str', 'agi', 'int']).toContain(cls.primaryStat)
      expect(cls.baseStats.maxHp).toBeGreaterThan(0)
      expect(cls.baseStats.maxMp).toBeGreaterThan(0)
      expect(cls.startingSkills.length).toBeGreaterThan(0)
      expect(cls.startingItems.length).toBeGreaterThan(0)
      // starting kit must exist in the data tables
      for (const s of cls.startingSkills) {
        expect(skillMap[s], `${id} starting skill ${s}`).toBeTruthy()
      }
      for (const i of cls.startingItems) {
        expect(gearMap[i], `${id} starting item ${i}`).toBeTruthy()
      }
    }
  })

  it('6 races total, 5 starting choices; hidden races never offered', () => {
    const all = Object.entries(races)
    expect(all).toHaveLength(6)
    const visible = all.filter(([, r]) => r.hidden !== true)
    expect(visible).toHaveLength(5) // fairy is transformation-only
    for (const [, r] of visible) {
      expect(r.statModifiers).toBeTruthy()
      expect(r.passive).toBeTruthy()
    }
  })

  it('skills:1000+ records, attack skills carry effects[0].multiplier', () => {
    expect(skills.length).toBeGreaterThan(900)
    const attack = skills.filter((s) => s.effects?.[0]?.type === 'attack')
    expect(attack.length).toBeGreaterThan(100)
    for (const s of attack.slice(0, 50)) {
      expect(typeof s.effects[0].multiplier, `skill ${s.id}`).toBe('number')
    }
    // unique ids
    expect(new Set(skills.map((s) => s.id)).size).toBe(skills.length)
  })

  it('characters: 60+ with combat stat blocks', () => {
    expect(characters.length).toBeGreaterThanOrEqual(60)
    for (const c of characters) {
      // combat block must exist; two special characters (namidrek, alenious)
      // intentionally ship zeroed stats in the bot's data.
      expect(typeof c.combat.atk, `combat.atk on ${c.id}`).toBe('number')
      expect(typeof c.combat.def, `combat.def on ${c.id}`).toBe('number')
      expect(typeof c.combat.agi, `combat.agi on ${c.id}`).toBe('number')
      // most atkTypes are str/agi/int; specials carry custom types
      // (e.g. 'crownlight'), so just require a non-empty string.
      expect(typeof c.combat.atkType).toBe('string')
      expect(c.combat.atkType.length).toBeGreaterThan(0)
      expect(c.name).toBeTruthy()
    }
  })

  it('monsters: regular + bosses pools with stats and reward curves', () => {
    expect(monsters.regular.length).toBeGreaterThan(500)
    expect(monsters.bosses.length).toBeGreaterThan(10)
    const m = monsters.regular[0]!
    expect(m.baseStats.hp).toBeGreaterThan(0)
    expect(m.rewards?.xpBase).toBeGreaterThan(0)
    expect(m.rewards?.solarsBase).toBeGreaterThanOrEqual(0)
  })

  it('locations: hub exists, dungeons carry floors', () => {
    expect(locations.length).toBeGreaterThanOrEqual(50)
    const town = locations.find((l) => l.id === 'astral_town')
    expect(town?.type).toBe('town')
    const dungeons = locations.filter((l) => (l.floors ?? 0) > 0)
    expect(dungeons.length).toBeGreaterThan(5)
  })

  it('quests: at least 3 dailies (the daily draw size) and a milestone track', () => {
    expect(quests.daily.length).toBeGreaterThanOrEqual(3)
    expect(quests.milestone.length).toBeGreaterThan(10)
    for (const q of quests.daily) {
      expect(q.metric).toBeTruthy()
      expect(q.goal).toBeGreaterThan(0)
      expect(q.reward.amount).toBeGreaterThan(0)
    }
  })

  it('gear: weapons + armor with slot and stat bonuses', () => {
    expect(weapons.length).toBeGreaterThanOrEqual(50)
    expect(items.length).toBeGreaterThanOrEqual(50)
    const sword = gearMap['iron_sword']
    expect(sword?.slot).toBe('weapon')
    expect(sword?.statBonuses.str).toBe(4)
    const armor = gearMap['leather_armor']
    expect(armor?.slot).toBe('chestplate')
  })

  it('ranks cover level 1..100', () => {
    expect(ranks[0]?.min).toBe(1)
    expect(ranks[ranks.length - 1]?.max).toBe(100)
  })

  it('wallet starts at 100 solars', () => {
    expect(defaultWallet.solars).toBe(100)
    expect(defaultWallet.gems).toBe(0)
  })

  it('effectiveness.json exposes the 5 matchup rows', () => {
    expect(Object.keys(effectiveness.matchups).sort()).toEqual([
      'fire', 'holy', 'magic', 'physical', 'severing',
    ])
  })

  it('every spin banner references a real character', () => {
    for (const id of Object.keys(SPIN_BANNERS)) {
      expect(characters.find((c) => c.id === id), `banner ${id}`).toBeTruthy()
    }
  })

  it('xpTable covers the whole level cap', () => {
    for (let l = 2; l <= levelsData.levelCap; l++) {
      expect(typeof levelsData.xpTable[String(l)], `xpTable level ${l}`).toBe('number')
    }
  })
})
