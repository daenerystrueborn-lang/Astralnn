// Dungeon — floor list per location, checkpoints, enter a floor.
// Entering records the tutorial's dungeon_entered event (stateCheck covers
// returning players; the trigger gives immediate feedback).

import { locations } from '../data/index'
import { bossForFloor, nextBossFloor, startBattle } from '../engine/battle'
import { recordTutorialEvent } from '../engine/tutorial'
import { monsterOr } from './icon'
import type { UiContext } from './app'

export function renderDungeon(root: HTMLElement, ctx: UiContext): void {
  draw()

  function draw(): void {
    const player = ctx.store.requireState()
    const dungeonLocs = locations.filter((l) => l.floors && l.floors > 0 && l.type !== 'town')

    root.innerHTML = `
      <h1>DUNGEON</h1>
      <p class="subtitle">One floor, one win — progress saves</p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
      </div>

      <div id="loc-list">
        ${dungeonLocs
          .map((loc) => {
            const prog = player.dungeonProgress[loc.id]
            const highest = prog?.highestFloor ?? 0
            const total = loc.floors ?? 1
            const next = Math.min(highest + 1, total)
            const locked = loc.levelRange && player.level < loc.levelRange[0]
            const checkpoint = loc.checkpointInterval ? Math.floor(highest / loc.checkpointInterval) * loc.checkpointInterval : 0
            const upcomingBoss = nextBossFloor(loc.id, next)
            const bossAtNext = bossForFloor(loc.id, next)
            return `
            <div class="loc ${locked ? 'locked' : ''}" data-id="${loc.id}" ${locked ? '' : 'data-open="1"'}>
              <div>
                <div class="loc-name">${loc.name}${prog?.conquered ? ' <span class="conquered-pill">🏆 Conquered</span>' : ''}</div>
                <div class="loc-sub">
                  Floor ${next}/${total} · cleared ${highest}
                  ${checkpoint ? ` · checkpoint ${checkpoint}` : ''}
                  ${upcomingBoss ? ` · 👑 Boss F${upcomingBoss}` : ''}
                  ${loc.levelRange ? ` · Lv ${loc.levelRange[0]}–${loc.levelRange[1]}` : ''}
                  ${locked ? ' · locked' : ''}
                </div>
              </div>
              <div>${locked ? '🔒' : bossAtNext ? '👑' : '⬇️'}</div>
            </div>`
          })
          .join('')}
      </div>

      <div id="floor-panel" hidden></div>
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })

    const panel = root.querySelector<HTMLElement>('#floor-panel')!
    let locId: string | null = null
    let floor = 1

    root.querySelector('#loc-list')!.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.loc')
      if (!el || !el.dataset.open) return
      locId = el.dataset.id!
      const loc = locations.find((l) => l.id === locId)!
      const highest = ctx.store.requireState().dungeonProgress[locId!]?.highestFloor ?? 0
      floor = Math.min(highest + 1, loc.floors ?? 1)
      renderPanel(loc, highest)
    })

    function renderPanel(loc: (typeof locations)[number], highest: number): void {
      const total = loc.floors ?? 1
      const maxEnter = Math.min(highest + 1, total)
      const boss = bossForFloor(loc.id, floor)
      panel.hidden = false
      panel.innerHTML = `
        <div class="panel center">
          <h3>${loc.name}</h3>
          <div class="floor-picker">
            <button class="btn btn-sm" id="f-minus" type="button">−</button>
            <div class="floor-no">F${floor}</div>
            <button class="btn btn-sm" id="f-plus" type="button">+</button>
          </div>
          ${
            boss
              ? `<div class="boss-preview">
                  <span class="boss-preview-art">${monsterOr(boss.id, boss.emoji ?? '👑', boss.element)}</span>
                  <div>
                    <div class="boss-preview-tag">👑 BOSS FLOOR</div>
                    <div class="boss-preview-name">${boss.name}</div>
                    ${boss.conquestTitle ? `<div class="muted">Title: "${boss.conquestTitle}"</div>` : ''}
                  </div>
                </div>`
              : ''
          }
          <p class="muted">cleared ${highest} · next unclaimed ${maxEnter}</p>
          <button class="btn btn-primary" id="f-enter" type="button">${boss ? `👑 CHALLENGE BOSS · FLOOR ${floor}` : `ENTER FLOOR ${floor}`}</button>
          <button class="btn btn-ghost btn-sm mt" id="f-cancel" type="button">cancel</button>
        </div>
      `
      panel.querySelector('#f-minus')!.addEventListener('click', () => {
        floor = Math.max(1, floor - 1)
        renderPanel(loc, highest)
      })
      panel.querySelector('#f-plus')!.addEventListener('click', () => {
        floor = Math.min(maxEnter, floor + 1)
        renderPanel(loc, highest)
      })
      panel.querySelector('#f-cancel')!.addEventListener('click', () => {
        panel.hidden = true
        panel.innerHTML = ''
      })
      panel.querySelector('#f-enter')!.addEventListener('click', () => {
        try {
          ctx.store.update((p) => {
            p.inDungeon = true
            p.location = loc.id
            if (!p.dungeonProgress[loc.id]) p.dungeonProgress[loc.id] = { highestFloor: 0 }
            p.battleState = startBattle(loc.id, floor) as unknown as typeof p.battleState
            recordTutorialEvent(p, 'dungeon_entered')
          })
          ctx.clearLog()
          ctx.navigate('battle')
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err))
        }
      })
    }
  }
}
