// Roster — owned characters, equip/unequip with real statBonuses, link to spin.

import { characterMap } from '../data/index'
import {
  describeCharacterBonuses,
  equipCharacter,
  syncEquippedCharacterBonus,
} from '../engine/equipment'
import { assetSrc, RARITY_COLORS } from './icon'
import type { UiContext } from './app'

const PORTRAIT_FRAME = assetSrc('icons/portrait_frame_small') ?? ''

export function renderRoster(root: HTMLElement, ctx: UiContext): void {
  ctx.store.update((p) => {
    syncEquippedCharacterBonus(p)
  })
  const player = ctx.store.requireState()
  const owned = player.ownedCharacters.map((id) => characterMap[id]).filter(Boolean)

  root.innerHTML = `
    <h1>ROSTER</h1>
    <p class="subtitle">${owned.length} character${owned.length === 1 ? '' : 's'} owned</p>

    <div class="tabs">
      <button class="tab" data-nav="hub" type="button">← Hub</button>
      <button class="tab" data-nav="spin" type="button">Recruit</button>
      <button class="tab" data-nav="inventory" type="button">Inventory</button>
    </div>

    ${
      owned.length === 0
        ? `<div class="panel center">
             <p class="muted">No characters yet.</p>
             <button class="btn btn-primary" data-nav="spin" type="button">OPEN THE BANNER</button>
           </div>`
        : owned
            .map((c) => {
              const equipped = player.equippedCharacter === c.id
              const rarityColor = RARITY_COLORS[c.rarity] ?? 'var(--gold)'
              const bonusLine = describeCharacterBonuses(c)
              const abilityName = typeof c.ability?.name === 'string' ? c.ability.name : ''
              const abilityDesc =
                typeof c.ability?.description === 'string' ? cleanBrowserCopy(c.ability.description) : ''
              const loreDesc = c.description ? cleanBrowserCopy(c.description) : ''
              return `
              <div class="panel char-card" style="border-color:${rarityColor}55">
                <div class="row">
                  <div class="char-portrait">
                    <span class="char-emoji">${c.emoji}</span>
                    <img class="char-frame" src="${PORTRAIT_FRAME}" alt="" draggable="false" />
                  </div>
                  <div class="char-info">
                    <h3>${c.name} ${equipped ? '· <span style="color:var(--gold)">ACTIVE</span>' : ''}</h3>
                    <p class="muted">${'⭐'.repeat(Math.min(5, c.stars))} · <span style="color:${rarityColor}">${c.rarity}</span>${c.tag ? ` · ${c.tag}` : ''}</p>
                    <p class="muted" style="color:var(--gold-bright);font-size:12px">${bonusLine}</p>
                    <button class="btn btn-sm ${equipped ? 'btn-ghost' : 'btn-primary'}" data-equip="${c.id}" type="button">
                      ${equipped ? 'Unequip' : 'Equip'}
                    </button>
                  </div>
                </div>
                ${abilityName ? `<p class="muted" style="margin-top:6px"><b style="color:var(--ink)">✦ ${abilityName}</b>${abilityDesc ? ` — ${abilityDesc}` : ''}</p>` : ''}
                ${loreDesc ? `<p class="muted">${loreDesc}</p>` : ''}
              </div>`
            })
            .join('')
    }
  `

  root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
  })
  root.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.equip!
      ctx.store.update((p) => {
        equipCharacter(p, p.equippedCharacter === id ? null : id)
      })
      ctx.navigate('roster')
    })
  })
}

function cleanBrowserCopy(raw: string): string {
  return raw
    .replace(/no \.attack,\s*no \.battle attack,/gi, 'no basic attacks,')
    .replace(/answers \.const\b/gi, 'unleashes Constellation Strike')
    .replace(/talks to her with \.clane\b/gi, 'bonds with her')
    .replace(/(?<=\s)\.[a-z]{3,14}\b/gi, (m) => m.slice(1))
}
