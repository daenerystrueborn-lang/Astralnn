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
})
