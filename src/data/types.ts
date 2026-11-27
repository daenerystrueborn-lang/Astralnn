// TS types for the ported bot data files (src/data/raw/*.json).
// Shapes mirror northernblader-sys/astralgaming's data/*.json exactly.

export interface ClassDef {
  name: string
  description: string
  primaryStat: 'str' | 'agi' | 'int'
  school: string
  baseStats: StatBlock & { maxHp: number; maxMp: number }
  startingSkills: string[]
  startingItems: string[]
}

export interface RaceDef {
  name: string
  description: string
  statModifiers: StatBlock
  passive: string
  hidden?: boolean
}

export interface StatBlock {
  str: number
  agi: number
  int: number
  def: number
  lck: number
}

export interface TotalStats extends StatBlock {
  maxHp: number
  maxMp: number
}

export interface LevelsData {
  levelCap: number
  rebornLevelCap: number
  statPointsPerLevel: number
  maxStatPoints: number
  rebornMaxStatPoints: number
  statGrowthPerLevel: {
    primaryStat: number
    secondaryStat: number
    maxHp: number
    maxMp: number
  }
  statTraining: {
    baseCostPerPoint: number
    costPerLevel: number
    defaultPoints: number
  }
  /** Direct threshold: you hit level N when xp >= xpTable[N]. Keys are "1".."200". */
  xpTable: Record<string, number>
}

export interface RankDef {
  min: number
  max: number
  title: string
  epithet: string
  emoji: string
}

export interface CurrencyDef {
  id: string
  name: string
  symbol: string
  startingAmount: number
  tradeable: boolean
  description: string
}

export interface SkillEffect {
  type: 'attack' | 'heal' | 'shield' | 'regen' | 'strengthen' | string
  stat?: string
  multiplier?: number
  value?: number
  duration?: number
}

export interface SkillDef {
  id: string
  name: string
  classId: string
  tier: string
  unlockLevel: number
  mpCost: number
  type: 'active' | 'passive'
  element?: string
  affinity?: string
  description?: string
  effects: SkillEffect[]
}

export interface CharacterCombat {
  /** Primary stat the character scales with; special characters carry
   *  non-standard types (e.g. 'crownlight'), so this is a plain string. */
  atkType: string
  atk: number
  def: number
  agi: number
}

export interface CharacterDef {
  id: string
  stars: number
  combat: CharacterCombat
  name: string
  emoji: string
  rarity: string
  tag?: string
  gemPrice?: number
  mondPrice?: number
  seasonId?: string
  characterTier?: string
  abilityTier?: string
  image?: string
  description?: string
  exclusive?: boolean
  ability?: Record<string, unknown>
  statBonuses?: Partial<StatBlock>
}

export interface MonsterRewards {
  xpBase: number
  xpPerFloor: number
  solarsBase: number
  solarsPerFloor: number
}

export interface MonsterDef {
  id: string
  name: string
  emoji?: string
  locationId?: string
  tier: 'regular' | 'elite' | 'boss'
  floorRange?: [number, number]
  baseStats: { hp: number; def: number; atk: number }
  scaling?: { hpPerFloor: number; defPerFloor: number; atkPerFloor: number }
  rewards?: MonsterRewards
  drops?: { itemId: string; chance: number }[]
  sprite?: string
  element?: string
  type?: string
  weakTo?: string[]
  resistTo?: string[]
  isBoss?: boolean
  evasion?: number
  abilities?: string[]
}

export interface BossSignature {
  id: string
  name: string
  element?: string
  multiplier?: number
  cooldown?: number
  telegraphText?: string
  castText?: string
}

export interface BossEnrage {
  threshold?: number
  atkBoost?: number
  shieldPct?: number
  text?: string
}

export interface BossDef {
  id: string
  name: string
  emoji?: string
  locationId: string
  tier: 'boss'
  floor: number
  stats: { hp: number; def: number; atk: number }
  rewards?: { xp: number; solars: number }
  drops?: { itemId: string; chance: number }[]
  conquestTitle?: string
  description?: string
  sprite?: string
  element?: string
  type?: string
  weakTo?: string[]
  resistTo?: string[]
  evasion?: number
  signature?: BossSignature
  enrage?: BossEnrage
}

export interface LocationDef {
  id: string
  name: string
  purpose?: string
  type: string
  safe?: boolean
  floors: number | null
  levelRange: [number, number] | null
  entryLevel: number
  bossFloors: number[]
  checkpointInterval: number | null
  prerequisite?: string | null
  travelCost: number
  services?: string[]
  mapTag?: string
  description?: string
}

export interface QuestReward {
  type: string
  amount: number
}

export interface QuestDef {
  id: string
  metric: string
  goal: number
  name: string
  desc: string
  reward: QuestReward
}

export interface QuestCatalog {
  metrics: string[]
  daily: QuestDef[]
  milestone: QuestDef[]
}

export interface EffectivenessData {
  moveCategories: string[]
  matchups: Record<string, Record<string, number>>
  season01Enemies?: Record<string, { type: string; weakTo?: string[]; resistTo?: string[] }>
}

export interface ItemEffectDef {
  type: string
  stat?: string
  amount?: number | string
  value?: number
  percent?: number
  duration?: number
  hits?: number
  targets?: string[] | string
  target?: string
  slots?: number
  fights?: number
  finalFormThreshold?: number
}

export interface GearDef {
  id: string
  name: string
  type: string
  slot: string | null
  rarity: string
  levelReq: number
  statBonuses: StatBlock & { maxHp: number; maxMp: number }
  sellPrice: number
  buyPrice?: number | null
  gemPrice?: number | null
  seasonId?: string
  guildBound?: boolean
  exclusive?: boolean
  starterPackExclusive?: boolean
  effect?: ItemEffectDef | ItemEffectDef[] | null
  description: string
  maxDurability?: number
  image?: string
}
