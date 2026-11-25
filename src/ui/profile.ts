// Profile — stats, allocation, training, rank, W/L, daily claim, tutorial.
// Opening the record records the tutorial's profile_viewed event.

import { classes, races } from '../data/index'
import { getTotalStats } from '../engine/stats'
import { addAllocation, getRankForLevel, trainCostPerPoint, trainPlayer, statPointCap, getXpProgress } from '../engine/progression'
import { claimDaily } from '../engine/daily'
import { getCurrentStep, recordTutorialEvent, skipTutorial, tutorialProgress } from '../engine/tutorial'
import { classBattler, iconOr } from './icon'
import type { UiContext } from './app'
import type { StatKey } from '../engine/stats'

const STAT_LABELS: [StatKey, string][] = [
  ['str', 'STR'],
  ['agi', 'AGI'],
  ['int', 'INT'],
  ['def', 'DEF'],
  ['lck', 'LCK'],
]

export function renderProfile(root: HTMLElement, ctx: UiContext): void {
  ctx.store.update((p) => {
    recordTutorialEvent(p, 'profile_viewed')
  })
  draw()

  function draw(): void {
    const p = ctx.store.requireState()
    const cls = classes[p.classId]
    const race = races[p.raceId]
    const rank = getRankForLevel(p.level)
    const total = getTotalStats(p.classId, p.raceId, p.level)
    const sp = p.statPoints
    const tut = tutorialProgress(p)
    const step = getCurrentStep(p)
    const trainRate = trainCostPerPoint(p.level)
    const cap = statPointCap(p.level, p)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const claimedToday = p.lastDailyClaim !== null && p.lastDailyClaim >= today.getTime()
    const nextMilestone = [3, 7, 14, 30, 60, 100].find((d) => d > p.dailyStreak)

    root.innerHTML = `
      <h1>PROFILE</h1>
      <p class="subtitle">${p.name} · ${p.classId} · ${race?.name ?? p.raceId}</p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
        <button class="tab" data-nav="settings" type="button">Settings</button>
      </div>

      <div class="panel center">
        <h3>${rank.emoji} ${rank.title}</h3>
        <p class="muted">${rank.epithet} · Lv ${p.level} · 🏆 ${p.stats.wins}W / ${p.stats.losses}L</p>
        <div class="bar xp"><i style="width:${xpPct(p)}%"></i><span>XP ${p.xp} → Lv ${p.level + 1}</span></div>
        <div class="mt">${classBattler(p.classId, { scale: 0.75 })}</div>
        <p class="muted" style="margin-top:6px">
          ${iconOr('icons/coin_crown', '☀️')} ${Math.floor(p.wallet.solars)} ·
          ${iconOr('icons/gem_blue', '💎')} ${p.wallet.gems} ·
          ⚡ ${p.stamina.current}/${p.stamina.max}
        </p>
      </div>

      <div class="panel">
        <h3>Stats <span class="muted">· ${sp.unallocated} unallocated (${sp.earned}/${cap} earned)</span></h3>
        <div class="stats-grid">
          ${STAT_LABELS.map(
            ([k, label]) => `
            <div class="stat-cell">
              <b>${total[k] ?? p.stats[k]}</b>
              <span>${label}</span>
              ${sp.unallocated > 0 ? `<button class="btn btn-sm btn-ghost" data-alloc="${k}" type="button" style="margin-top:4px;width:100%">+1</button>` : ''}
            </div>`,
          ).join('')}
          <div class="stat-cell"><b>${p.maxHp}</b><span>HP</span></div>
          <div class="stat-cell"><b>${p.maxMp}</b><span>MP</span></div>
        </div>
        <div class="grid-2 mt">
          <button class="btn btn-sm" id="train-5" type="button">Train 5 pts · ☀️ ${trainRate * 5}</button>
          <button class="btn btn-sm" id="train-15" type="button">Train 15 pts · ☀️ ${trainRate * 15}</button>
        </div>
        <p class="muted center">Rate at Lv ${p.level}: ☀️ ${trainRate} per point · allocation applies to live stats</p>
      </div>

      <div class="panel">
        <div class="row">
          <div>
            <h3>Daily reward</h3>
            <p class="muted">
              🔥 Streak ${p.dailyStreak}${p.bestDailyStreak ? ` (best ${p.bestDailyStreak})` : ''}
              ${nextMilestone ? ` · milestone at day ${nextMilestone}` : ' · max milestone'}
            </p>
          </div>
          <button class="btn btn-sm ${claimedToday ? 'btn-ghost' : 'btn-primary'}" id="daily-claim" ${claimedToday ? 'disabled' : ''} type="button">
            ${claimedToday ? 'Claimed ✓' : 'CLAIM'}
          </button>
        </div>
      </div>

      <div class="panel">
        <div class="row">
          <div>
            <h3>Tutorial ${tut.graduated ? '🎓' : `· ${tut.completed}/${tut.total}`}</h3>
            <p class="muted">${step ? `${step.title} — ${step.instruction}` : tut.graduated ? 'Graduated from the Astral Academy!' : 'All steps done.'}</p>
          </div>
          ${!tut.graduated ? `<button class="btn btn-sm btn-ghost" id="tut-skip" type="button">Skip</button>` : ''}
        </div>
        <div class="bar xp" style="margin-top:6px"><i style="width:${tut.percent}%"></i><span>${tut.percent}%</span></div>
      </div>
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })
    root.querySelectorAll<HTMLButtonElement>('[data-alloc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.store.update((pl) => {
          addAllocation(pl, btn.dataset.alloc as StatKey, 1)
        })
        draw()
      })
    })
    for (const n of [5, 15]) {
      root.querySelector(`#train-${n}`)?.addEventListener('click', () => {
        let err: string | undefined
        ctx.store.update((pl) => {
          const r = trainPlayer(pl, n)
          if (!r.ok) err = r.error
        })
        if (err === 'poor') alert('Not enough solars to train.')
        else if (err === 'full') alert('Your stat-point pool for this level is full.')
        draw()
      })
    }
    root.querySelector('#daily-claim')?.addEventListener('click', () => {
      let summary = ''
      ctx.store.update((pl) => {
        const out = claimDaily(pl)
        if (out.already) {
          summary = `Already claimed — next at ${out.next.toLocaleTimeString()}.`
          return
        }
        summary =
          `☀️ +${out.solarsReward} · ✨ +${out.xpReward} XP · ⚡ ${out.staminaAfter}/${out.staminaMax}\n` +
          `🔥 Streak ${out.streak}` +
          (out.milestoneHit ? `\n${out.milestoneHit.emoji} ${out.milestoneHit.label} bonus!` : '') +
          (out.lvlMsgs.length ? `\n${out.lvlMsgs.join('\n')}` : '') +
          (out.rankChange ? `\n🎖️ ${out.rankChange.from} → ${out.rankChange.to}` : '')
      })
      alert(summary)
      draw()
    })
    root.querySelector('#tut-skip')?.addEventListener('click', () => {
      if (!confirm('Skip the tutorial? You will forfeit the graduation gift.')) return
      ctx.store.update((pl) => {
        skipTutorial(pl)
      })
      draw()
    })
  }
}

function xpPct(p: { level: number; xp: number }): number {
  const prog = getXpProgress(p.level, p.xp, null)
  return Math.max(0, Math.min(100, Math.round(prog.pct * 100)))
}
