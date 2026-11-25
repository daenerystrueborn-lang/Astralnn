// Registration screen — name, class (9 cards), race (5 visible), stat preview.
// createNewPlayer mirrors the bot's player-factory; validate first for errors.

import { classes, races } from '../data/index'
import { getTotalStats } from '../engine/stats'
import { syncTutorialProgress } from '../engine/tutorial'
import { createNewPlayer, validateRegistration } from '../state/player'
import type { UiContext } from './app'

export function renderRegister(root: HTMLElement, ctx: UiContext): void {
  let name = ''
  let classId = ''
  let raceId = ''

  const visibleRaces = Object.entries(races).filter(([, r]) => r.hidden !== true)
  const classList = Object.entries(classes)

  root.innerHTML = `
    <h1>ASTRAL FANTASY</h1>
    <p class="subtitle">Create your adventurer</p>

    <div class="panel">
      <h3>Name</h3>
      <input class="input" id="reg-name" maxlength="20" placeholder="2–20 characters" autocomplete="off" />
    </div>

    <div class="panel">
      <h3>Class</h3>
      <div class="pick-grid" id="class-grid">
        ${classList
          .map(
            ([id, c]) => `
          <button class="pick" data-id="${id}" type="button">
            <b>${id}</b>
            <span class="stat">${c.primaryStat}</span>
          </button>`,
          )
          .join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Race</h3>
      <div class="chip-row" id="race-row">
        ${visibleRaces
          .map(
            ([id, r]) => `
          <button class="chip" data-id="${id}" type="button">${r.name ?? id}</button>`,
          )
          .join('')}
      </div>
    </div>

    <div class="panel" id="preview" hidden>
      <h3>Starting stats</h3>
      <div class="stats-grid" id="preview-stats"></div>
      <p class="muted center mt" id="preview-passive"></p>
    </div>

    <p class="error" id="reg-error"></p>
    <button class="btn btn-primary" id="reg-create" type="button">ENTER THE KINGDOM</button>
  `

  const nameInput = root.querySelector<HTMLInputElement>('#reg-name')!
  const errorEl = root.querySelector<HTMLElement>('#reg-error')!
  const preview = root.querySelector<HTMLElement>('#preview')!
  const previewStats = root.querySelector<HTMLElement>('#preview-stats')!
  const previewPassive = root.querySelector<HTMLElement>('#preview-passive')!

  nameInput.addEventListener('input', () => {
    name = nameInput.value
  })

  root.querySelector('#class-grid')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.pick')
    if (!btn) return
    classId = btn.dataset.id!
    root.querySelectorAll('.pick').forEach((el) => el.classList.toggle('selected', el === btn))
    updatePreview()
  })

  root.querySelector('#race-row')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip')
    if (!btn) return
    raceId = btn.dataset.id!
    root.querySelectorAll('.chip').forEach((el) => el.classList.toggle('selected', el === btn))
    updatePreview()
  })

  function updatePreview(): void {
    if (!classId || !raceId) {
      preview.hidden = true
      return
    }
    const total = getTotalStats(classId, raceId, 1)
    previewStats.innerHTML = (
      [
        ['str', 'STR'],
        ['agi', 'AGI'],
        ['int', 'INT'],
        ['def', 'DEF'],
        ['lck', 'LCK'],
        ['maxHp', 'HP'],
        ['maxMp', 'MP'],
      ] as const
    )
      .map(([k, label]) => `<div class="stat-cell"><b>${total[k]}</b><span>${label}</span></div>`)
      .join('')
    const race = races[raceId]
    previewPassive.textContent = race?.passive ? `Passive: ${race.passive}` : ''
    preview.hidden = false
  }

  root.querySelector('#reg-create')!.addEventListener('click', () => {
    errorEl.textContent = ''
    const check = validateRegistration({ name, classId, raceId })
    if (!check.ok) {
      errorEl.textContent = check.error ?? 'Invalid registration.'
      return
    }
    try {
      const player = createNewPlayer({
        name: check.name!,
        classId: check.classId!,
        raceId: check.raceId!,
      })
      // Bot's register flow runs the tutorial sync immediately, so the welcome
      // card opens on the first step the player still has to DO.
      syncTutorialProgress(player)
      ctx.store.setPlayer(player)
      ctx.navigate('hub')
    } catch (err) {
      errorEl.textContent = err instanceof Error ? err.message : String(err)
    }
  })
}
