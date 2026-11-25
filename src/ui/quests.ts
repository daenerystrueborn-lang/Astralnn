// Quests — today's 3 seeded dailies + milestone board, explicit claim.
// Claiming pays through claimQuest then settles XP via applyLevelUps (bot
// caller contract) and records the tutorial's quest_completed event.

import { claimQuest, claimableCount, ensureQuestState, getQuestBoard, type QuestView } from '../engine/quests'
import { applyLevelUps } from '../engine/progression'
import { recordTutorialEvent } from '../engine/tutorial'
import type { UiContext } from './app'

export function renderQuests(root: HTMLElement, ctx: UiContext): void {
  // Opening the board rotates the day if needed (midnight handling).
  ctx.store.update((p) => {
    ensureQuestState(p)
  })
  draw()

  function draw(): void {
    const player = ctx.store.requireState()
    ensureQuestState(player)
    const board = getQuestBoard(player)
    const claimable = claimableCount(player)

    const card = (q: QuestView, track: 'daily' | 'milestone') => {
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

    root.innerHTML = `
      <h1>QUESTS</h1>
      <p class="subtitle">${claimable ? `${claimable} ready to claim` : 'Progress counts automatically — claims pay out'}</p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
        ${claimable ? `<button class="tab active" id="claim-all" type="button">Claim all (${claimable})</button>` : ''}
      </div>

      <h2>Daily — rotates at midnight</h2>
      ${board.daily.map((q) => card(q, 'daily')).join('')}

      <h2>Milestones — once ever</h2>
      ${board.milestone.map((q) => card(q, 'milestone')).join('') || '<p class="muted">All milestones claimed.</p>'}
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })
    root.querySelector('#claim-all')?.addEventListener('click', () => claim(null))
    root.querySelectorAll<HTMLButtonElement>('[data-claim]').forEach((btn) => {
      btn.addEventListener('click', () => claim(btn.dataset.claim!))
    })

    function claim(id: string | null): void {
      let label = ''
      ctx.store.update((p) => {
        const res = claimQuest(p, id)
        if (res.nothing) return
        label = res.claimed.map((c) => `${c.name} → ${c.rewardLabel ?? ''}`).join('\n')
        // XP paid by quests does not auto-level — settle it like the bot caller.
        applyLevelUps(p)
        recordTutorialEvent(p, 'quest_completed')
      })
      if (label) alert(`Claimed!\n${label}`)
      draw()
    }
  }
}

function describeReward(q: { reward: { type: string; amount: number } }): string {
  const icons: Record<string, string> = { solars: '☀️', gems: '💎', xp: '📈', stamina: '⚡', item: '🎁', weapon: '⚔️', character: '🎴' }
  return `${icons[q.reward.type] ?? '🎁'} ${q.reward.amount} ${q.reward.type}`
}
