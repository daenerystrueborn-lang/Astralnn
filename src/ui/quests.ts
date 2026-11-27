// Quests & Achievements — daily + milestone quests AND permanent Bronze..Diamond
// Achievements board, explicit claim with automatic level-up settlement.

import {
  ACHIEVEMENT_TRACKS,
  claimAchievements,
  claimableAchievementCount,
  getAchievementBoard,
  refreshAchievements,
  tierEmoji,
  tierPoints,
  type AchievementView,
} from '../engine/achievements'
import { claimQuest, claimableCount, ensureQuestState, getQuestBoard, type QuestView } from '../engine/quests'
import { applyLevelUps } from '../engine/progression'
import { recordTutorialEvent } from '../engine/tutorial'
import type { UiContext } from './app'

type BoardTab = 'quests' | 'achievements'

export function renderQuests(root: HTMLElement, ctx: UiContext): void {
  // Opening the board rotates the day if needed and sticky-stamps achievements.
  ctx.store.update((p) => {
    ensureQuestState(p)
    refreshAchievements(p)
  })

  let tab: BoardTab = 'quests'
  let achTrack = 'all'
  let bannerMsg = ''
  draw()

  function draw(): void {
    const player = ctx.store.requireState()
    ensureQuestState(player)
    const board = getQuestBoard(player)
    const questReady = claimableCount(player)
    const achReady = claimableAchievementCount(player)
    const achBoard = getAchievementBoard(player, achTrack)

    const questCard = (q: QuestView, track: 'daily' | 'milestone') => {
      const pct = Math.min(100, Math.round((q.progress / q.goal) * 100))
      const canClaim = q.done && (track === 'milestone' || !q.claimed)
      return `
        <div class="panel">
          <div class="row">
            <div>
              <h3>${q.name} ${q.claimed ? '<span class="muted">· claimed</span>' : ''}</h3>
              <p class="muted">${q.desc}</p>
            </div>
            ${canClaim ? `<button class="btn btn-sm btn-primary" data-claim="${q.id}" type="button">CLAIM</button>` : ''}
          </div>
          <div class="bar xp" style="margin-top:6px">
            <i style="width:${pct}%"></i><span>${q.progress}/${q.goal}</span>
          </div>
          <p class="muted" style="margin-top:6px">Reward: ${describeReward(q)}</p>
        </div>`
    }

    const achCard = (a: AchievementView) => {
      const pct = Math.min(100, Math.round(a.pct * 100))
      return `
        <div class="panel">
          <div class="row">
            <div>
              <h3>${tierEmoji(a.tier)} ${a.name} <span class="muted">· ${tierPoints(a.tier)} pts${a.claimed ? ' · claimed ✓' : ''}</span></h3>
              <p class="muted">${a.desc}</p>
            </div>
            ${a.claimable ? `<button class="btn btn-sm btn-primary" data-ach-claim="${a.id}" type="button">CLAIM</button>` : ''}
          </div>
          <div class="bar xp" style="margin-top:6px">
            <i style="width:${pct}%"></i><span>${a.progress}/${a.goal}</span>
          </div>
          <p class="muted" style="margin-top:6px">Reward: ${describeReward(a)} · Tier: ${a.tier}</p>
        </div>`
    }

    root.innerHTML = `
      <h1>${tab === 'quests' ? 'QUESTS' : 'ACHIEVEMENTS'}</h1>
      <p class="subtitle">
        ${
          tab === 'quests'
            ? questReady
              ? `${questReady} quest${questReady === 1 ? '' : 's'} ready to claim`
              : 'Progress counts automatically — claims pay out'
            : `${achBoard.summary.claimed}/${achBoard.summary.total} claimed · 🏅 ${achBoard.summary.points} pts`
        }
      </p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
        <button class="tab ${tab === 'quests' ? 'active' : ''}" data-tab="quests" type="button">
          📜 Quests${questReady ? ` · ${questReady}` : ''}
        </button>
        <button class="tab ${tab === 'achievements' ? 'active' : ''}" data-tab="achievements" type="button">
          🏅 Achievements${achReady ? ` · ${achReady}` : ''}
        </button>
      </div>

      ${bannerMsg ? `<div class="shop-notice" role="status">${bannerMsg}</div>` : ''}

      ${
        tab === 'quests'
          ? `
            ${questReady ? `<button class="btn btn-primary" id="claim-all" type="button" style="margin-bottom:10px">Claim All Ready Quests (${questReady})</button>` : ''}
            <h2>Daily — rotates at midnight</h2>
            ${board.daily.map((q) => questCard(q, 'daily')).join('')}

            <h2>Milestones — once ever</h2>
            ${board.milestone
              .filter((q) => q.reward.type !== 'seasonPoints')
              .map((q) => questCard(q, 'milestone'))
              .join('') || '<p class="muted">All milestones claimed.</p>'}
          `
          : `
            <div class="tabs">
              <button class="tab ${achTrack === 'all' ? 'active' : ''}" data-ach-track="all" type="button">All</button>
              ${Object.keys(ACHIEVEMENT_TRACKS)
                .map(
                  (t) =>
                    `<button class="tab ${achTrack === t ? 'active' : ''}" data-ach-track="${t}" type="button">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`,
                )
                .join('')}
            </div>
            ${achReady ? `<button class="btn btn-primary" id="ach-claim-all" type="button" style="margin-bottom:10px">Claim All Unlocked Achievements (${achReady})</button>` : ''}
            ${achBoard.groups
              .map(
                (g) => `
                <h2>${g.name} (${g.claimed}/${g.total})</h2>
                ${g.items.map((a) => achCard(a)).join('')}
              `,
              )
              .join('')}
          `
      }
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab as BoardTab
        bannerMsg = ''
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-ach-track]').forEach((btn) => {
      btn.addEventListener('click', () => {
        achTrack = btn.dataset.achTrack!
        draw()
      })
    })
    root.querySelector('#claim-all')?.addEventListener('click', () => claimQuestAction(null))
    root.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
      btn.addEventListener('click', () => claimQuestAction(btn.dataset.claim!))
    })
    root.querySelector('#ach-claim-all')?.addEventListener('click', () => claimAchAction(null))
    root.querySelectorAll<HTMLButtonElement>('[data-ach-claim]').forEach((btn) => {
      btn.addEventListener('click', () => claimAchAction(btn.dataset.achClaim!))
    })

    function claimQuestAction(id: string | null): void {
      let label = ''
      ctx.store.update((p) => {
        const res = claimQuest(p, id)
        if (res.nothing) return
        label = res.claimed.map((c) => `${c.name} → ${c.rewardLabel ?? ''}`).join(' · ')
        applyLevelUps(p)
        recordTutorialEvent(p, 'quest_completed')
        refreshAchievements(p)
      })
      if (label) bannerMsg = `🎁 Claimed: ${label}`
      draw()
    }

    function claimAchAction(id: string | null): void {
      let label = ''
      ctx.store.update((p) => {
        const res = claimAchievements(p, id)
        if (res.nothing) return
        label = res.claimed.map((c) => `${tierEmoji(c.tier)} ${c.name} → ${c.rewardLabel ?? ''}`).join(' · ')
        applyLevelUps(p)
      })
      if (label) bannerMsg = `🏅 Achievement Claimed: ${label}`
      draw()
    }
  }
}

function describeReward(q: { reward: { type: string; amount: number } }): string {
  const icons: Record<string, string> = {
    solars: '☀️',
    gems: '💎',
    xp: '📈',
    stamina: '⚡',
    item: '🎁',
    weapon: '⚔️',
    character: '🎴',
  }
  return `${icons[q.reward.type] ?? '🎁'} ${q.reward.amount} ${q.reward.type}`
}
