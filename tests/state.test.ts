import { describe, it, expect } from 'vitest'
import {
  validateRegistration,
  createNewPlayer,
  SAVE_SCHEMA_VERSION,
  type Player,
} from '../src/state/player'
import {
  ensureUniversalNeutralSkills,
  autoFillSkillSlots,
  getEquippedSkills,
  MAX_SKILL_SLOTS,
} from '../src/state/skill-slots'
import {
  GameStore,
  MemoryStorage,
  migrateSave,
  SAVE_KEY,
} from '../src/state/store'
import { getTotalStats } from '../src/engine/stats'
import { skillMap, skills, classes } from '../src/data'

const NOW = new Date('2026-11-25T12:00:00').getTime()

describe('validateRegistration (bot rules)', () => {
  it('accepts a valid registration', () => {
    const r = validateRegistration({ name: 'Astra', classId: 'warrior', raceId: 'human' })
    expect(r).toEqual({ ok: true, name: 'Astra', classId: 'warrior', raceId: 'human' })
  })

  it('normalizes class/race case', () => {
    const r = validateRegistration({ name: 'Astra', classId: 'Mage', raceId: 'ELF' })
    expect(r).toMatchObject({ ok: true, classId: 'mage', raceId: 'elf' })
  })

  it.each([
    [{ name: '', classId: 'warrior', raceId: 'human' }, 'Pick a character name.'],
    [{ name: 'A', classId: 'warrior', raceId: 'human' }, 'Name must be at least 2 characters.'],
    [{ name: 'x'.repeat(21), classId: 'warrior', raceId: 'human' }, 'Name must be 20 characters or fewer.'],
    [{ name: 'bad name!', classId: 'warrior', raceId: 'human' }, 'Name can only use letters, numbers, and _ . -'],
    [{ name: 'Ok', classId: 'necromancer', raceId: 'human' }, 'Unknown class "necromancer".'],
    [{ name: 'Ok', classId: 'warrior', raceId: 'dragon' }, 'Unknown race "dragon".'],
    [{ name: 'Ok', classId: 'warrior', raceId: 'fairy' }, 'Unknown race "fairy".'], // hidden
  ])('rejects %o → %s', (input, error) => {
    const r = validateRegistration(input)
    expect(r.ok).toBe(false)
    expect(r.error).toBe(error)
  })
})

describe('createNewPlayer', () => {
  const p = createNewPlayer({ name: 'Astra', classId: 'warrior', raceId: 'human' }, NOW)

  it('builds stats exactly from getTotalStats(class, race, 1)', () => {
    const t = getTotalStats('warrior', 'human', 1)
    expect(p.stats).toMatchObject({
      str: t.str, agi: t.agi, int: t.int, def: t.def, lck: t.lck,
      wins: 0, losses: 0,
    })
    expect(p.baseStats).toMatchObject({ str: t.str, maxHp: t.maxHp, maxMp: t.maxMp })
    expect(p.hp).toBe(t.maxHp)
    expect(p.maxHp).toBe(t.maxHp)
    expect(p.mp).toBe(t.maxMp)
    expect(p.maxMp).toBe(t.maxMp)
    expect(p.level).toBe(1)
    expect(p.xp).toBe(0)
  })

  it('carries the V0 save schema and identity fields', () => {
    expect(p.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(p.id).toMatch(/^p_/)
    expect(p.name).toBe('Astra')
    expect(p.classId).toBe('warrior')
    expect(p.raceId).toBe('human')
    expect(p.registeredAt).toBe(NOW)
    expect(p.updatedAt).toBe(NOW)
  })

  it('every id is unique', () => {
    const a = createNewPlayer({ name: 'Two', classId: 'rogue', raceId: 'elf' }, NOW)
    const b = createNewPlayer({ name: 'Two', classId: 'rogue', raceId: 'elf' }, NOW)
    expect(a.id).not.toBe(b.id)
  })

  it('starts with 100 solars, 0 gems, and the v2 stat-point pool', () => {
    expect(p.wallet).toEqual({ solars: 100, gems: 0 })
    expect(p.statPoints).toEqual({
      version: 2, earned: 15, spent: 0, unallocated: 15,
      allocations: { str: 0, agi: 0, int: 0, def: 0, lck: 0 },
    })
  })

  it('equips nothing; starts with the class starting inventory', () => {
    expect(Object.values(p.equipped).every((v) => v === null)).toBe(true)
    expect(p.inventory).toEqual(classes.warrior!.startingItems)
  })

  it('owns Universal Neutral iron palm + class skill, auto-filled into ≤4 slots', () => {
    expect(p.skills[0]).toBe('neutral_iron_palm')
    expect(p.skills).toContain('warrior_slash')
    expect(p.equippedSkills.length).toBeGreaterThan(0)
    expect(p.equippedSkills.length).toBeLessThanOrEqual(MAX_SKILL_SLOTS)
    // neutral sorts first when not awakened
    expect(p.equippedSkills[0]).toBe('neutral_iron_palm')
    for (const id of p.equippedSkills) {
      expect(skillMap[id]?.type, `equipped ${id}`).toBe('active')
    }
  })

  it('starts at the hub with no dungeon/battle state', () => {
    expect(p.location).toBe('astral_town')
    expect(p.inDungeon).toBe(false)
    expect(p.dungeonFloor).toBe(0)
    expect(p.battleState).toBeNull()
    expect(p.dungeonProgress).toEqual({})
    expect(p.ownedCharacters).toEqual([])
    expect(p.equippedCharacter).toBeNull()
  })

  it('stamina resets at the next local midnight; quest period starts today', () => {
    expect(p.stamina).toEqual({ current: 30, max: 30, resetAt: new Date(NOW).setHours(24, 0, 0, 0) })
    expect(p.quests.day).toBe(new Date(NOW).setHours(0, 0, 0, 0))
    expect(p.quests.daily).toEqual({})
    expect(p.quests.lifetime).toEqual({})
    expect(p.tutorial).toEqual({
      completed: [],
      graduated: false,
      graduationRewarded: false,
      graduatedAt: null,
      startedAt: p.tutorial.startedAt,
      skipped: false,
    })
    expect(p.streakMilestones).toEqual([])
    expect(p.bestDailyStreak).toBe(0)
  })

  it('throws on invalid registration', () => {
    expect(() => createNewPlayer({ name: '', classId: 'warrior', raceId: 'human' })).toThrow()
  })

  it('starts empty V1 containers so no migration is needed later', () => {
    expect(p.abilityInventory).toEqual([])
    expect(p.equippedAbilities).toEqual([])
    expect(p.abilitySlots).toBe(1)
    expect(p.storyProgress).toEqual({ volumes: {} })
    expect(p.storyFlags).toEqual([])
  })
})

describe('skill slots (bot parity)', () => {
  function carrier(level: number, owned: string[], equipped: string[] = []) {
    return { level, skills: [...owned], equippedSkills: [...equipped] }
  }

  it('grants Universal Neutral skills at their unlock levels', () => {
    const c = carrier(1, [])
    expect(ensureUniversalNeutralSkills(c)).toEqual(['neutral_iron_palm'])

    const c5 = carrier(5, [])
    expect(ensureUniversalNeutralSkills(c5)).toEqual(['neutral_iron_palm', 'neutral_second_wind'])

    const c50 = carrier(50, [])
    expect(ensureUniversalNeutralSkills(c50)).toHaveLength(10)
    expect(c50.skills).toHaveLength(10)

    // idempotent
    const again = ensureUniversalNeutralSkills(c50)
    expect(again).toEqual([])
  })

  it('auto-fill preserves existing picks and appends new fills neutral-first', () => {
    // Existing equipped order is preserved (bot: filled = [...current]);
    // only NEW additions are sorted neutral-first.
    const c = carrier(1, ['warrior_slash', 'neutral_iron_palm'], ['warrior_slash'])
    const filled = autoFillSkillSlots(c, skills)
    expect(filled).toEqual(['warrior_slash', 'neutral_iron_palm'])
    expect(getEquippedSkills(c)).toEqual(filled)

    // Fresh loadout (no existing picks) fills neutral-first — the factory path.
    const fresh = carrier(1, ['warrior_slash', 'neutral_iron_palm'], [])
    expect(autoFillSkillSlots(fresh, skills)).toEqual(['neutral_iron_palm', 'warrior_slash'])
  })

  it('never equips passive skills', () => {
    const c = carrier(1, ['warrior_slash', 'neutral_iron_palm'])
    const filled = autoFillSkillSlots(c, skills)
    for (const id of filled) expect(skillMap[id]?.type).toBe('active')
  })
})

describe('GameStore persistence', () => {
  function freshStore(storage = new MemoryStorage()) {
    return { store: new GameStore({ storage }), storage }
  }

  it('starts empty', () => {
    const { store } = freshStore()
    expect(store.load()).toBeNull()
    expect(store.getState()).toBeNull()
  })

  it('setPlayer persists; a second store loads an identical record', () => {
    const { store, storage } = freshStore()
    const p = createNewPlayer({ name: 'Astra', classId: 'mage', raceId: 'elf' }, NOW)
    store.setPlayer(p)

    const revived = new GameStore({ storage })
    const loaded = revived.load()
    expect(loaded).not.toBeNull()
    expect(loaded).toEqual(p)
    expect(storage.getItem(SAVE_KEY)).toContain('"schemaVersion":1')
  })

  it('update() is the single mutation path: mutates, autosaves, notifies', () => {
    const { store, storage } = freshStore()
    store.setPlayer(createNewPlayer({ name: 'Astra', classId: 'rogue', raceId: 'orc' }, NOW))

    let notified: Player | null = null
    const unsub = store.subscribe((s) => { notified = s })

    const after = store.update((p) => {
      p.wallet.solars += 500
      p.stats.wins += 1
    })
    expect(after.wallet.solars).toBe(600)
    expect(after.stats.wins).toBe(1)
    expect(notified).toBe(after)
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(NOW)

    // persisted without another explicit save()
    const revived = new GameStore({ storage: storage as MemoryStorage })
    expect(revived.load()?.wallet.solars).toBe(600)
    unsub()
  })

  it('update() without a player throws (single-writer guard)', () => {
    const { store } = freshStore()
    expect(() => store.update((p) => { p.xp += 1 })).toThrow('No player loaded')
  })

  it('export/import round-trips through a foreign storage', () => {
    const { store } = freshStore()
    store.setPlayer(createNewPlayer({ name: 'Exported', classId: 'cleric', raceId: 'dwarf' }, NOW))
    store.update((p) => { p.level = 7; p.xp = 4000 })

    const json = store.exportSave()
    const other = new GameStore({ storage: new MemoryStorage() })
    const imported = other.importSave(json)
    expect(imported.name).toBe('Exported')
    expect(imported.level).toBe(7)
    expect(other.getState()).toEqual(store.getState())
  })

  it('import rejects garbage and future versions', () => {
    const { store } = freshStore()
    expect(() => store.importSave('not json')).toThrow('not valid JSON')
    expect(() => store.importSave('{"schemaVersion":99,"player":{}}')).toThrow('newer version')
    expect(() => store.importSave('{}')).toThrow('invalid')
  })

  it('reset wipes storage and state', () => {
    const { store, storage } = freshStore()
    store.setPlayer(createNewPlayer({ name: 'Gone', classId: 'knight', raceId: 'halfling' }, NOW))
    store.reset()
    expect(store.getState()).toBeNull()
    expect(storage.getItem(SAVE_KEY)).toBeNull()
  })

  it('load survives corrupt JSON without throwing', () => {
    const storage = new MemoryStorage()
    storage.setItem(SAVE_KEY, '{broken')
    const store = new GameStore({ storage })
    expect(store.load()).toBeNull()
  })
})

describe('migrateSave', () => {
  it('passes through a v1 file', () => {
    const p = createNewPlayer({ name: 'Mo', classId: 'samurai', raceId: 'human' }, NOW)
    const out = migrateSave({ schemaVersion: 1, savedAt: 1, player: p })
    expect(out?.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(out?.player).toEqual(p)
  })

  it('rejects files from a future schema and non-objects', () => {
    expect(migrateSave({ schemaVersion: 999, player: {} })).toBeNull()
    expect(migrateSave(null)).toBeNull()
    expect(migrateSave('x')).toBeNull()
    expect(migrateSave({ player: {} })).toBeNull()
  })
})
