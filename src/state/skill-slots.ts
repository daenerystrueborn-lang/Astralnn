// Skill loadout — re-exports pure engine logic from src/engine/skills.ts so
// both state and UI layers share one canonical implementation without engine→state imports.

export {
  MAX_SKILL_SLOTS,
  UNIVERSAL_NEUTRAL_UNLOCKS,
  ensureUniversalNeutralSkills,
  getNewlyUnlockedSkills,
  unlockEligibleSkills,
  getEquippedSkills,
  autoFillSkillSlots,
  equipSkillSlot,
  unequipSkillSlot,
  resetBestSkillSlots,
  describeSkill,
  type SkillCarrier,
  type SkillSlotOutcome,
} from '../engine/skills'
