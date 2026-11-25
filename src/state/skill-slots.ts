// Skill loadout — port of lib/skill-slots.js (V0 subset).
// V0 drops Elemental Affinity / Bending skills (affinity is a later system);
// the Universal Neutral track and slot auto-fill behave exactly as the bot.

import type { SkillDef } from '../data/types'

export const MAX_SKILL_SLOTS = 4

/** The 10 Universal Neutral Martial Skills (Lv. 1 → Lv. 50) every player gets. */
export const UNIVERSAL_NEUTRAL_UNLOCKS = Object.freeze([
  { id: 'neutral_iron_palm', unlockLevel: 1 },
  { id: 'neutral_second_wind', unlockLevel: 5 },
  { id: 'neutral_crescent_sweep', unlockLevel: 10 },
  { id: 'neutral_brace_stance', unlockLevel: 15 },
  { id: 'neutral_pressure_point', unlockLevel: 20 },
  { id: 'neutral_flurry_rush', unlockLevel: 25 },
  { id: 'neutral_focus_breath', unlockLevel: 30 },
  { id: 'neutral_pommel_concuss', unlockLevel: 38 },
  { id: 'neutral_sundering_fang', unlockLevel: 44 },
  { id: 'neutral_mortal_zenith', unlockLevel: 50 },
])

interface SkillCarrier {
  level: number
  skills: string[]
  equippedSkills: string[]
}

/**
 * Idempotently grant every Universal Neutral skill at or below the player's
 * level. Returns the ids newly added.
 */
export function ensureUniversalNeutralSkills(player: SkillCarrier): string[] {
  if (!player || !Array.isArray(player.skills)) return []
  const lv = Math.max(1, Number(player.level) || 1)
  const owned = new Set(player.skills)
  const added: string[] = []
  for (const u of UNIVERSAL_NEUTRAL_UNLOCKS) {
    if (lv >= u.unlockLevel && !owned.has(u.id)) {
      player.skills.push(u.id)
      owned.add(u.id)
      added.push(u.id)
    }
  }
  return added
}

/** Owned, still-valid equipped skill ids, trimmed to the slot cap. */
export function getEquippedSkills(player: SkillCarrier): string[] {
  ensureUniversalNeutralSkills(player)
  const owned = new Set(player?.skills ?? [])
  return (player?.equippedSkills ?? []).filter((id) => owned.has(id)).slice(0, MAX_SKILL_SLOTS)
}

/**
 * Fill empty slots (up to MAX_SKILL_SLOTS) from owned ACTIVE skills,
 * preserving picks already equipped. Not awakened (V0: always) →
 * Neutral skills first, highest unlockLevel first — so new players
 * immediately have usable battle skills.
 */
export function autoFillSkillSlots(
  player: SkillCarrier,
  allSkills: SkillDef[],
): string[] {
  ensureUniversalNeutralSkills(player)
  const skillById = Object.fromEntries((allSkills ?? []).map((s) => [s.id, s]))

  const activeOwnedDefs = (player.skills ?? [])
    .map((id) => skillById[id])
    .filter((def): def is SkillDef => def?.type === 'active')

  activeOwnedDefs.sort((a, b) => {
    const aNeutral = a.affinity === 'neutral' ? 0 : 1
    const bNeutral = b.affinity === 'neutral' ? 0 : 1
    if (aNeutral !== bNeutral) return aNeutral - bNeutral
    return (b.unlockLevel ?? 1) - (a.unlockLevel ?? 1)
  })

  const current = getEquippedSkills(player)
  const filled = [...current]
  for (const def of activeOwnedDefs) {
    if (filled.length >= MAX_SKILL_SLOTS) break
    if (!filled.includes(def.id)) filled.push(def.id)
  }
  player.equippedSkills = filled.slice(0, MAX_SKILL_SLOTS)
  return player.equippedSkills
}
