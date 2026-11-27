// Inventory, Consumables & Town Shop — 7 physical slots, equip/unequip,
// drink consumables, sell spare items, and browse/buy from the Town Shop.
// Opening this screen records the tutorial's inventory_viewed event.

import { gearMap, skillMap, skills } from '../data/index'
import type { GearDef, SkillDef } from '../data/types'
import { craftRecipe, craftableCount, getCraftBoard } from '../engine/craft'
import { PHYSICAL_EQUIPMENT_SLOTS, equipItem, unequipSlot, equippedItemId } from '../engine/equipment'
import {
  MAX_SKILL_SLOTS,
  describeSkill,
  equipSkillSlot,
  getEquippedSkills,
  resetBestSkillSlots,
  unequipSkillSlot,
  unlockEligibleSkills,
} from '../engine/skills'
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

type ViewTab = 'bag' | 'skills' | 'forge' | 'potions' | 'weapons' | 'armor'

export function renderInventory(root: HTMLElement, ctx: UiContext): void {
  // Tutorial hook: viewing the inventory is the step (event-driven only).
  ctx.store.update((p) => {
    recordTutorialEvent(p, 'inventory_viewed')
    unlockEligibleSkills(p, skills)
  })

  let view: ViewTab = 'bag'
  let forgeCategory = 'all'
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
        const equippable = Boolean(
        item.slot && item.type !== 'consumable' && item.type !== 'material' && item.type !== 'trophy',
      )
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
        <button class="tab ${view === 'skills' ? 'active' : ''}" data-view="skills" type="button">⚡ Skills (${getEquippedSkills(player).length}/${MAX_SKILL_SLOTS})</button>
        <button class="tab ${view === 'forge' ? 'active' : ''}" data-view="forge" type="button">🔨 Forge${craftableCount(player) ? ` · ${craftableCount(player)}` : ''}</button>
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
          : view === 'skills'
            ? renderSkillLoadout(player)
            : view === 'forge'
              ? renderForgePanel(player, forgeCategory)
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
    root.querySelectorAll<HTMLButtonElement>('[data-skill-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let res: ReturnType<typeof equipSkillSlot> | null = null
        ctx.store.update((p) => {
          res = equipSkillSlot(p, btn.dataset.skillEquip!, skills)
        })
        if (!res!.ok) alert(res!.error)
        else bannerMsg = `⚡ Equipped ${res!.skill?.name} to battle slots.`
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-skill-unequip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.store.update((p) => {
          unequipSkillSlot(p, btn.dataset.skillUnequip!)
        })
        bannerMsg = ''
        draw()
      })
    })
    root.querySelector('#skill-autofill')?.addEventListener('click', () => {
      ctx.store.update((p) => {
        resetBestSkillSlots(p, skills)
      })
      bannerMsg = '⚡ Equipped your 4 highest-level active skills.'
      draw()
    })
    root.querySelectorAll<HTMLButtonElement>('[data-forge-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        forgeCategory = btn.dataset.forgeCat!
        draw()
      })
    })
    root.querySelectorAll<HTMLButtonElement>('[data-forge]').forEach((btn) => {
      btn.addEventListener('click', () => {
        let res: ReturnType<typeof craftRecipe> | null = null
        ctx.store.update((p) => {
          res = craftRecipe(p, btn.dataset.forge!)
        })
        if (!res!.ok) alert(res!.error)
        else bannerMsg = `🔨 Forged ${res!.item?.name} (−☀️ ${res!.solarsSpent})!`
        draw()
      })
    })
  }
}

function renderSkillLoadout(player: {
  level: number
  classId: string
  skills: string[]
  equippedSkills: string[]
}): string {
  const equippedIds = getEquippedSkills(player)
  const equippedSet = new Set(equippedIds)
  const ownedDefs = player.skills
    .map((id) => skillMap[id])
    .filter((s): s is SkillDef => Boolean(s))
    .sort((a, b) => (b.unlockLevel ?? 1) - (a.unlockLevel ?? 1))
  const activePool = ownedDefs.filter((s) => s.type === 'active' && !equippedSet.has(s.id))
  const nextUnlock = skills
    .filter(
      (s) =>
        (s.classId === player.classId || s.universalNeutral === true) &&
        !s.source &&
        (s.unlockLevel ?? 1) > player.level,
    )
    .sort((a, b) => (a.unlockLevel ?? 1) - (b.unlockLevel ?? 1))[0]

  const slotRows = Array.from({ length: MAX_SKILL_SLOTS }, (_, idx) => {
    const id = equippedIds[idx]
    const def = id ? skillMap[id] : null
    return `
      <div class="loc" style="cursor:default">
        <div>
          <div class="loc-sub">Slot ${idx + 1}</div>
          <div class="loc-name">${def ? `✨ ${escapeHtml(def.name)} <span class="muted">· ${def.mpCost} MP</span>` : '<span class="muted">empty slot</span>'}</div>
          ${def ? `<div class="loc-sub">${escapeHtml(describeSkill(def))}${def.universalNeutral ? ' · Martial' : ''}</div>` : ''}
        </div>
        ${def ? `<button class="btn btn-sm btn-ghost" data-skill-unequip="${def.id}" type="button">Unequip</button>` : ''}
      </div>`
  }).join('')

  const poolRows = activePool
    .map((s) => {
      const full = equippedIds.length >= MAX_SKILL_SLOTS
      return `
        <div class="loc" style="cursor:default">
          <div>
            <div class="loc-name">✨ ${escapeHtml(s.name)} <span class="muted">· ${s.mpCost} MP · Lv${s.unlockLevel}</span></div>
            <div class="loc-sub">${escapeHtml(describeSkill(s))}${s.universalNeutral ? ' · Universal Martial' : ` · ${s.tier}`}</div>
          </div>
          <button class="btn btn-sm ${full ? 'btn-ghost' : 'btn-primary'}" data-skill-equip="${s.id}" ${full ? 'disabled' : ''} type="button">
            Equip
          </button>
        </div>`
    })
    .join('')

  return `
    <div class="panel">
      <div class="row">
        <h3>⚡ Battle Loadout (${equippedIds.length}/${MAX_SKILL_SLOTS})</h3>
        <button class="btn btn-sm btn-ghost" id="skill-autofill" type="button">Auto-Best 4</button>
      </div>
      ${slotRows}
      ${nextUnlock ? `<p class="muted" style="margin-top:6px">Next unlock at Lv ${nextUnlock.unlockLevel}: <b>${escapeHtml(nextUnlock.name)}</b> (${escapeHtml(describeSkill(nextUnlock))})</p>` : ''}
    </div>
    <div class="panel">
      <h3>📘 Unlocked Active Skills (${activePool.length} in reserve)</h3>
      ${poolRows || '<p class="muted">All unlocked active skills are equipped — level up to unlock more!</p>'}
    </div>`
}

function renderForgePanel(
  player: {
    level: number
    inventory: string[]
    wallet: { solars: number; [k: string]: number }
    inDungeon?: boolean
    battleState?: unknown
  },
  category: string,
): string {
  const cats: [string, string][] = [
    ['all', 'All'],
    ['weapon', '⚔️ Weapons'],
    ['armor', '🛡️ Armor'],
    ['potion', '🧪 Potions'],
    ['named', '👑 Boss Gear'],
  ]
  const rows = getCraftBoard(player, category)
  const listHtml = rows
    .map((v) => {
      const matSummary = v.materials
        .map(
          (m) =>
            `<span style="color:${m.met ? 'var(--xp)' : 'var(--ink-dim)'}">${escapeHtml(m.name)} ${m.have}/${m.qty}</span>`,
        )
        .join(' · ')
      const isConsumable = v.output.type === 'consumable'
      return `
        <div class="loc ${v.levelMet ? '' : 'locked'}" style="cursor:default">
          <div class="item-row">
            <span class="item-icon">${gearIconOr(v.output)}</span>
            <div>
              <div class="loc-name">${escapeHtml(v.output.name)}${!v.levelMet ? ` <span class="muted">· 🔒 Lv${v.levelReq}</span>` : ''}</div>
              <div class="loc-sub">${isConsumable ? describeConsumable(v.output) : describeGear(v.output)} · ☀️ ${v.recipe.solarsCost}</div>
              <div class="loc-sub">${matSummary}</div>
            </div>
          </div>
          <button class="btn btn-sm ${v.canCraft ? 'btn-primary' : 'btn-ghost'}"
            data-forge="${v.recipe.id}" ${v.canCraft ? '' : 'disabled'} type="button">
            Forge
          </button>
        </div>`
    })
    .join('')

  return `
    <div class="panel">
      <h3>🔨 Blacksmith Forge · Astral Town</h3>
      <p class="muted">Turn monster drops, quarry ore, and boss trophies into forged equipment.</p>
      <div class="tabs" style="justify-content:flex-start;margin-top:8px">
        ${cats
          .map(
            ([id, label]) =>
              `<button class="tab ${category === id ? 'active' : ''}" data-forge-cat="${id}" type="button">${label}</button>`,
          )
          .join('')}
      </div>
      ${listHtml || '<p class="muted">No recipes in this category.</p>'}
    </div>`
}

function describeGear(item: GearDef): string {
  const b = item.statBonuses ?? {}
  const parts: string[] = []
  if (b.atk) parts.push(`ATK+${b.atk}`)
  if (b.str) parts.push(`STR+${b.str}`)
  if (b.agi) parts.push(`AGI+${b.agi}`)
  if (b.int) parts.push(`INT+${b.int}`)
  if (b.def) parts.push(`DEF+${b.def}`)
  if (b.lck) parts.push(`LCK+${b.lck}`)
  if (b.maxHp) parts.push(`HP+${b.maxHp}`)
  if (b.maxMp) parts.push(`MP+${b.maxMp}`)
  const req = item.levelReq ?? 1
  const gate = req > 1 ? ` · Lv${req}` : ''
  const detail =
    parts.join(' ') ||
    (item.type === 'material' || item.type === 'trophy' ? 'Crafting material' : item.slot || item.type)
  return `${item.rarity} · ${detail}${gate}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
