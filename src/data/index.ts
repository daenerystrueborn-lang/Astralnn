// Typed access to the ported bot data (src/data/raw/*.json).
// Every engine reads content through this module — never raw JSON elsewhere.

import type {
  ClassDef,
  RaceDef,
  LevelsData,
  RankDef,
  CurrencyDef,
  SkillDef,
  CharacterDef,
  MonsterDef,
  LocationDef,
  QuestCatalog,
  EffectivenessData,
  GearDef,
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

interface MonsterFile {
  regular: MonsterDef[]
  bosses: MonsterDef[]
}
export const monsters = monstersRaw as unknown as MonsterFile

export const skillMap: Record<string, SkillDef> = Object.fromEntries(
  skills.map((s) => [s.id, s]),
)
export const characterMap: Record<string, CharacterDef> = Object.fromEntries(
  characters.map((c) => [c.id, c]),
)
export const locationMap: Record<string, LocationDef> = Object.fromEntries(
  locations.map((l) => [l.id, l]),
)
export const gearMap: Record<string, GearDef> = Object.fromEntries(
  [...weapons, ...items].map((g) => [g.id, g]),
)

/** Starting wallet from data/currency.json (solars: 100, everything else 0). */
export const defaultWallet: Record<string, number> = Object.fromEntries(
  currency.currencies.map((c) => [c.id, c.startingAmount]),
)
