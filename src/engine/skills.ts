// Skills & Loadout — pure port of lib/skill-slots.js, plugins/skillslot.js,
// and lib/combat-engine.js getNewlyUnlockedSkills().

import type { SkillDef, SkillEffect } from '../data/types'

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

export interface SkillCarrier {
  level: number
  classId?: string
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

/**
 * Exact port of lib/combat-engine.js getNewlyUnlockedSkills(player, allSkills):
 * returns class + Universal Neutral skills at or below player.level not yet in
 * player.skills (excluding gacha-pack / affinity-only skills with `source`).
 */
export function getNewlyUnlockedSkills(
  player: Pick<SkillCarrier, 'level' | 'classId' | 'skills'>,
  allSkills: SkillDef[],
): SkillDef[] {
  if (!player || !Array.isArray(player.skills)) return []
  const owned = new Set(player.skills)
  const lv = Math.max(1, Number(player.level) || 1)
  return (allSkills ?? []).filter(
    (s) =>
      (s.classId === player.classId || s.universalNeutral === true) &&
      !s.source &&
      (s.unlockLevel ?? 1) <= lv &&
      !owned.has(s.id),
  )
}

/**
 * Grant any newly eligible class + Universal Neutral skills for `player.level`
 * and auto-fill open skill slots up to MAX_SKILL_SLOTS.
 */
export function unlockEligibleSkills(player: SkillCarrier, allSkills: SkillDef[]): SkillDef[] {
  if (!player || !Array.isArray(player.skills)) return []
  const newly = getNewlyUnlockedSkills(player, allSkills)
  for (const s of newly) {
    if (!player.skills.includes(s.id)) player.skills.push(s.id)
  }
  ensureUniversalNeutralSkills(player)
  if (!Array.isArray(player.equippedSkills)) player.equippedSkills = []
  if (player.equippedSkills.length < MAX_SKILL_SLOTS) {
    autoFillSkillSlots(player, allSkills)
  }
  return newly
}

/** Owned, still-valid equipped skill ids, trimmed to the slot cap. */
export function getEquippedSkills(player: SkillCarrier): string[] {
  ensureUniversalNeutralSkills(player)
  const owned = new Set(player?.skills ?? [])
  return (player?.equippedSkills ?? []).filter((id) => owned.has(id)).slice(0, MAX_SKILL_SLOTS)
}

/**
 * Fill empty slots (up to MAX_SKILL_SLOTS) from owned ACTIVE skills,
 * preserving picks already equipped.
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

export interface SkillSlotOutcome {
  ok: boolean
  error?: string
  skill?: SkillDef
  equippedSkills?: string[]
}

/** Equip an owned active skill into one of the 4 battle skill slots (plugins/skillslot.js). */
export function equipSkillSlot(
  player: SkillCarrier,
  skillId: string,
  allSkills: SkillDef[],
): SkillSlotOutcome {
  ensureUniversalNeutralSkills(player)
  const def = (allSkills ?? []).find((s) => s.id === skillId)
  if (!def || !(player.skills ?? []).includes(skillId)) {
    return { ok: false, error: 'You have not unlocked that skill yet.' }
  }
  if (def.type !== 'active') {
    return { ok: false, error: `${def.name} is a passive skill — it applies automatically without a slot.` }
  }
  const current = getEquippedSkills(player)
  if (current.includes(skillId)) {
    return { ok: false, error: `${def.name} is already equipped.` }
  }
  if (current.length >= MAX_SKILL_SLOTS) {
    return {
      ok: false,
      error: `All ${MAX_SKILL_SLOTS} skill slots are full — unequip a skill first.`,
    }
  }
  player.equippedSkills = [...current, skillId]
  return { ok: true, skill: def, equippedSkills: player.equippedSkills }
}

/** Unequip a skill from the 4-slot battle loadout. */
export function unequipSkillSlot(player: SkillCarrier, skillId: string): SkillSlotOutcome {
  const current = getEquippedSkills(player)
  if (!current.includes(skillId)) {
    return { ok: false, error: 'That skill is not currently equipped.' }
  }
  player.equippedSkills = current.filter((id) => id !== skillId)
  return { ok: true, equippedSkills: player.equippedSkills }
}

/** Replace the 4-slot loadout with the highest-level unlocked skills. */
export function resetBestSkillSlots(player: SkillCarrier, allSkills: SkillDef[]): string[] {
  ensureUniversalNeutralSkills(player)
  const skillById = Object.fromEntries((allSkills ?? []).map((s) => [s.id, s]))
  const activeOwnedDefs = (player.skills ?? [])
    .map((id) => skillById[id])
    .filter((def): def is SkillDef => def?.type === 'active')
    .sort((a, b) => (b.unlockLevel ?? 1) - (a.unlockLevel ?? 1))
  player.equippedSkills = activeOwnedDefs.slice(0, MAX_SKILL_SLOTS).map((s) => s.id)
  return player.equippedSkills
}

function formatSingleSkillEffect(e: SkillEffect, isPassive: boolean): string {
  switch (e.type) {
    case 'attack':
      return `×${(e.multiplier ?? 1).toFixed(2)} ${(e.stat ?? 'atk').toUpperCase()}`
    case 'heal':
      return `Heal ×${(e.multiplier ?? 1).toFixed(2)}`
    case 'shield':
      return `Shield ${Math.round((e.pct ?? 0.2) * 100)}% HP (${e.turns ?? e.duration ?? 2}t)`
    case 'regen':
      return `Regen ${Math.round((e.pct ?? 0.06) * 100)}% HP/t (${e.turns ?? e.duration ?? 2}t)`
    case 'strengthen':
      return isPassive
        ? `Passive +${Math.round((e.multiplier ?? 0.15) * 100)}% ${(e.stat ?? 'atk').toUpperCase()}`
        : `+${Math.round((e.multiplier ?? 0.15) * 100)}% ${(e.stat ?? 'atk').toUpperCase()}`
    case 'stun':
    case 'freeze':
      return `${e.type[0].toUpperCase()}${e.type.slice(1)} ${e.turns ?? 1}t`
    case 'burn':
    case 'poison':
    case 'bleed':
      return `${e.type[0].toUpperCase()}${e.type.slice(1)} (${e.turns ?? 2}t)`
    case 'blind':
      return `Blind (${e.turns ?? 2}t)`
    case 'weaken':
      return `-${Math.round((e.pct ?? 0.15) * 100)}% ${(e.stat ?? 'def').toUpperCase()} (${e.turns ?? 2}t)`
    case 'slow':
      return `Slow (${e.turns ?? 2}t)`
    default:
      return e.type
  }
}

/** Human-readable summary of a skill's combat effect(s). */
export function describeSkill(skill: SkillDef): string {
  const parts = (skill.effects ?? []).map((e) => formatSingleSkillEffect(e, skill.type === 'passive'))
  const elem = skill.element ? `${skill.element} · ` : ''
  return `${elem}${parts.join(' + ') || skill.type}`
}
