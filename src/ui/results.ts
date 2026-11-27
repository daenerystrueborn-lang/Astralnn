// Results (win) + death (loss) screens.
// Rewards were already settled inside playerAction → creditKillV0/handleDeathV0.

import { gearMap } from '../data/index'
import { iconOr } from './icon'
import type { UiContext } from './app'

export function renderResults(root: HTMLElement, ctx: UiContext): void {
  const player = ctx.store.requireState()
  const result = ctx.lastResult
  const rewards = result?.rewards

  root.innerHTML = `
    <div class="result-title win">VICTORY</div>
    <p class="subtitle">${player.name} stands triumphant</p>

    <div class="panel">
      ${line('XP gained', `+${rewards?.xp ?? 0} ${iconOr('icons/icon_xp_star', '⭐')}`)}
      ${line('Solars', `+${rewards?.solars ?? 0} ${iconOr('icons/coin_crown', '☀️')}`)}
      ${line('Wins', `${player.stats.wins}`)}
      ${
        rewards?.drops?.length
          ? rewards.drops.map((d) => line('Drop', gearMap[d]?.name ?? d)).join('')
          : ''
      }
      ${
        rewards?.levelMsgs?.length
          ? `<div class="levelup-box">${rewards.levelMsgs.map(escapeHtml).join('<br/>')}</div>`
          : ''
      }
      ${
        rewards?.dungeonConquered
          ? `<div class="levelup-box">👑 DUNGEON CONQUERED!${rewards.conquestTitle ? `<br/>🎖️ Title: "${escapeHtml(rewards.conquestTitle)}"` : ''}</div>`
          : ''
      }
      ${
        rewards?.rankChange
          ? `<div class="levelup-box">🎖️ ${escapeHtml(rewards.rankChange.from)} → ${escapeHtml(rewards.rankChange.to)}</div>`
          : ''
      }
      <div class="reward-line"><span>Level</span><b>${player.level}</b></div>
    </div>

    <button class="btn btn-primary" id="res-continue" type="button">CONTINUE</button>
  `

  root.querySelector('#res-continue')!.addEventListener('click', () => {
    ctx.setLastResult(null)
    ctx.navigate('hub')
  })
}

export function renderDeath(root: HTMLElement, ctx: UiContext): void {
  const player = ctx.store.requireState()

  root.innerHTML = `
    <div class="result-title lose">DEFEATED</div>
    <p class="subtitle">${player.name} falls… and wakes in Astral Town</p>

    <div class="panel">
      ${line('HP restored', `${player.hp}/${player.maxHp} (50%)`)}
      ${line('MP restored', `${player.mp}/${player.maxMp} (50%)`)}
      ${line('Losses', `${player.stats.losses}`)}
      <p class="muted center mt">Gear loss and hospital bills arrive in a later slice.</p>
    </div>

    <button class="btn btn-primary" id="death-continue" type="button">RETURN TO TOWN</button>
  `

  root.querySelector('#death-continue')!.addEventListener('click', () => {
    ctx.setLastResult(null)
    ctx.navigate('hub')
  })
}

function line(label: string, value: string): string {
  return `<div class="reward-line"><span>${label}</span><b>${value}</b></div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
