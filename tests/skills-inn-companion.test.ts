import { describe, expect, it } from 'vitest'
import { characterMap, skillMap, skills } from '../src/data'
import { playerAction, startBattle } from '../src/engine/battle'
import { equipCharacter, syncEquippedCharacterBonus } from '../src/engine/equipment'
import { innRestQuote, restAtInn, SOLAR_PER_HP, SOLAR_PER_MP } from '../src/engine/inn'
import { applyLevelUps } from '../src/engine/progression'
import {
  MAX_SKILL_SLOTS,
  equipSkillSlot,
  getNewlyUnlockedSkills,
  resetBestSkillSlots,
  unequipSkillSlot,
  unlockEligibleSkills,
} from '../src/engine/skills'
import { createNewPlayer } from '../src/state/player'

const NOW = new Date('2026-11-25T12:00:00Z').getTime()

function seq(...vals: number[]): () => number {
  let i = 0
  return () => vals[Math.min(i++, vals.length - 1)]!
}

describe('Support & Status Skills in Combat (plugins/skill.js + buildEffectDef parity)', () => {
  it('self-targeted heal skills always land (no accuracy roll) and restore HP', () => {
    const cleric = createNewPlayer({ name: 'Aria', classId: 'cleric', raceId: 'human' }, NOW)
    if (!cleric.skills.includes('cleric_golden_aura')) cleric.skills.push('cleric_golden_aura')
    cleric.equippedSkills = ['cleric_golden_aura']
    cleric.hp = 20

    const session = startBattle('newbie_hollow', 1, () => 0.999)
    // rng = 0.999 would miss any accuracy roll and makes enemy miss its counter
    const res = playerAction(cleric, session, { kind: 'skill', skillId: 'cleric_golden_aura' }, () => 0.999)

    expect(res.events.some((e) => e.kind === 'heal')).toBe(true)
    expect(res.events.some((e) => e.kind === 'miss' && e.text.includes('strike misses'))).toBe(false)
    expect(cleric.hp).toBeGreaterThan(20)
  })

  it('heal skills with a secondary debuff (cleric_astral_tide) both heal self and afflict the enemy', () => {
    const cleric = createNewPlayer({ name: 'Aria', classId: 'cleric', raceId: 'human' }, NOW)
    cleric.skills.push('cleric_astral_tide')
    cleric.equippedSkills = ['cleric_astral_tide']
    cleric.maxMp = 200
    cleric.mp = 200
    cleric.hp = 30

    const session = startBattle('newbie_hollow', 1, () => 0.999)
    session.enemy.hp = 500
    session.enemy.maxHp = 500
    const res = playerAction(cleric, session, { kind: 'skill', skillId: 'cleric_astral_tide' }, () => 0.999)

    expect(res.events.some((e) => e.kind === 'heal')).toBe(true)
    expect(cleric.hp).toBeGreaterThan(30)
    // Secondary effect on cleric_astral_tide is applied to enemy
    const secType = skillMap['cleric_astral_tide']?.effects?.[1]?.type
    if (secType) {
      expect((session.enemyEffects?.length ?? 0) > 0 || session.enemy.hp < 500).toBe(true)
    }
  })

  it('shield skills grant a self-barrier equal to round(maxHp * pct) that absorbs incoming damage', () => {
    const p = createNewPlayer({ name: 'Braum', classId: 'warrior', raceId: 'human' }, NOW)
    p.level = 15
    unlockEligibleSkills(p, skills)
    p.equippedSkills = ['neutral_brace_stance']
    p.mp = 100
    p.maxMp = 100

    const session = startBattle('newbie_hollow', 1, () => 0.999)
    session.enemy.atk = 12
    const expectedShield = Math.round(p.maxHp * (skillMap['neutral_brace_stance']!.effects[0]!.pct ?? 0.2))

    // Enemy misses so we can inspect full shield first, then hits on turn 2
    playerAction(p, session, { kind: 'skill', skillId: 'neutral_brace_stance' }, () => 0.999)
    expect(session.playerShield).toBe(expectedShield)

    const hpBefore = p.hp
    playerAction(p, session, { kind: 'defend' }, seq(0, 0.5))
    expect(session.playerShield!).toBeLessThan(expectedShield)
    expect(p.hp).toBe(hpBefore)
  })

  it('regen skills restore HP each round for their duration', () => {
    const p = createNewPlayer({ name: 'Monk', classId: 'warrior', raceId: 'human' }, NOW)
    p.level = 30
    unlockEligibleSkills(p, skills)
    p.equippedSkills = ['neutral_focus_breath']
    p.maxMp = 100
    p.mp = 100
    p.hp = 40

    const session = startBattle('newbie_hollow', 1, () => 0.999)
    const res = playerAction(p, session, { kind: 'skill', skillId: 'neutral_focus_breath' }, () => 0.999)
    expect(res.events.some((e) => e.kind === 'heal')).toBe(true)
    expect(p.hp).toBeGreaterThan(40)
    expect(session.regen?.remaining).toBe(2) // 3 turns initial minus 1 end-of-round tick
  })

  it('secondary stun/burn/blind effects apply to enemies and alter combat rounds', () => {
    const stunSkill = skills.find(
      (s) => s.type === 'active' && s.effects?.[0]?.type === 'attack' && s.effects?.[1]?.type === 'stun',
    )!
    const burnSkill = skills.find(
      (s) => s.type === 'active' && s.effects?.[0]?.type === 'attack' && s.effects?.[1]?.type === 'burn',
    )!
    expect(stunSkill).toBeTruthy()
    expect(burnSkill).toBeTruthy()

    // Stun skips enemy counterattack even when enemy hit roll = 0
    const p1 = createNewPlayer({ name: 'Stunner', classId: 'warrior', raceId: 'human' }, NOW)
    p1.skills.push(stunSkill.id)
    p1.equippedSkills = [stunSkill.id]
    p1.maxMp = 500
    p1.mp = 500
    const s1 = startBattle('newbie_hollow', 1, () => 0.999)
    s1.enemy.hp = 500
    s1.enemy.maxHp = 500
    const hpBefore = p1.hp
    const r1 = playerAction(p1, s1, { kind: 'skill', skillId: stunSkill.id }, seq(0, 1, 0, 0.5))
    expect(r1.events.some((e) => e.text.includes('stunned and cannot act'))).toBe(true)
    expect(p1.hp).toBe(hpBefore)

    // Burn ticks DoT damage on the enemy
    const p2 = createNewPlayer({ name: 'Pyro', classId: 'mage', raceId: 'human' }, NOW)
    p2.skills.push(burnSkill.id)
    p2.equippedSkills = [burnSkill.id]
    p2.maxMp = 500
    p2.mp = 500
    const s2 = startBattle('newbie_hollow', 1, () => 0.999)
    s2.enemy.hp = 500
    s2.enemy.maxHp = 500
    const r2 = playerAction(p2, s2, { kind: 'skill', skillId: burnSkill.id }, seq(0, 1, 1))
    expect(r2.events.some((e) => e.text.includes('suffers') && e.text.includes('burn'))).toBe(true)
  })
})

describe('Skill Unlock Progression & 4-Slot Loadout Manager', () => {
  it('applyLevelUps unlocks class + Universal Neutral skills automatically as level rises', () => {
    const p = createNewPlayer({ name: 'Kael', classId: 'warrior', raceId: 'human' }, NOW)
    expect(p.skills.includes('neutral_second_wind')).toBe(false)
    expect(p.skills.includes('neutral_crescent_sweep')).toBe(false)

    // Grant enough XP to pass Level 10
    p.xp = 25000
    const out = applyLevelUps(p)
    expect(out.levelled).toBe(true)
    expect(p.level).toBeGreaterThanOrEqual(10)
    expect(p.skills.includes('neutral_second_wind')).toBe(true)
    expect(p.skills.includes('neutral_crescent_sweep')).toBe(true)
    expect(out.msgs.some((m) => m.includes('Skill unlocked:'))).toBe(true)
    expect(getNewlyUnlockedSkills(p, skills).length).toBe(0)
  })

  it('enforces MAX_SKILL_SLOTS = 4, rejects passive skills, and supports unequip/equip/resetBest', () => {
    const p = createNewPlayer({ name: 'Kael', classId: 'warrior', raceId: 'human' }, NOW)
    p.level = 20
    unlockEligibleSkills(p, skills)
    expect(p.equippedSkills.length).toBe(MAX_SKILL_SLOTS)

    // Cannot equip a 5th while 4 slots are occupied
    const unequippedActive = p.skills.find(
      (id) => skillMap[id]?.type === 'active' && !p.equippedSkills.includes(id),
    )!
    expect(equipSkillSlot(p, unequippedActive, skills).ok).toBe(false)

    // Unequip one slot, then equip succeeds
    const removed = p.equippedSkills[0]!
    expect(unequipSkillSlot(p, removed).ok).toBe(true)
    expect(p.equippedSkills.length).toBe(3)
    expect(equipSkillSlot(p, unequippedActive, skills).ok).toBe(true)
    expect(p.equippedSkills).toContain(unequippedActive)

    // Passive skills cannot occupy an active slot
    const passiveId = p.skills.find((id) => skillMap[id]?.type === 'passive')!
    unequipSkillSlot(p, unequippedActive)
    const passiveAttempt = equipSkillSlot(p, passiveId, skills)
    expect(passiveAttempt.ok).toBe(false)
    expect(passiveAttempt.error).toContain('passive')

    // resetBestSkillSlots fills 4 highest-unlockLevel active skills
    const best = resetBestSkillSlots(p, skills)
    expect(best.length).toBe(MAX_SKILL_SLOTS)
  })
})

describe('Character Companion Stat Bonuses (plugins/character.js parity)', () => {
  it('folds statBonuses on equip, swaps cleanly between characters, and strips on unequip', () => {
    const p = createNewPlayer({ name: 'Sora', classId: 'warrior', raceId: 'human' }, NOW)
    const baseStr = p.stats.str
    const baseMaxHp = p.maxHp
    const baseMaxMp = p.maxMp

    p.ownedCharacters.push('gojo', 'wither')
    const gojo = characterMap['gojo']!
    const wither = characterMap['wither']!

    // Equip Gojo
    const eq1 = equipCharacter(p, 'gojo')
    expect(eq1.ok).toBe(true)
    expect(p.equippedCharacter).toBe('gojo')
    expect(p.stats.str).toBe(baseStr + (gojo.statBonuses?.str ?? 0))
    expect(p.maxHp).toBe(baseMaxHp + (gojo.statBonuses?.maxHp ?? 0))
    expect(p.maxMp).toBe(baseMaxMp + (gojo.statBonuses?.maxMp ?? 0))
    expect(p.tutorial.completed).toContain('claim_character')

    // Swap directly from Gojo to Wither (+40 INT, strips Gojo's STR/HP/MP)
    const baseIntBeforeSwap = p.stats.int - (gojo.statBonuses?.int ?? 0)
    const eq2 = equipCharacter(p, 'wither')
    expect(eq2.ok).toBe(true)
    expect(p.equippedCharacter).toBe('wither')
    expect(p.stats.str).toBe(baseStr)
    expect(p.maxHp).toBe(baseMaxHp)
    expect(p.stats.int).toBe(baseIntBeforeSwap + (wither.statBonuses?.int ?? 0))

    // Unequip restores exact baseline
    const un = equipCharacter(p, null)
    expect(un.ok).toBe(true)
    expect(p.equippedCharacter).toBeNull()
    expect(p.stats.int).toBe(baseIntBeforeSwap)
  })

  it('syncEquippedCharacterBonus repairs legacy saves idempotently without double-counting', () => {
    const p = createNewPlayer({ name: 'Legacy', classId: 'warrior', raceId: 'human' }, NOW)
    const baseStr = p.stats.str
    p.ownedCharacters.push('gojo')
    p.equippedCharacter = 'gojo' // legacy state: equippedCharacter set without characterBonusApplied

    syncEquippedCharacterBonus(p)
    expect(p.stats.str).toBe(baseStr + (characterMap['gojo']!.statBonuses?.str ?? 0))

    // Calling again is a strict no-op
    syncEquippedCharacterBonus(p)
    expect(p.stats.str).toBe(baseStr + (characterMap['gojo']!.statBonuses?.str ?? 0))
  })
})

describe('Astral Town Inn (plugins/inn.js parity)', () => {
  it('computes exact 0.5/HP and 0.3/MP Solar quotes and heals Full / HP / MP out of combat', () => {
    const p = createNewPlayer({ name: 'Tired', classId: 'warrior', raceId: 'human' }, NOW)
    p.maxHp = 200
    p.hp = 101 // missing 99 HP → ceil(99 * 0.5) = 50
    p.maxMp = 100
    p.mp = 49 // missing 51 MP → ceil(51 * 0.3) = 16
    p.wallet.solars = 500

    const q = innRestQuote(p)
    expect(q.costHp).toBe(Math.ceil(99 * SOLAR_PER_HP))
    expect(q.costMp).toBe(Math.ceil(51 * SOLAR_PER_MP))
    expect(q.costFull).toBe(q.costHp + q.costMp)

    // Refuses during an active battle
    p.battleState = { status: 'active' }
    expect(restAtInn(p, 'full').ok).toBe(false)
    p.battleState = null

    // HP-only rest
    const rHp = restAtInn(p, 'hp')
    expect(rHp.ok).toBe(true)
    expect(p.hp).toBe(200)
    expect(p.mp).toBe(49)
    expect(p.wallet.solars).toBe(500 - q.costHp)

    // MP-only rest
    const rMp = restAtInn(p, 'mp')
    expect(rMp.ok).toBe(true)
    expect(p.mp).toBe(100)
    expect(p.wallet.solars).toBe(500 - q.costHp - q.costMp)

    // Already full → refuses without charging
    expect(restAtInn(p, 'full').ok).toBe(false)
  })
})
