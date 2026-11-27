import { describe, expect, it } from 'vitest'
import { gearMap, recipes } from '../src/data'
import {
  ACHIEVEMENTS,
  claimAchievements,
  claimableAchievementCount,
  getAchievementBoard,
  refreshAchievements,
  tierPoints,
} from '../src/engine/achievements'
import { craftRecipe, craftableCount, getCraftBoard } from '../src/engine/craft'
import {
  JOBS,
  JOB_SHIFTS_PER_LEVEL,
  WORK_COOLDOWN_MS,
  applyForJob,
  jobPayAtLevel,
  resignJob,
  workShift,
} from '../src/engine/jobs'
import { recordQuestEvent } from '../src/engine/quests'
import { createNewPlayer } from '../src/state/player'

const NOW = new Date('2026-11-25T12:00:00Z').getTime()

describe('Blacksmith Forge & Full Material/Trophy Data (plugins/craft.js parity)', () => {
  it('all 81 recipes resolve their output item and every required material in gearMap', () => {
    expect(recipes.length).toBe(81)
    for (const r of recipes) {
      expect(gearMap[r.output], `missing output ${r.output}`).toBeTruthy()
      for (const m of r.materials) {
        expect(gearMap[m.itemId], `missing material ${m.itemId} for ${r.id}`).toBeTruthy()
      }
    }
  })

  it('forges gear when level, materials, and Solars are met, and refuses in battle/dungeon', () => {
    const p = createNewPlayer({ name: 'Smith', classId: 'warrior', raceId: 'human' }, NOW)
    const recipe = recipes.find((r) => (gearMap[r.output]?.levelReq ?? 1) <= 1)!
    p.level = 10
    p.wallet.solars = recipe.solarsCost + 100
    for (const m of recipe.materials) {
      for (let i = 0; i < m.qty; i++) p.inventory.push(m.itemId)
    }

    expect(craftableCount(p)).toBeGreaterThanOrEqual(1)
    expect(getCraftBoard(p)[0]!.canCraft).toBe(true)

    // Refuses in battle or dungeon
    p.battleState = { status: 'active' }
    expect(craftRecipe(p, recipe.id).ok).toBe(false)
    p.battleState = null
    p.inDungeon = true
    expect(craftRecipe(p, recipe.id).ok).toBe(false)
    p.inDungeon = false

    // Succeeds in Astral Town, consumes exact materials + Solars, adds output
    const out = craftRecipe(p, recipe.id)
    expect(out.ok).toBe(true)
    expect(p.inventory).toContain(recipe.output)
    expect(p.wallet.solars).toBe(100)

    // Missing materials on second attempt
    expect(craftRecipe(p, recipe.id).ok).toBe(false)
  })
})

describe('Town Careers & Work Shifts (plugins/jobs.js parity)', () => {
  it('enforces levelReq, 30-min shift cooldown, job level-ups, bonus materials, and stat perks', () => {
    const p = createNewPlayer({ name: 'Worker', classId: 'warrior', raceId: 'human' }, NOW)
    expect(applyForJob(p, 'merchant').ok).toBe(false) // Lv12 required

    p.level = 5
    expect(applyForJob(p, 'miner').ok).toBe(true)
    expect(p.job).toBe('miner')

    // Shift 1 (rng = 0.01 triggers Miner's first event: iron_ore ×3!)
    const s1 = workShift(p, NOW, () => 0.01)
    expect(s1.ok).toBe(true)
    expect(s1.solarsEarned).toBeGreaterThan(0)
    expect(p.inventory.filter((id) => id === 'iron_ore').length).toBe(3)
    expect(p.survivalProgress?.workShifts).toBe(1)

    // Cooldown blocks immediate second shift
    const blocked = workShift(p, NOW + 60_000, () => 0.99)
    expect(blocked.ok).toBe(false)
    expect(blocked.cooldownMinutes).toBe(29)

    // Advance 7 more shifts (30m apart) to reach Job Level 2
    for (let i = 1; i < JOB_SHIFTS_PER_LEVEL; i++) {
      const r = workShift(p, NOW + i * (WORK_COOLDOWN_MS + 1000), () => 0.99)
      expect(r.ok).toBe(true)
    }
    expect(p.jobLevel).toBe(2)
    expect(jobPayAtLevel(JOBS.miner!, 2).hi).toBeGreaterThan(jobPayAtLevel(JOBS.miner!, 1).hi)

    // At Job Level 3, shifts grant +1 STR stat perk
    p.jobLevel = 3
    const strBefore = p.stats.str
    const perkShift = workShift(p, NOW + 20 * WORK_COOLDOWN_MS, () => 0.99)
    expect(perkShift.ok).toBe(true)
    expect(perkShift.statPerk).toBe('STR +1')
    expect(p.stats.str).toBe(strBefore + 1)

    expect(resignJob(p).ok).toBe(true)
    expect(p.job).toBeNull()
  })
})

describe('Achievements Board (lib/achievement-engine.js parity)', () => {
  it('tracks metric & stat goals, sticky-stamps unlocks across spending, and pays once on claim', () => {
    const p = createNewPlayer({ name: 'Hero', classId: 'warrior', raceId: 'human' }, NOW)
    expect(ACHIEVEMENTS.every((a) => a.reward.type !== 'seasonPoints')).toBe(true)

    // Trigger metric achievement (First Blood: 1 kill) + stat achievement (1,000 Solars)
    recordQuestEvent(p, 'kill', 1)
    p.wallet.solars = 1200
    const newly = refreshAchievements(p)
    expect(newly.some((a) => a.id === 'ach_first_blood')).toBe(true)
    expect(newly.some((a) => a.id === 'ach_first_purse')).toBe(true)

    // Spend all Solars — sticky unlock keeps ach_first_purse claimable!
    p.wallet.solars = 0
    expect(claimableAchievementCount(p)).toBeGreaterThanOrEqual(2)

    const xpBefore = p.xp
    const claimPurse = claimAchievements(p, 'ach_first_purse')
    expect(claimPurse.claimed).toHaveLength(1)
    expect(p.xp).toBeGreaterThan(xpBefore)

    // Cannot double-claim
    expect(claimAchievements(p, 'ach_first_purse').nothing).toBe(true)

    // Claim remaining unlocked achievements and verify points sum
    const rest = claimAchievements(p)
    expect(rest.claimed.some((c) => c.id === 'ach_first_blood')).toBe(true)
    const board = getAchievementBoard(p)
    const expectedPts = p.achievements!.claimed.reduce(
      (sum, id) => sum + tierPoints(ACHIEVEMENTS.find((a) => a.id === id)!.tier),
      0,
    )
    expect(board.summary.points).toBe(expectedPts)
  })
})
