// Type/element effectiveness — port of lib/skill-element.js (classifier) and
// lib/type-matchup.js (the resolver that actually changes damage).
// NOTE: the bot's 18×18 TYPE_CHART (lib/type-chart.js) belongs to the Pokémon
// side-game and is deliberately NOT ported — RPG combat uses effectiveness.json.

import { effectiveness } from '../data'
import type { SkillDef } from '../data/types'

export const ELEMENTS = [
  'holy', 'shadow', 'fire', 'ice', 'lightning', 'poison',
  'water', 'wind', 'earth', 'severing', 'void', 'time', 'arcane', 'physical',
] as const

export const AFFINITY_SLOTS = ['fire', 'water', 'earth', 'air', 'neutral'] as const

/** Element → the five move categories effectiveness.json's matchup table uses. */
export const ELEMENT_CATEGORY: Record<string, string> = {
  physical: 'physical',
  earth: 'physical',
  severing: 'severing',
  fire: 'fire',
  holy: 'holy',
  arcane: 'magic',
  magic: 'magic',
  ice: 'magic',
  lightning: 'magic',
  water: 'magic',
  wind: 'magic',
  shadow: 'magic',
  poison: 'magic',
  void: 'magic',
  time: 'magic',
}

const CLASS_DEFAULT: Record<string, string> = {
  cleric: 'holy',
  mage: 'arcane',
  rogue: 'severing',
  assassin: 'severing',
  warrior: 'physical',
  berserker: 'physical',
  knight: 'physical',
  samurai: 'physical',
  duelist: 'physical',
}

const KEYWORDS: { element: string; words: string[] }[] = [
  { element: 'holy', words: ['holy', 'sacred', 'blessed', 'blessing', 'radiant', 'divine', 'halo', 'saint', 'purify', 'cleanse', 'grace', 'celestial', 'sanctuary', 'redeem', 'shining', 'light'] },
  { element: 'void', words: ['void', 'oblivion', 'rift', 'null'] },
  { element: 'shadow', words: ['shadow', 'shade', 'shroud', 'umbra', 'night', 'nocturne', 'dark', 'darkness', 'gloom', 'abyss', 'black'] },
  { element: 'time', words: ['time', 'chrono', 'temporal'] },
  { element: 'fire', words: ['ember', 'flame', 'fire', 'blaze', 'burn', 'inferno', 'pyre', 'scorch', 'cinder', 'ignite', 'magma'] },
  { element: 'ice', words: ['frost', 'ice', 'frozen', 'freeze', 'glacial', 'winter', 'snow', 'chill'] },
  { element: 'lightning', words: ['thunder', 'lightning', 'bolt', 'spark', 'storm', 'electric', 'volt'] },
  { element: 'poison', words: ['venom', 'poison', 'toxic', 'plague', 'blight', 'miasma'] },
  { element: 'water', words: ['tide', 'aqueous', 'water', 'aqua', 'flood', 'wave'] },
  { element: 'wind', words: ['wind', 'gale', 'breeze', 'zephyr', 'typhoon', 'hurricane'] },
  { element: 'severing', words: ['cut', 'slash', 'sever', 'cleave', 'rend', 'fang', 'blade', 'edge', 'slice', 'pierce', 'lunge', 'thrust', 'gouge'] },
  { element: 'arcane', words: ['arcane', 'mana', 'mystic', 'ethereal', 'astral'] },
  { element: 'physical', words: ['smash', 'bash', 'strike', 'blow', 'charge', 'roar', 'tackle', 'swing', 'guard', 'bracer', 'crush', 'shatter', 'ram'] },
]

function scanKeywords(haystack: unknown): string | null {
  const text = String(haystack ?? '').toLowerCase()
  if (!text) return null
  for (const { element, words } of KEYWORDS) {
    if (words.some((w) => text.includes(w))) return element
  }
  return null
}

/** Name the element of one skill record — total, never throws. */
export function elementOfSkill(skill?: Partial<SkillDef> | null): string {
  const s = skill ?? {}
  if (s.element && (ELEMENTS as readonly string[]).includes(s.element)) return s.element
  const byName = scanKeywords(s.name)
  if (byName) return byName
  const byDesc = scanKeywords(s.description)
  if (byDesc) return byDesc
  const classDefault = CLASS_DEFAULT[String(s.classId ?? '').toLowerCase()]
  if (classDefault) return classDefault
  return 'arcane'
}

export function categoryOfSkill(skill?: Partial<SkillDef> | null): string {
  return ELEMENT_CATEGORY[elementOfSkill(skill)] ?? 'magic'
}

/** True for skills that deal hit damage (effects[0].type === 'attack'). */
export function skillDealsDamage(skill?: Partial<SkillDef> | null): boolean {
  return skill?.effects?.[0]?.type === 'attack'
}

export const MIN_GRADE = 0.5
export const MAX_GRADE = 2
const WEAK_STEP = 1.34
const RESIST_STEP = 0.67

interface EnemyTypeInfo {
  type: string
  weakTo: string[]
  resistTo: string[]
}

/** Structural enemy shape the resolver reads (works with the battle Enemy). */
interface EnemyTyped {
  id?: unknown
  type?: unknown
  weakTo?: unknown
  resistTo?: unknown
}

/** Enemy typing in one read; null when the enemy carries no type data. */
export function enemyTypeInfo(enemy?: EnemyTyped | null): EnemyTypeInfo | null {
  if (!enemy) return null
  if (enemy.type) {
    return {
      type: String(enemy.type),
      weakTo: (enemy.weakTo as string[]) ?? [],
      resistTo: (enemy.resistTo as string[]) ?? [],
    }
  }
  const fallback = effectiveness.season01Enemies?.[String(enemy.id)]
  return fallback
    ? { ...fallback, weakTo: fallback.weakTo ?? [], resistTo: fallback.resistTo ?? [] }
    : null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function tierFor(grade: number): string {
  if (grade >= 1.75) return 'super-effective'
  if (grade >= 1.15) return 'effective'
  if (grade <= 0.6) return 'weak'
  if (grade < 0.9) return 'resisted'
  return 'neutral'
}

const TIER_TEXT: Record<string, string> = {
  'super-effective': "🌟 It's super effective!",
  effective: '✅ The element bites here.',
  resisted: '🛡️ The foe resists this element.',
  weak: '❌ It is not very effective...',
  neutral: '',
}

export interface MatchupResult {
  mult: number
  element: string
  category: string
  tier: string
  text: string
  info: EnemyTypeInfo | null
}

/**
 * skillMatchup(skill, enemy) — exact port of lib/type-matchup.js:
 *   base grade = matchups[category][enemy.type] ?? 1
 *   weakTo ×1.34 (capped at 2), resistTo ×0.67 (floored at 0.5)
 *   clamp [0.5, 2] after round2
 * Support skills and untyped foes stay neutral at 1.
 */
export function skillMatchup(
  skill: Partial<SkillDef> | null | undefined,
  enemy?: EnemyTyped | null,
): MatchupResult {
  const element = elementOfSkill(skill)
  const category = ELEMENT_CATEGORY[element] ?? categoryOfSkill(skill)
  const neutral: MatchupResult = { mult: 1, element, category, tier: 'neutral', text: '', info: null }

  if (!skillDealsDamage(skill)) return neutral
  const info = enemyTypeInfo(enemy)
  if (!info) return neutral

  let grade = effectiveness.matchups[category]?.[info.type] ?? 1

  const matches = (list: string[]) => list.includes(element) || list.includes(category)
  if (matches(info.weakTo)) grade = Math.min(MAX_GRADE, grade * WEAK_STEP)
  if (matches(info.resistTo)) grade = Math.max(MIN_GRADE, grade * RESIST_STEP)

  grade = Math.max(MIN_GRADE, Math.min(MAX_GRADE, round2(grade)))
  const tier = tierFor(grade)
  return { mult: grade, element, category, tier, text: TIER_TEXT[tier] ?? '', info }
}

/** Convenience for callers that only want the multiplier. */
export function matchupMultiplier(
  skill: Partial<SkillDef> | null | undefined,
  enemy?: EnemyTyped | null,
): number {
  return skillMatchup(skill, enemy).mult
}
