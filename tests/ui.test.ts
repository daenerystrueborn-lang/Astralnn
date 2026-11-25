// @vitest-environment happy-dom
// E2E of the V0 playable loop: register → hub → battle → win → results → hub,
// then save → reload → continue. Uses seeded Math.random for determinism.

import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createContext } from '../src/ui/app'
import { mulberry32 } from '../src/engine/rng'

const realRandom = Math.random

async function waitFor(sel: string, timeout = 4000): Promise<HTMLElement> {
  const started = Date.now()
  for (;;) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) return el
    if (Date.now() - started > timeout) throw new Error(`timeout waiting for ${sel}`)
    await new Promise((r) => setTimeout(r, 15))
  }
}

async function waitForText(text: string, timeout = 4000): Promise<void> {
  const started = Date.now()
  for (;;) {
    if (document.body.textContent?.includes(text)) return
    if (Date.now() - started > timeout) throw new Error(`timeout waiting for text: ${text}`)
    await new Promise((r) => setTimeout(r, 15))
  }
}

async function flush(times = 4): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 15))
}

function click(sel: string): void {
  const el = document.querySelector<HTMLElement>(sel)
  if (!el) throw new Error(`missing element: ${sel}`)
  el.click()
}

describe('V0 playable loop (UI)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<main id="app"></main>'
    Math.random = mulberry32(0xa57a1)
  })

  afterEach(() => {
    Math.random = realRandom
  })

  it('register → battle → victory → results → hub, then reload continues', async () => {
    const { ctx, start } = createContext()
    start()

    // ── Registration ──────────────────────────────────────────
    await waitFor('#reg-create')
    const nameInput = document.querySelector<HTMLInputElement>('#reg-name')!
    nameInput.value = 'AstraTester'
    nameInput.dispatchEvent(new Event('input'))
    click('.pick[data-id="warrior"]')
    click('.chip[data-id="human"]')
    expect(document.querySelector('#preview')).toBeTruthy()
    click('#reg-create')

    // ── Hub ───────────────────────────────────────────────────
    await waitForText('AstraTester')
    expect(document.body.textContent).toContain('Warrior')
    const player = ctx.store.requireState()
    expect(player.level).toBe(1)
    expect(player.equippedSkills.length).toBeGreaterThan(0)

    // ── Enter newbie_hollow floor 1 ───────────────────────────
    const loc = await waitFor('.loc[data-open]')
    loc.click()
    await waitFor('#f-enter')
    click('#f-enter')

    // ── Battle: attack until it resolves ──────────────────────
    await waitFor('[data-act="attack"]')
    expect(document.body.textContent).toContain('Floor 1')
    const started = Date.now()
    for (;;) {
      if (document.querySelector('.result-title')) break
      if (Date.now() - started > 8000) throw new Error('battle never resolved')
      // Prefer a skill when affordable, else basic attack.
      const skill = document.querySelector<HTMLButtonElement>('[data-skill]:not([disabled])')
      if (skill) skill.click()
      else click('[data-act="attack"]')
      await flush(1)
    }
    await waitForText('VICTORY')

    // ── Rewards settled ───────────────────────────────────────
    const after = ctx.store.requireState()
    expect(after.stats.wins).toBe(1)
    expect(after.xp).toBeGreaterThan(0)
    expect(after.wallet.solars).toBeGreaterThan(0)
    expect(after.dungeonProgress['newbie_hollow']?.highestFloor).toBe(1)
    expect(after.battleState).toBeNull()

    // ── Back to hub ───────────────────────────────────────────
    click('#res-continue')
    await waitForText('AstraTester')

    // ── Save → reload → continue ──────────────────────────────
    const raw = localStorage.getItem('astral-fantasy-save')
    expect(raw).toBeTruthy()
    document.body.innerHTML = '<main id="app"></main>'
    const second = createContext()
    second.start()
    await waitForText('Highest floor 1')
    expect(second.ctx.store.requireState().stats.wins).toBe(1)
  })

  it('systems tour: dungeon, roster, quests, profile, inventory, settings all render', async () => {
    // alert/confirm are used by claim/reset flows; happy-dom stubs them loudly.
    const alerts: string[] = []
    window.alert = ((msg: string) => { alerts.push(String(msg)) }) as never
    window.confirm = (() => true) as never

    const { ctx, start } = createContext()
    start()
    await waitFor('#reg-create')
    const nameInput = document.querySelector<HTMLInputElement>('#reg-name')!
    nameInput.value = 'TourTester'
    nameInput.dispatchEvent(new Event('input'))
    click('.pick[data-id="mage"]')
    click('.chip[data-id="elf"]')
    click('#reg-create')
    await waitForText('Choose your battle')

    // Tutorial card is open on the hub (claim_character banked at register).
    expect(document.body.textContent).toContain('Tutorial')
    expect(document.body.textContent).toContain('Claim Your Daily Reward')

    // ── Dungeon ────────────────────────────────────────────────
    click('[data-nav="dungeon"]')
    await waitFor('#loc-list')
    expect(document.body.textContent).toContain("Newcomer's Hollow")
    expect(document.querySelectorAll('.loc').length).toBeGreaterThan(0)
    click('[data-nav="hub"]')
    await waitForText('Choose your battle')

    // ── Roster (empty state + spin link) ───────────────────────
    click('[data-nav="roster"]')
    await waitForText('ROSTER')
    expect(document.body.textContent).toContain('No characters yet')
    click('[data-nav="spin"]')
    await waitForText('RECRUITMENT')
    expect(document.querySelectorAll('[data-banner]').length).toBeGreaterThan(5)
    click('[data-nav="hub"]')
    await waitForText('Choose your battle')

    // ── Quests: today's seeded dailies + milestones ────────────
    click('[data-nav="quests"]')
    await waitForText('QUESTS')
    expect(document.body.textContent).toContain('Daily — rotates at midnight')
    expect(document.querySelectorAll('[data-claim], #claim-all').length).toBeGreaterThanOrEqual(0)
    click('[data-nav="hub"]')
    await waitForText('Choose your battle')

    // ── Profile: stats, train, daily claim, tutorial ───────────
    click('[data-nav="profile"]')
    await waitForText('PROFILE')
    expect(document.body.textContent).toContain('E-Rank') // level 1 rank title
    expect(document.body.textContent).toContain('Daily reward')
    const dailyBtn = await waitFor('#daily-claim')
    dailyBtn.click()
    await flush(2)
    expect(alerts.join(' ')).toContain('Streak 1')
    expect(ctx.store.requireState().lastDailyClaim).toBeTruthy()
    expect(ctx.store.requireState().tutorial.completed).toContain('claim_daily')

    // ── Inventory: equip the starting weapon ───────────────────
    click('[data-nav="hub"]')
    await waitForText('Choose your battle')
    // Inventory is reached via Roster in V0 nav
    click('[data-nav="roster"]')
    await waitForText('ROSTER')
    click('[data-nav="inventory"]')
    await waitForText('INVENTORY')
    const equipBtn = document.querySelector<HTMLButtonElement>('[data-equip]')
    expect(equipBtn).toBeTruthy()
    equipBtn!.click()
    await flush(2)
    expect(ctx.store.requireState().equipped.weapon).toBeTruthy()
    expect(ctx.store.requireState().tutorial.completed).toContain('equip_weapon')
    expect(ctx.store.requireState().tutorial.completed).toContain('check_inventory')

    // ── Settings: export produces a valid save ─────────────────
    click('[data-nav="hub"]')
    await waitForText('Choose your battle')
    click('[data-nav="settings"]')
    await waitForText('SETTINGS')
    click('#export')
    const box = document.querySelector<HTMLTextAreaElement>('#export-box')!
    expect(box.hidden).toBe(false)
    const parsed = JSON.parse(box.value)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.player.name).toBe('TourTester')

    // Profile tab records profile_viewed
    click('[data-nav="profile"]')
    await waitForText('PROFILE')
    expect(ctx.store.requireState().tutorial.completed).toContain('check_profile')
  })
})
