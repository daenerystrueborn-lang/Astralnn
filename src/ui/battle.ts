// Battle screen — enemy/player panels, HP/MP bars, actions, combat log.
// One round per click: playerAction() runs the bot's full turn math.

import { gearMap, locationMap, skillMap } from '../data/index'
import { playerAction, type BattleSession, type BattleAction } from '../engine/battle'
import {
  BOSS_POTION_LIMIT,
  bossPotionsRemaining,
  describeConsumable,
  isBossPotion,
  isUsableConsumable,
  useConsumable,
} from '../engine/shop'
import { classBattler, gearIconOr, monsterOr } from './icon'
import type { Floater, UiContext } from './app'

export function renderBattle(root: HTMLElement, ctx: UiContext): void {
  const player = ctx.store.requireState()
  const session = (player.battleState ?? null) as unknown as BattleSession | null
  if (!session || session.status !== 'active') {
    ctx.navigate('hub')
    return
  }

  const enemy = session.enemy
  const tierClass = enemy.isBoss ? 'boss' : enemy.tier === 'elite' ? 'elite' : ''
  const locTitle = locationMap[session.locationId]?.name ?? session.locationId
  const shieldVal = enemy.shield ?? 0
  const sigArmed = Boolean(enemy.signatureArmed && enemy.signature)
  const equipped = player.equippedSkills
    .map((id) => skillMap[id])
    .filter((s): s is NonNullable<typeof s> => Boolean(s))

  const potionCounts = new Map<string, number>()
  for (const id of player.inventory) {
    const it = gearMap[id]
    if (!isUsableConsumable(it, true)) continue
    if (enemy.isBoss && !isBossPotion(it)) continue
    potionCounts.set(id, (potionCounts.get(id) ?? 0) + 1)
  }
  const bossPotsLeft = enemy.isBoss ? bossPotionsRemaining(session) : null
  const heroShield = session.playerShield ?? 0
  const heroBuffTags: string[] = []
  if (heroShield > 0) heroBuffTags.push(`<span class="shield-pill">🛡️ ${heroShield}</span>`)
  if (session.warcry && session.warcry.hits > 0) {
    heroBuffTags.push(`<span class="tier-tag overdrive">🔥 +${session.warcry.percent}%×${session.warcry.hits}</span>`)
  }
  if (session.ironskin && session.ironskin.hits > 0) {
    heroBuffTags.push(`<span class="shield-pill">🪨 -${session.ironskin.percent}%×${session.ironskin.hits}</span>`)
  }
  if (session.regen && session.regen.remaining > 0) {
    heroBuffTags.push(`<span class="tier-tag">💚 +${session.regen.amount}×${session.regen.remaining}t</span>`)
  }

  const logHtml =
    ctx.battleLog.length === 0
      ? `<div class="ev-info">The battle begins…</div>`
      : ctx.battleLog
          .map((e) => `<div class="ev-${e.kind}">${escapeHtml(e.text)}</div>`)
          .join('')

  const playerSprite = classBattler(player.classId, { scale: 0.9 })

  // Consume the one-shot floaters queued by the previous action.
  const floats = ctx.floaters
  ctx.floaters = []
  const floatHtml = (side: Floater['side']): string =>
    floats
      .filter((f) => f.side === side)
      .map((f) => `<span class="floater f-${f.kind}">${f.text}</span>`)
      .join('')
  const hitSide = floats.find((f) => f.kind !== 'miss')?.side ?? null
  const stageImpact = hitSide ? ' impact' : ''

  root.innerHTML = `
    <h1>${enemy.isBoss ? '👑 BOSS BATTLE' : 'BATTLE'}</h1>
    <p class="subtitle">${escapeHtml(locTitle)} · Floor ${session.floor} · Turn ${session.turn}</p>

    <div class="battlefield${enemy.isBoss ? ' boss-arena' : ''}">
      <div class="combatant${enemy.isBoss ? ' boss' : ''}${hitSide === 'foe' ? ' hit' : ''}">
        <div class="cname">
          <span class="cname-name">${enemy.emoji} ${escapeHtml(enemy.name)}</span>
          <span>
            ${enemy.enraged ? `<span class="tier-tag overdrive">🔥 overdrive</span> ` : ''}
            ${shieldVal > 0 ? `<span class="shield-pill">🛡️ ${shieldVal}</span> ` : ''}
            <span class="tier-tag ${tierClass}">${enemy.tier}</span>
          </span>
        </div>
        <div class="bar hp"><i style="width:${pct(enemy.hp, enemy.maxHp)}%"></i><span>${enemy.hp}/${enemy.maxHp}</span></div>
        ${floatHtml('foe')}
      </div>

      <div class="stage${stageImpact}" aria-hidden="true">
        <span class="stage-foe${enemy.isBoss ? ' boss' : ''}">${monsterOr(enemy.id, enemy.emoji, enemy.element)}</span>
        <span class="stage-vs">⚔️</span>
        <span class="stage-hero">${playerSprite || '🛡️'}</span>
      </div>

      <div class="combatant${hitSide === 'hero' ? ' hit' : ''}">
        <div class="cname">
          <span class="cname-name">🛡️ ${escapeHtml(player.name)}</span>
          <span>${heroBuffTags.join(' ')} <span class="muted">Lv ${player.level}</span></span>
        </div>
        <div class="bar hp"><i style="width:${pct(player.hp, player.maxHp)}%"></i><span>HP ${player.hp}/${player.maxHp}</span></div>
        <div class="bar mp" style="margin-top:4px"><i style="width:${pct(player.mp, player.maxMp)}%"></i><span>MP ${player.mp}/${player.maxMp}</span></div>
        ${floatHtml('hero')}
      </div>

      ${
        sigArmed
          ? `<div class="telegraph-banner" role="status">⚠️ <b>${escapeHtml(enemy.signature!.name)}</b> incoming next strike — hit <b>🛡️ Defend</b> to guard!</div>`
          : ''
      }

      <div class="actions">
        <button class="btn" data-act="attack" type="button">⚔️ Attack</button>
        <button class="btn${sigArmed ? ' btn-telegraph' : ''}" data-act="defend" type="button">🛡️ Defend</button>
        ${equipped
          .map((s) => {
            const unaffordable = s.mpCost > player.mp
            return `<button class="btn ${s.mpCost > 0 ? '' : 'full'}" data-skill="${s.id}" ${unaffordable ? 'disabled' : ''}
              title="${escapeHtml(s.description ?? '')}">✨ ${escapeHtml(s.name)} <span class="muted">${s.mpCost} MP</span></button>`
          })
          .join('')}
      </div>

      ${
        potionCounts.size > 0
          ? `<div class="potion-belt">
              <div class="potion-belt-head">
                <span>🧪 Quick Potions</span>
                ${bossPotsLeft !== null ? `<span class="muted">Boss limit: ${bossPotsLeft}/${BOSS_POTION_LIMIT} left</span>` : '<span class="muted">Free action</span>'}
              </div>
              <div class="potion-belt-list">
                ${[...potionCounts.entries()]
                  .map(([id, qty]) => {
                    const it = gearMap[id]!
                    const capReached = bossPotsLeft !== null && bossPotsLeft <= 0
                    return `<button class="btn btn-sm btn-ghost potion-chip" data-potion="${id}" ${capReached ? 'disabled' : ''}
                      title="${escapeHtml(describeConsumable(it))}" type="button">
                      ${gearIconOr(it)} ${escapeHtml(it.name)} <span class="muted">×${qty}</span>
                    </button>`
                  })
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <div class="log" id="battle-log">${logHtml}</div>
    </div>
  `

  const logEl = root.querySelector<HTMLElement>('#battle-log')!
  logEl.scrollTop = logEl.scrollHeight

  function act(action: BattleAction): void {
    // Box the outcome so TS doesn't narrow it to the initializer across the
    // closure boundary.
    const box: { outcome: 'won' | 'lost' | 'ongoing'; events: { kind: string; text: string }[] } = {
      outcome: 'ongoing',
      events: [],
    }
    ctx.store.update((p) => {
      // session is p.battleState (same reference — mutations land in the save).
      const r = playerAction(p, session!, action)
      box.events = r.events
      box.outcome = r.status === 'won' ? 'won' : r.status === 'lost' ? 'lost' : 'ongoing'
      if (box.outcome !== 'ongoing') ctx.setLastResult(r)
    })
    ctx.pushLog(box.events)
    // Queue hit feedback for the re-render (dropped when the fight ends —
    // results/death screens don't render floaters).
    ctx.floaters = box.outcome === 'ongoing' ? floatersFrom(box.events) : []
    if (box.outcome === 'won') ctx.navigate('results')
    else if (box.outcome === 'lost') ctx.navigate('death')
    else ctx.navigate('battle')
  }

  root.querySelector('[data-act="attack"]')!.addEventListener('click', () => act({ kind: 'attack' }))
  root.querySelector('[data-act="defend"]')!.addEventListener('click', () => act({ kind: 'defend' }))
  root.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach((btn) => {
    btn.addEventListener('click', () => act({ kind: 'skill', skillId: btn.dataset.skill! }))
  })
  root.querySelectorAll<HTMLButtonElement>('[data-potion]').forEach((btn) => {
    btn.addEventListener('click', () => {
      let err: string | undefined
      const lines: { kind: string; text: string }[] = []
      ctx.store.update((p) => {
        const s = p.battleState as unknown as BattleSession
        const out = useConsumable(p, btn.dataset.potion!, s)
        if (!out.ok) {
          err = out.error
          return
        }
        const suffix =
          out.bossPotionsLeft !== null && out.bossPotionsLeft !== undefined
            ? ` (${out.bossPotionsLeft}/${BOSS_POTION_LIMIT} boss potions left)`
            : ''
        lines.push({
          kind: 'info',
          text: `🧪 Used ${out.item?.name}: ${(out.lines ?? []).join(' ')}${suffix}`,
        })
      })
      if (err) {
        ctx.pushLog([{ kind: 'error', text: err }])
      } else {
        ctx.pushLog(lines)
      }
      ctx.navigate('battle')
    })
  })
}

function pct(cur: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, (cur / max) * 100))
}

/** Turn engine events into floating damage/miss indicators. */
function floatersFrom(events: { kind: string; text: string }[]): Floater[] {
  const out: Floater[] = []
  for (const e of events) {
    if (e.kind === 'hit' || e.kind === 'crit') {
      const m = e.text.match(/(\d+)\s*damage/)
      out.push({ side: 'foe', kind: e.kind, text: m ? `-${m[1]}` : e.kind === 'crit' ? 'CRIT' : 'HIT' })
    } else if (e.kind === 'hurt') {
      const m = e.text.match(/for (\d+) damage/)
      out.push({ side: 'hero', kind: 'hurt', text: m ? `-${m[1]}` : 'OUCH' })
    } else if (e.kind === 'miss') {
      // Player misses read "strike misses"; enemy misses just "misses".
      const playerMissed = e.text.includes('strike misses')
      out.push({ side: playerMissed ? 'foe' : 'hero', kind: 'miss', text: 'MISS' })
    }
  }
  return out.slice(-3)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
