// Inventory, Consumables & Town Shop — 7 physical slots, equip/unequip,
// drink consumables, sell spare items, and browse/buy from the Town Shop.
// Opening this screen records the tutorial's inventory_viewed event.

import { gearMap } from '../data/index'
import type { GearDef } from '../data/types'
import { PHYSICAL_EQUIPMENT_SLOTS, equipItem, unequipSlot, equippedItemId } from '../engine/equipment'
import {
  buyShopItem,
  describeConsumable,
  isUsableConsumable,
  sellInventoryItem,
  shopArmor,
  shopPotions,
  shopWeapons,
  useConsumable,
} from '../engine/shop'
import { recordTutorialEvent } from '../engine/tutorial'
import { gearIconOr, iconOr } from './icon'
import type { UiContext } from './app'

type ViewTab = 'bag' | 'potions' | 'weapons' | 'armor'

export function renderInventory(root: HTMLElement, ctx: UiContext): void {
  // Tutorial hook: viewing the inventory is the step (event-driven only).
  ctx.store.update((p) => {
    recordTutorialEvent(p, 'inventory_viewed')
  })

  let view: ViewTab = 'bag'
  let bannerMsg = ''
  draw()

  function draw(): void {
    const player = ctx.store.requireState()

    const counts = new Map<string, number>()
    for (const id of player.inventory) counts.set(id, (counts.get(id) ?? 0) + 1)

    const slotsHtml = PHYSICAL_EQUIPMENT_SLOTS.map((slot) => {
      const id = equippedItemId(player.equipped, slot)
      const item = id ? gearMap[id] : null
      return `
        <div class="loc" style="cursor:default">
          <div class="item-row">
            <span class="item-icon">${item ? gearIconOr(item) : '▫️'}</span>
            <div>
              <div class="loc-sub">${slot}</div>
              <div class="loc-name">${item ? escapeHtml(item.name) : '<span class="muted">empty</span>'}</div>
              ${item ? `<div class="loc-sub">${describeGear(item)}</div>` : ''}
            </div>
          </div>
          ${item ? `<button class="btn btn-sm btn-ghost" data-unequip="${slot}" type="button">✕</button>` : ''}
        </div>`
    }).join('')

    const bagRows = [...counts.entries()]
      .map(([id, qty]) => {
        const item = gearMap[id]
        if (!item) return ''
        const equippable = Boolean(item.slot && item.type !== 'consumable' && item.type !== 'material')
        const usable = isUsableConsumable(item, false)
        const sellable = Number(item.sellPrice) > 0 && !item.exclusive && item.id !== 'ghostblade'
        return `
          <div class="loc" style="cursor:default">
            <div class="item-row">
              <span class="item-icon">${gearIconOr(item)}</span>
              <div>
                <div class="loc-name">${escapeHtml(item.name)}${qty > 1 ? ` <span class="muted">×${qty}</span>` : ''}</div>
                <div class="loc-sub">${item.type === 'consumable' ? describeConsumable(item) : describeGear(item)}</div>
              </div>
            </div>
            <div class="item-actions">
              ${equippable ? `<button class="btn btn-sm" data-equip="${id}" type="button">Equip</button>` : ''}
              ${usable ? `<button class="btn btn-sm btn-primary" data-use="${id}" type="button">Use</button>` : ''}
              ${sellable ? `<button class="btn btn-sm btn-ghost" data-sell="${id}" type="button">Sell ☀️${item.sellPrice}</button>` : ''}
            </div>
          </div>`
      })
      .join('')

    function renderShelf(list: GearDef[], isPotionShelf: boolean): string {
      return list
        .map((item) => {
          const price = item.buyPrice ?? 0
          const req = item.levelReq ?? 1
          const levelLocked = player.level < req
          const cantAfford = player.wallet.solars < price
          const owned = counts.get(item.id) ?? 0
          return `
            <div class="loc ${levelLocked ? 'locked' : ''}" style="cursor:default">
              <div class="item-row">
                <span class="item-icon">${gearIconOr(item)}</span>
                <div>
                  <div class="loc-name">${escapeHtml(item.name)}${owned ? ` <span class="muted">(owned ${owned})</span>` : ''}</div>
                  <div class="loc-sub">
                    ${isPotionShelf ? describeConsumable(item) : describeGear(item)}
                    · ☀️ ${price}${levelLocked ? ` · 🔒 Lv${req}` : ''}
                  </div>
                </div>
              </div>
              <div class="item-actions">
                <button class="btn btn-sm ${cantAfford || levelLocked ? 'btn-ghost' : 'btn-primary'}"
                  data-buy="${item.id}" data-qty="1" ${cantAfford || levelLocked ? 'disabled' : ''} type="button">
                  Buy ☀️${price}
                </button>
                ${
                  isPotionShelf
                    ? `<button class="btn btn-sm btn-ghost" data-buy="${item.id}" data-qty="5"
                        ${player.wallet.solars < price * 5 || levelLocked ? 'disabled' : ''} type="button">×5</button>`
                    : ''
                }
              </div>
            </div>`
        })
        .join('')
    }

    root.innerHTML = `
      <h1>INVENTORY</h1>
      <p class="subtitle">
        ${player.inventory.length} item${player.inventory.length === 1 ? '' : 's'} carried ·
        ${iconOr('icons/coin_crown', '☀️')} <b>${Math.floor(player.wallet.solars)}</b> ·
        ❤️ ${player.hp}/${player.maxHp} · 💙 ${player.mp}/${player.maxMp}
      </p>

      <div class="tabs">
        <button class="tab" data-nav="hub" type="button">← Hub</button>
        <button class="tab" data-nav="roster" type="button">Roster</button>
      </div>

      <div class="tabs">
        <button class="tab ${view === 'bag' ? 'active' : ''}" data-view="bag" type="button">🎒 Bag & Gear</button>
        <button class="tab ${view === 'potions' ? 'active' : ''}" data-view="potions" type="button">🧪 Potions</button>
        <button class="tab ${view === 'weapons' ? 'active' : ''}" data-view="weapons" type="button">⚔️ Weapons</button>
        <button class="tab ${view === 'armor' ? 'active' : ''}" data-view="armor" type="button">🛡️ Armor</button>
      </div>

      ${bannerMsg ? `<div class="shop-notice" role="status">${escapeHtml(bannerMsg)}</div>` : ''}

      ${
        view === 'bag'
          ? `
            <div class="panel">
              <h3>Equipped</h3>
              ${slotsHtml}
            </div>
            <div class="panel">
              <h3>Carried</h3>
              ${bagRows || '<p class="muted">Nothing carried — visit 🧪 Potions or ⚔️ Weapons to gear up.</p>'}
            </div>`
          : view === 'potions'
            ? `<div class="panel"><h3>🧪 Apothecary · Potions & Tonics</h3>${renderShelf(shopPotions, true)}</div>`
            : view === 'weapons'
              ? `<div class="panel"><h3>⚔️ Blacksmith · Weapons</h3>${renderShelf(shopWeapons, false)}</div>`
              : `<div class="panel"><h3>🛡️ Armorer · Armor & Relics</h3>${renderShelf(shopArmor, false)}</div>`
      }
    `

    root.querySelectorAll<HTMLElement>('[data-nav]').forEach((el) => {
      el.addEventListener('click', () => ctx.navigate(el.dataset.nav as never))
    })
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        view = btn.dataset.view as ViewTab
        bannerMsg = ''
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let outcome: ReturnType<typeof equipItem> | null = null
        ctx.store.update((p) => {
          outcome = equipItem(p as never, btn.dataset.equip!)
          if (outcome.ok && outcome.slot === 'weapon') {
            recordTutorialEvent(p, 'weapon_equipped')
          }
        })
        if (!outcome!.ok) alert(outcome!.error)
        else bannerMsg = `⚔️ Equipped ${gearMap[outcome!.itemId ?? '']?.name ?? 'gear'}.`
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-unequip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.store.update((p) => {
          unequipSlot(p as never, btn.dataset.unequip!)
        })
        bannerMsg = ''
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-use]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let res: ReturnType<typeof useConsumable> | null = null
        ctx.store.update((p) => {
          res = useConsumable(p, btn.dataset.use!, null)
        })
        if (!res!.ok) alert(res!.error)
        else bannerMsg = `${res!.item?.name}: ${(res!.lines ?? []).join(' ')}`
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-sell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let res: ReturnType<typeof sellInventoryItem> | null = null
        ctx.store.update((p) => {
          res = sellInventoryItem(p, btn.dataset.sell!, 1)
        })
        if (!res!.ok) alert(res!.error)
        else bannerMsg = `💰 Sold ${res!.item?.name} for ☀️ ${res!.earned}.`
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const qty = Number(btn.dataset.qty) || 1
        let res: ReturnType<typeof buyShopItem> | null = null
        ctx.store.update((p) => {
          res = buyShopItem(p, btn.dataset.buy!, qty)
        })
        if (!res!.ok) alert(res!.error)
        else bannerMsg = `🛒 Bought ${res!.item?.name}${qty > 1 ? ` ×${qty}` : ''} (−☀️ ${res!.totalCost}).`
        draw()
      })
    })
  }
}

function describeGear(item: GearDef): string {
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
  return `${item.rarity} · ${parts.join(' ') || item.slot || item.type}${gate}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
