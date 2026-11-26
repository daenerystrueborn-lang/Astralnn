// Roster — owned characters, equip/unequip, link to recruitment (spin).

import { characterMap } from '../data/index'
import { assetSrc } from './icon'
import type { UiContext } from './app'

const PORTRAIT_FRAME = assetSrc('icons/portrait_frame_small') ?? ''

/** Character rarity ladder → ART_DIRECTION token colors (9 tiers). */
const RARITY_COLORS: Record<string, string> = {
  wisp: '#9aa7ad',
  spark: '#5fbf7a',
  kindled: '#5b9bd5',
  starlit: '#b072d6',
  ascendant: '#e8b339',
  radiant: '#ff9f43',
  boundless: '#4fc3f7',
  divinity: '#c77dff',
  mythic: '#e05656',
}

export function renderRoster(root: HTMLElement, ctx: UiContext): void {
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
                    <button class="btn btn-sm ${equipped ? 'btn-ghost' : 'btn-primary'}" data-equip="${c.id}" type="button">
                      ${equipped ? 'Unequip' : 'Equip'}
                    </button>
                  </div>
                </div>
                ${c.description ? `<p class="muted">${c.description}</p>` : ''}
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
        p.equippedCharacter = p.equippedCharacter === id ? null : id
      })
      ctx.navigate('roster')
    })
  })
}
