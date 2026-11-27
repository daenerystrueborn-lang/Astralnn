// Blacksmith Forge — pure browser port of plugins/craft.js + data/recipes.json.
//
// Forges weapons, armor, potions, and signature boss-trophy gear in Astral Town
// by consuming required materials/trophies + Solars.

import { gearMap, recipes } from '../data'
import type { GearDef, RecipeDef } from '../data/types'

export interface CraftPlayerSlice {
  level: number
  inventory: string[]
  wallet: { solars: number; [k: string]: number }
  inDungeon?: boolean
  battleState?: unknown
}

export interface CraftMaterialStatus {
  itemId: string
  name: string
  have: number
  qty: number
  met: boolean
}

export interface CraftRecipeView {
  recipe: RecipeDef
  output: GearDef
  levelReq: number
  levelMet: boolean
  solarsMet: boolean
  materials: CraftMaterialStatus[]
  allMaterialsMet: boolean
  canCraft: boolean
}

export interface CraftOutcome {
  ok: boolean
  error?: string
  recipe?: RecipeDef
  item?: GearDef
  solarsSpent?: number
}

const RECIPE_BY_ID: Record<string, RecipeDef> = Object.fromEntries(recipes.map((r) => [r.id, r]))
const RECIPE_BY_OUTPUT: Record<string, RecipeDef> = Object.fromEntries(
  recipes.map((r) => [r.output, r]),
)

function countInventory(inventory: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const id of inventory ?? []) m.set(id, (m.get(id) ?? 0) + 1)
  return m
}

/** Build the live Blacksmith Forge view for all recipes (or one category). */
export function getCraftBoard(
  player: CraftPlayerSlice,
  category?: string | null,
): CraftRecipeView[] {
  const counts = countInventory(player.inventory ?? [])
  const solars = player.wallet?.solars ?? 0
  const wanted = category && category !== 'all' ? category.toLowerCase() : null

  const views: CraftRecipeView[] = []
  for (const recipe of recipes) {
    if (wanted && recipe.category.toLowerCase() !== wanted) continue
    const output = gearMap[recipe.output]
    if (!output) continue

    const levelReq = output.levelReq ?? 1
    const levelMet = (player.level ?? 1) >= levelReq
    const solarsMet = solars >= recipe.solarsCost
    const mats: CraftMaterialStatus[] = recipe.materials.map((m) => {
      const have = counts.get(m.itemId) ?? 0
      return {
        itemId: m.itemId,
        name: gearMap[m.itemId]?.name ?? m.itemId,
        have,
        qty: m.qty,
        met: have >= m.qty,
      }
    })
    const allMaterialsMet = mats.every((m) => m.met)
    const canCraft =
      !player.battleState && !player.inDungeon && levelMet && solarsMet && allMaterialsMet

    views.push({
      recipe,
      output,
      levelReq,
      levelMet,
      solarsMet,
      materials: mats,
      allMaterialsMet,
      canCraft,
    })
  }

  // Sort craftable first, then by required level ascending, then Solar cost.
  views.sort((a, b) => {
    if (a.canCraft !== b.canCraft) return a.canCraft ? -1 : 1
    if (a.levelReq !== b.levelReq) return a.levelReq - b.levelReq
    return a.recipe.solarsCost - b.recipe.solarsCost
  })
  return views
}

/** How many recipes the player currently has materials + Solars + level to forge. */
export function craftableCount(player: CraftPlayerSlice): number {
  return getCraftBoard(player).filter((v) => v.canCraft).length
}

/**
 * Forge an item by recipe id or output item id (exact plugins/craft.js rules):
 *  - Refuses mid-battle or inside a dungeon.
 *  - Checks output item levelReq, required materials, and Solar fee.
 *  - Consumes materials + Solars and adds the forged item to inventory.
 */
export function craftRecipe(player: CraftPlayerSlice, idOrOutput: string): CraftOutcome {
  if (player.battleState) {
    return { ok: false, error: 'Cannot use the Blacksmith Forge during an active battle.' }
  }
  if (player.inDungeon) {
    return { ok: false, error: 'Exit the dungeon back to Astral Town before forging gear.' }
  }

  const key = String(idOrOutput ?? '').trim()
  const recipe = RECIPE_BY_ID[key] ?? RECIPE_BY_OUTPUT[key]
  if (!recipe) {
    return { ok: false, error: `Unknown recipe "${key}".` }
  }
  const output = gearMap[recipe.output]
  if (!output) {
    return { ok: false, error: `Output item "${recipe.output}" is missing.` }
  }

  const reqLv = output.levelReq ?? 1
  if ((player.level ?? 1) < reqLv) {
    return {
      ok: false,
      error: `${output.name} requires Level ${reqLv} to forge (you are Level ${player.level}).`,
    }
  }

  const counts = countInventory(player.inventory ?? [])
  const missing: string[] = []
  for (const m of recipe.materials) {
    const have = counts.get(m.itemId) ?? 0
    if (have < m.qty) {
      const matName = gearMap[m.itemId]?.name ?? m.itemId
      missing.push(`${matName} ×${m.qty - have}`)
    }
  }
  const solars = player.wallet?.solars ?? 0
  if (solars < recipe.solarsCost) {
    missing.push(`☀️ ${recipe.solarsCost - Math.floor(solars)} more Solars`)
  }
  if (missing.length > 0) {
    return { ok: false, error: `Missing materials to forge ${output.name}: ${missing.join(', ')}.` }
  }

  for (const m of recipe.materials) {
    for (let i = 0; i < m.qty; i++) {
      const idx = player.inventory.indexOf(m.itemId)
      if (idx !== -1) player.inventory.splice(idx, 1)
    }
  }
  player.wallet.solars = solars - recipe.solarsCost
  player.inventory.push(output.id)

  return {
    ok: true,
    recipe,
    item: output,
    solarsSpent: recipe.solarsCost,
  }
}
