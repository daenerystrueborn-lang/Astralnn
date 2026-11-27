// Typed access to the ported game data (src/data/raw/*.json).
// Every engine reads content through this module — never raw JSON elsewhere.

import type {
  AchievementCatalog,
  BossDef,
  CharacterDef,
  ClassDef,
  CurrencyDef,
  EffectivenessData,
  EnchantmentCatalog,
  GearDef,
  HousingCatalog,
  LevelsData,
  LocationDef,
  MonsterDef,
  QuestCatalog,
  RaceDef,
  RankDef,
  RecipeDef,
  SkillDef,
} from './types'

import classesRaw from './raw/classes.json'
import racesRaw from './raw/races.json'
import levelsRaw from './raw/levels.json'
import ranksRaw from './raw/ranks.json'
import currencyRaw from './raw/currency.json'
import skillsRaw from './raw/skills.json'
import charactersRaw from './raw/characters.json'
import monstersRaw from './raw/monsters.json'
import locationsRaw from './raw/locations.json'
import questsRaw from './raw/quests.json'
import effectivenessRaw from './raw/effectiveness.json'
import weaponsRaw from './raw/weapons.json'
import itemsRaw from './raw/items.json'
import materialsRaw from './raw/materials.json'
import bossTrophiesRaw from './raw/boss-trophies.json'
import namedWeaponsRaw from './raw/named-weapons.json'
import bossGearRaw from './raw/boss-gear.json'
import toolsRaw from './raw/tools.json'
import season1ItemsRaw from './raw/season-01-content.json'
import season1WeaponsRaw from './raw/season-01-weapons.json'
import season2ItemsRaw from './raw/season-02-content.json'
import season2WeaponsRaw from './raw/season-02-weapons.json'
import auctionRaw from './raw/auction.json'
import seasonPackItemsRaw from './raw/season-pack-items.json'
import recipesRaw from './raw/recipes.json'
import achievementsRaw from './raw/achievements.json'
import enchantmentsRaw from './raw/enchantments.json'
import housingRaw from './raw/housing.json'

export const classes = classesRaw as unknown as Record<string, ClassDef>
export const races = racesRaw as unknown as Record<string, RaceDef>
export const levelsData = levelsRaw as unknown as LevelsData
export const ranks = ranksRaw as unknown as RankDef[]
export const currency = currencyRaw as unknown as { currencies: CurrencyDef[] }
export const skills = skillsRaw as unknown as SkillDef[]
export const characters = charactersRaw as unknown as CharacterDef[]
export const locations = locationsRaw as unknown as LocationDef[]
export const quests = questsRaw as unknown as QuestCatalog
export const effectiveness = effectivenessRaw as unknown as EffectivenessData
export const weapons = weaponsRaw as unknown as GearDef[]
export const items = itemsRaw as unknown as GearDef[]
export const materials = materialsRaw as unknown as GearDef[]
export const bossTrophies = bossTrophiesRaw as unknown as GearDef[]
export const namedWeapons = namedWeaponsRaw as unknown as GearDef[]
export const bossGear = bossGearRaw as unknown as GearDef[]
export const tools = toolsRaw as unknown as GearDef[]
export const recipes = recipesRaw as unknown as RecipeDef[]
export const achievementsCatalog = achievementsRaw as unknown as AchievementCatalog
export const enchantmentData = enchantmentsRaw as unknown as EnchantmentCatalog
export const housingData = housingRaw as unknown as HousingCatalog

const season1Items = season1ItemsRaw as unknown as GearDef[]
const season1Weapons = season1WeaponsRaw as unknown as GearDef[]
const season2Items = season2ItemsRaw as unknown as GearDef[]
const season2Weapons = season2WeaponsRaw as unknown as GearDef[]
const auctionItems = auctionRaw as unknown as GearDef[]
const seasonPackItems = seasonPackItemsRaw as unknown as GearDef[]

interface MonsterFile {
  regular: MonsterDef[]
  bosses: BossDef[]
}
export const monsters = monstersRaw as unknown as MonsterFile

export const bossMap: Record<string, BossDef> = Object.fromEntries(
  monsters.bosses.map((b) => [b.id, b]),
)
/** Location → floor → boss definition (exact mirror of lib/game-data.js). */
export const bossByLocFloor: Record<string, Record<number, BossDef>> =
  monsters.bosses.reduce<Record<string, Record<number, BossDef>>>((acc, b) => {
    if (!acc[b.locationId]) acc[b.locationId] = {}
    acc[b.locationId]![b.floor] = b
    return acc
  }, {})

export const skillMap: Record<string, SkillDef> = Object.fromEntries(
  skills.map((s) => [s.id, s]),
)
export const characterMap: Record<string, CharacterDef> = Object.fromEntries(
  characters.map((c) => [c.id, c]),
)
export const locationMap: Record<string, LocationDef> = Object.fromEntries(
  locations.map((l) => [l.id, l]),
)

const ZERO_BONUSES = { str: 0, agi: 0, int: 0, def: 0, lck: 0, maxHp: 0, maxMp: 0 }

function normalizeGearItem(raw: Partial<GearDef> & { id: string; name: string; type: string; rarity: string }): GearDef {
  return {
    ...raw,
    slot: raw.slot ?? null,
    levelReq: raw.levelReq ?? 1,
    sellPrice: raw.sellPrice ?? 0,
    description: raw.description ?? '',
    statBonuses: { ...ZERO_BONUSES, ...(raw.statBonuses ?? {}) },
  }
}

export const allItems: GearDef[] = [
  ...weapons,
  ...items,
  ...season1Weapons,
  ...season1Items,
  ...season2Weapons,
  ...season2Items,
  ...seasonPackItems,
  ...tools,
  ...materials,
  ...auctionItems,
  ...bossTrophies,
  ...namedWeapons,
  ...bossGear,
].map((g) => normalizeGearItem(g))

export const gearMap: Record<string, GearDef> = Object.fromEntries(
  allItems.map((g) => [g.id, g]),
)

/** Starting wallet from data/currency.json (solars: 100, everything else 0). */
export const defaultWallet: Record<string, number> = Object.fromEntries(
  currency.currencies.map((c) => [c.id, c.startingAmount]),
)
