// Inventory / equipment — 7 physical slots, equip/unequip, item stats.
// Opening this screen records the tutorial's inventory_viewed event.

import { gearMap } from '../data/index'
import type { GearDef } from '../data/types'
import { PHYSICAL_EQUIPMENT_SLOTS, equipItem, unequipSlot, equippedItemId } from '../engine/equipment'
import { recordTutorialEvent } from '../engine/tutorial'
import type { UiContext } from './app'

export function renderInventory(root: HTMLElement, ctx: UiContext): void {
  // Tutorial hook: viewing the inventory is the step (event-driven only).
  ctx.store.update((p) => {
    recordTutorialEvent(p, 'inventory_viewed')
  })
  draw()

  function draw(): void {
    const player = ctx.store.requireState()

    const slots = PHYSICAL_EQUIPMENT_SLOTS.map((slot) => {
      const id = equippedItemId(player.equipped, slot)
      const item = id ? gearMap[id] : null
      return `
        <div class="loc" style="cursor:default">
          <div>
            <div class="loc-sub">${slot}</div>
            <div class="loc-name">${item ? item.name : '<span class="muted">empty</span>'}</div>
          </div>
          ${item ? `<button class="btn btn-sm btn-ghost" data-unequip="${slot}" type="button">✕</button>` : ''}
        </div>`
    }).join('')

    const inv = player.inventory.map((id) => {
      const item = gearMap[id]
      if (!item) return ''
      const equippable = item.slot && item.type !== 'consumable' && item.type !== 'material'
      return `
        <div class="loc" style="cursor:default">
          <div>
            <div class="loc-name">${item.name}</div>
            <div class="loc-sub">${describe(item)}</div>
          </div>
          ${equippable ? `<button class="btn btn-sm" data-equip="${id}" type="button">Equip</button>` : `<span class="muted">${item.type}</span>`}
        </div>`
    }).join('')

    root.innerHTML = `
      <h1>INVENTORY</h1>
      <p class="subtitle">${player.inventory.length} item${player.inventory.length === 1 ? '' : 's'} carried</p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
        <button class="tab" data-nav="roster" type="button">Roster</button>
      </div>

      <div class="panel">
        <h3>Equipped</h3>
        ${slots}
      </div>

      <div class="panel">
        <h3>Carried</h3>
        ${inv || '<p class="muted">Nothing carried.</p>'}
      </div>
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })
    root.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let outcome: ReturnType<typeof equipItem> | null = null
        ctx.store.update((p) => {
          outcome = equipItem(p as never, btn.dataset.equip!)
          if (outcome.ok && (outcome as { slot?: string }).slot === 'weapon') {
            recordTutorialEvent(p, 'weapon_equipped')
          }
        })
        if (!outcome!.ok) alert(outcome!.error)
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-unequip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.store.update((p) => {
          unequipSlot(p as never, btn.dataset.unequip!)
        })
        draw()
      })
    })
  }
}

function describe(item: GearDef): string {
  const b = item.statBonuses
  const parts: string[] = []
  if (b.str) parts.push(`STR+${b.str}`)
  if (b.agi) parts.push(`AGI+${b.agi}`)
  if (b.int) parts.push(`INT+${b.int}`)
  if (b.def) parts.push(`DEF+${b.def}`)
  if (b.lck) parts.push(`LCK+${b.lck}`)
  if (b.maxHp) parts.push(`HP+${b.maxHp}`)
  if (b.maxMp) parts.push(`MP+${b.maxMp}`)
  const gate = item.levelReq > 1 ? ` · Lv${item.levelReq}` : ''
  return `${item.rarity} · ${parts.join(' ') || item.type}${gate}`
}
