// Roster — owned characters, equip/unequip, link to recruitment (spin).

import { characterMap } from '../data/index'
import type { UiContext } from './app'

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
              return `
              <div class="panel">
                <div class="row">
                  <div>
                    <h3>${c.emoji} ${c.name} ${equipped ? '· <span style="color:var(--gold)">ACTIVE</span>' : ''}</h3>
                    <p class="muted">${'⭐'.repeat(Math.min(5, c.stars))} · ${c.rarity}${c.tag ? ` · ${c.tag}` : ''}</p>
                  </div>
                  <button class="btn btn-sm ${equipped ? 'btn-ghost' : 'btn-primary'}" data-equip="${c.id}" type="button">
                    ${equipped ? 'Unequip' : 'Equip'}
                  </button>
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
