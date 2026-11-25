// Home / hub — HUD, stats, nav, location list + floor picker → start a battle.

import { classes, locations, races } from '../data/index'
import { getTotalStats } from '../engine/stats'
import { getRankForLevel } from '../engine/progression'
import { startBattle } from '../engine/battle'
import { claimableCount, ensureQuestState } from '../engine/quests'
import { getCurrentStep, rewardLabel, skipTutorial, tutorialProgress } from '../engine/tutorial'
import type { UiContext } from './app'

function xpIntoLevel(level: number, xp: number, xpFor: (l: number) => number): { into: number; need: number } {
  const need = xpFor(level + 1) - xpFor(level)
  return { into: Math.max(0, xp), need: Math.max(1, need) }
}

export function renderHub(root: HTMLElement, ctx: UiContext): void {
  const player = ctx.store.requireState()
  const cls = classes[player.classId]
  const race = races[player.raceId]
  const total = getTotalStats(player.classId, player.raceId, player.level)

  // Tutorial card + quest badge (cheap reads; mutation happens elsewhere).
  ensureQuestState(player)
  const questBadge = claimableCount(player)
  const tutStep = getCurrentStep(player)
  const tut = tutorialProgress(player)

  function tutorialCard(): string {
    if (tut.graduated) return ''
    if (!tutStep) return ''
    return `
      <div class="panel" style="border-color:var(--gold)">
        <div class="row">
          <div>
            <h3>📖 Tutorial · ${tut.completed}/${tut.total}</h3>
            <p class="muted"><b style="color:var(--ink)">${tutStep.title}</b> — ${tutStep.instruction}</p>
            <p class="muted">🎁 ${rewardLabel(tutStep.reward) || 'no reward'}</p>
          </div>
          <button class="btn btn-sm btn-ghost" id="tut-skip-hub" type="button">Skip</button>
        </div>
        <div class="bar xp" style="margin-top:6px"><i style="width:${tut.percent}%"></i><span>${tut.percent}%</span></div>
      </div>`
  }

  // Import lazily to keep startup light.
  void import('../engine/xp').then(({ xpForLevel }) => {
    const box = root.querySelector('#xp-box')
    if (!box) return
    const { into, need } = xpIntoLevel(player.level, player.xp, xpForLevel)
    box.innerHTML = `<div class="bar xp"><i style="width:${Math.min(100, (into / need) * 100).toFixed(1)}%"></i><span>XP ${into}/${need}</span></div>`
  })

  const dungeonLocs = locations.filter((l) => l.floors && l.floors > 0 && l.type !== 'town')

  root.innerHTML = `
    <div class="hud">
      <span class="name">${player.name}</span>
      <span class="meta">${player.classId.charAt(0).toUpperCase() + player.classId.slice(1)} · ${race?.name ?? player.raceId} · Lv ${player.level}</span>
      <span class="wallet">☀️ <b>${player.wallet.solars ?? 0}</b></span>
      <span class="wallet">💎 <b>${player.wallet.gems ?? 0}</b></span>
      <span class="meta">⚡ ${player.stamina?.current ?? 0}/${player.stamina?.max ?? 30}</span>
      <span class="meta">🏆 ${player.stats.wins ?? 0}W / ${player.stats.losses ?? 0}L</span>
    </div>
    <div id="xp-box"><div class="bar xp"><i style="width:0%"></i><span>XP</span></div></div>

    <div class="tabs">
      <button class="tab active" data-nav="hub" type="button">Battle</button>
      <button class="tab" data-nav="dungeon" type="button">Dungeon</button>
      <button class="tab" data-nav="roster" type="button">Roster</button>
      <button class="tab" data-nav="quests" type="button">Quests${questBadge ? ` · ${questBadge}` : ''}</button>
      <button class="tab" data-nav="profile" type="button">Profile</button>
      <button class="tab" data-nav="settings" type="button">Settings</button>
    </div>

    ${tutorialCard()}

    <div class="panel">
      <h3>Stats ${player.statPoints.unallocated > 0 ? `<span class="muted">(${player.statPoints.unallocated} points)</span>` : ''}</h3>
      <div class="stats-grid">
        ${(
          [
            ['str', 'STR'],
            ['agi', 'AGI'],
            ['int', 'INT'],
            ['def', 'DEF'],
            ['lck', 'LCK'],
          ] as const
        )
          .map(
            ([k, label]) =>
              `<div class="stat-cell"><b>${total[k] ?? player.stats[k]}</b><span>${label}</span></div>`,
          )
          .join('')}
        <div class="stat-cell"><b>${player.maxHp}</b><span>HP</span></div>
        <div class="stat-cell"><b>${player.maxMp}</b><span>MP</span></div>
      </div>
      <p class="muted center">${cls ? `Primary: ${cls.primaryStat}` : ''} · Rank: ${getRankForLevel(player.level).title}</p>
    </div>

    <h2>Choose your battle</h2>
    <div id="loc-list">
      ${dungeonLocs
        .map((loc) => {
          const prog = player.dungeonProgress[loc.id]
          const highest = prog?.highestFloor ?? 0
          const totalFloors = loc.floors ?? 1
          const nextFloor = Math.min(highest + 1, totalFloors)
          const levelLocked = loc.levelRange && player.level < loc.levelRange[0]
          return `
          <div class="loc ${levelLocked ? 'locked' : ''}" data-id="${loc.id}" ${levelLocked ? '' : 'data-open="1"'}>
            <div>
              <div class="loc-name">${loc.name}</div>
              <div class="loc-sub">
                ${loc.levelRange ? `Lv ${loc.levelRange[0]}–${loc.levelRange[1]} · ` : ''}
                ${highest > 0 ? `Highest floor ${highest}/${totalFloors}` : `Floor ${nextFloor}/${totalFloors}`}
                ${levelLocked ? ' · locked' : ''}
              </div>
            </div>
            <div>${levelLocked ? '🔒' : '⚔️'}</div>
          </div>`
        })
        .join('')}
    </div>

    <div id="floor-panel" hidden></div>
  `

  const floorPanel = root.querySelector<HTMLElement>('#floor-panel')!
  let pickedLoc: string | null = null
  let pickedFloor = 1

  root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
  })
  root.querySelector('#tut-skip-hub')?.addEventListener('click', () => {
    if (!confirm('Skip the tutorial? You will forfeit the graduation gift.')) return
    ctx.store.update((p) => {
      skipTutorial(p)
    })
    ctx.navigate('hub')
  })

  root.querySelector('#loc-list')!.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.loc')
    if (!el || !el.dataset.open) return
    pickedLoc = el.dataset.id!
    const loc = locations.find((l) => l.id === pickedLoc)!
    const highest = player.dungeonProgress[pickedLoc!]?.highestFloor ?? 0
    pickedFloor = Math.min(highest + 1, loc.floors ?? 1)
    renderFloorPanel(loc.id, loc.floors ?? 1)
  })

  function renderFloorPanel(locationId: string, totalFloors: number): void {
    const highest = ctx.store.requireState().dungeonProgress[locationId]?.highestFloor ?? 0
    const maxEnter = Math.min(highest + 1, totalFloors)
    floorPanel.hidden = false
    floorPanel.innerHTML = `
      <div class="panel center">
        <h3>${locations.find((l) => l.id === locationId)?.name}</h3>
        <div class="floor-picker">
          <button class="btn btn-sm" id="f-minus" type="button">−</button>
          <div class="floor-no">F${pickedFloor}</div>
          <button class="btn btn-sm" id="f-plus" type="button">+</button>
        </div>
        <p class="muted">Next unclaimed floor: ${maxEnter} · cleared: ${highest}</p>
        <button class="btn btn-primary" id="f-enter" type="button">ENTER FLOOR ${pickedFloor}</button>
        <button class="btn btn-ghost btn-sm mt" id="f-cancel" type="button">cancel</button>
      </div>
    `
    floorPanel.querySelector('#f-minus')!.addEventListener('click', () => {
      pickedFloor = Math.max(1, pickedFloor - 1)
      renderFloorPanel(locationId, totalFloors)
    })
    floorPanel.querySelector('#f-plus')!.addEventListener('click', () => {
      pickedFloor = Math.min(maxEnter, pickedFloor + 1)
      renderFloorPanel(locationId, totalFloors)
    })
    floorPanel.querySelector('#f-cancel')!.addEventListener('click', () => {
      floorPanel.hidden = true
      floorPanel.innerHTML = ''
    })
    floorPanel.querySelector('#f-enter')!.addEventListener('click', () => {
      try {
        ctx.store.update((p) => {
          p.inDungeon = true
          p.location = locationId
          if (!p.dungeonProgress[locationId]) p.dungeonProgress[locationId] = { highestFloor: 0 }
          p.battleState = startBattle(locationId, pickedFloor) as unknown as typeof p.battleState
        })
        ctx.clearLog()
        ctx.navigate('battle')
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err))
      }
    })
  }
}
