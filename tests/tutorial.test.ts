// Tutorial — conditional completion, one-shot rewards, graduation gift.

import { describe, expect, it } from 'vitest'
import {
  TUTORIAL_STEPS,
  GRADUATION_REWARD,
  ensureTutorial,
  getCurrentStep,
  isStepComplete,
  tutorialProgress,
  syncTutorialProgress,
  recordTutorialEvent,
  skipTutorial,
  rewardLabel,
} from '../src/engine/tutorial'
import { createNewPlayer } from '../src/state/player'

function fresh() {
  return createNewPlayer({ name: 'TutorialTester', classId: 'warrior', raceId: 'human' })
}

describe('step board', () => {
  it('has the bot 8 steps with the same ids, triggers and rewards', () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual([
      'claim_character',
      'claim_daily',
      'equip_weapon',
      'fight_monster',
      'check_inventory',
      'check_profile',
      'enter_dungeon',
      'complete_quest',
    ])
    expect(TUTORIAL_STEPS.map((s) => s.trigger)).toEqual([
      'character_claimed',
      'daily_claimed',
      'weapon_equipped',
      'monster_killed',
      'inventory_viewed',
      'profile_viewed',
      'dungeon_entered',
      'quest_completed',
    ])
    expect(TUTORIAL_STEPS.map((s) => s.reward)).toEqual([
      { solars: 100 },
      { solars: 50 },
      { solars: 50 },
      { solars: 125 },
      { solars: 25 },
      { solars: 25 },
      { solars: 250 },
      { solars: 200, gems: 5 },
    ])
    expect(GRADUATION_REWARD).toEqual({ solars: 500, gems: 10 })
    expect(rewardLabel(GRADUATION_REWARD)).toBe('☀️ 500 Solars, 💎 10 Gems')
  })
})

describe('conditional sync', () => {
  it('registration-state completes claim_character and opens on the daily', () => {
    const p = fresh()
    const res = syncTutorialProgress(p)
    expect(res?.steps.map((s) => s.id)).toEqual(['claim_character'])
    expect(p.wallet.solars).toBe(200) // 100 start + 100 step
    expect(getCurrentStep(p)?.id).toBe('claim_daily')
  })

  it('stateChecks bank steps the record already proves, in any order', () => {
    const p = fresh()
    // veteran record: has a weapon, wins, dungeon progress, claimed quest
    p.equipped.weapon = 'iron_sword'
    p.stats.wins = 3
    p.dungeonProgress['newbie_hollow'] = { highestFloor: 4 }
    p.quests.dailyClaimed.push('d_floor_20')
    p.lastDailyClaim = Date.now()
    const res = syncTutorialProgress(p)!
    expect(res.steps.map((s) => s.id)).toEqual([
      'claim_character',
      'claim_daily',
      'equip_weapon',
      'fight_monster',
      'enter_dungeon',
      'complete_quest',
    ])
    // view-steps remain: they are event-only
    expect(getCurrentStep(p)?.id).toBe('check_inventory')
    expect(tutorialProgress(p)).toMatchObject({ completed: 6, total: 8, percent: 75 })
  })

  it('events complete out-of-order without re-asking done work', () => {
    const p = fresh()
    syncTutorialProgress(p)
    const res = recordTutorialEvent(p, 'inventory_viewed')!
    expect(res.steps.map((s) => s.id)).toContain('check_inventory')
    expect(isStepComplete(p, 'claim_character')).toBe(true)
    // same trigger again is a no-op
    expect(recordTutorialEvent(p, 'inventory_viewed')).toBeNull()
  })
})

describe('graduation + skip', () => {
  it('finishing every step pays the graduation gift exactly once', () => {
    const p = fresh()
    syncTutorialProgress(p)
    for (const trigger of [
      'daily_claimed',
      'weapon_equipped',
      'monster_killed',
      'inventory_viewed',
      'profile_viewed',
      'dungeon_entered',
      'quest_completed',
    ]) {
      recordTutorialEvent(p, trigger)
    }
    const t = ensureTutorial(p)!
    expect(t.graduated).toBe(true)
    expect(t.graduationRewarded).toBe(true)
    // 100 start + 100+50+50+125+25+25+250+200+5gems steps + 500 graduation
    expect(p.wallet.solars).toBe(100 + 100 + 50 + 50 + 125 + 25 + 25 + 250 + 200 + 500)
    expect(p.wallet.gems).toBe(5 + 10)
    // a later event never re-pays (100 start + 825 steps + 500 graduation)
    expect(recordTutorialEvent(p, 'monster_killed')).toBeNull()
    expect(p.wallet.solars).toBe(1425)
  })

  it('skip marks all steps but forfeits the graduation gift', () => {
    const p = fresh()
    syncTutorialProgress(p)
    expect(skipTutorial(p)).toBe(true)
    const t = ensureTutorial(p)!
    expect(t.skipped).toBe(true)
    expect(t.graduated).toBe(true)
    expect(t.graduationRewarded).toBe(false)
    expect(tutorialProgress(p).percent).toBe(100)
    expect(getCurrentStep(p)).toBeNull()
    expect(skipTutorial(p)).toBe(false) // already graduated
  })
})
