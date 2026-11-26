// Battle — pure turn-flow session over the combat formulas.
// Ports the V0 core of plugins/attack.js + plugins/defend.js + the
// creditKill/handleVictory/handleDeath settlement rules (see comments for
// every V0 simplification vs the bot).

import {
  calcPlayerDamage,
  applyDefense,
  calcPlayerHitChance,
  calcMonsterHitChance,
  calcMonsterDamage,
  rollDrops,
} from './combat'
import { skillMatchup } from './matchup'
import { applyLevelUps, getRankForLevel, type ProgressPlayer } from './progression'
import { expectedLevelAtFloor, regulateMonsterXp, survivalKillXp } from './xp'
import { recordQuestEvent, type QuestStateShape } from './quests'
import { recordTutorialEvent, type TutorialStateShape } from './tutorial'
import { monsters, locations, skillMap, gearMap } from '../data'
import type { MonsterDef } from '../data/types'
import { defaultRng, type Rng } from './rng'

// ── Enemy / session shapes ─────────────────────────────────────────────────

export interface Enemy {
  id: string
  name: string
  emoji: string
  hp: number
  maxHp: number
  atk: number
  def: number
  tier: 'regular' | 'elite'
  type?: string
  /** monsters.json element — drives the elemental portrait fallback. */
  element?: string
  weakTo?: string[]
  resistTo?: string[]
  isBoss: boolean
  /** From regulateMonsterXp — NOT monsters.json's own rewards (bot rule). */
  xp: number
  solars: number
  drops: { itemId: string; chance: number }[]
  locationId: string
  floor: number
}

export interface BattleSession {
  locationId: string
  floor: number
  turn: number
  enemy: Enemy
  /** Set by Defend; consumed by the incoming enemy strike (double DEF). */
  defending: boolean
  status: 'active' | 'won' | 'lost'
}

export type BattleAction =
  | { kind: 'attack' }
  | { kind: 'skill'; skillId: string }
  | { kind: 'defend' }

export type EventKind =
  | 'info' | 'hit' | 'crit' | 'miss' | 'hurt' | 'matchup'
  | 'reward' | 'levelup' | 'rank' | 'drop' | 'win' | 'lose' | 'error'

export interface BattleEvent {
  kind: EventKind
  text: string
}

export interface KillRewards {
  xp: number
  solars: number
  drops: string[]
  levelMsgs: string[]
  rankChange: { from: string; to: string } | null
}

export interface TurnResult {
  events: BattleEvent[]
  status: BattleSession['status']
  rewards?: KillRewards
}

// ── Spawn ──────────────────────────────────────────────────────────────────

function locationFloors(locationId: string): number {
  return locations.find((l) => l.id === locationId)?.floors ?? 100
}

/** depthRatio — 0 at the first floor, 1 at the last (combat-engine.js). */
export function depthRatio(locationId: string, floor: number): number {
  const total = locationFloors(locationId)
  const raw = total <= 1 ? 1 : (floor - 1) / (total - 1)
  return Math.max(0, Math.min(1, raw))
}

/**
 * Raw floor stats: base + scaling × floor (monsterStatsAtFloor before the
 * expected-player balance pass). V0 SKIPS balanceRegularMonsterStats — the
 * depth rebalancer needs the reference-player gear budget and arrives with
 * V1; authored stats are self-consistent for the early floors V0 ships.
 */
export function statsAtFloor(m: MonsterDef, floor: number): { hp: number; def: number; atk: number } {
  const b = m.baseStats
  const s = m.scaling ?? { hpPerFloor: 0, defPerFloor: 0, atkPerFloor: 0 }
  const hp = Math.round(b.hp + s.hpPerFloor * floor)
  const defVal = Math.round(b.def + s.defPerFloor * floor)
  const atk = Math.round(b.atk + s.atkPerFloor * floor)
  return { hp, def: defVal, atk }
}

/**
 * pickMonsterForFloor — spawn one enemy for a dungeon floor.
 * Elite roll: 24% + 12% × depth (LOCATION_DIFFICULTY overrides are V1).
 */
export function pickMonsterForFloor(
  locationId: string,
  floor: number,
  rng: Rng = defaultRng,
): Enemy | null {
  const pool = monsters.regular.filter(
    (m) => m.locationId === locationId &&
      m.floorRange && floor >= m.floorRange[0] && floor <= m.floorRange[1],
  )
  if (!pool.length) return null

  const regulars = pool.filter((m) => m.tier === 'regular')
  const elites = pool.filter((m) => m.tier === 'elite')
  const eliteChance = 0.24 + depthRatio(locationId, floor) * 0.12

  let chosen: MonsterDef
  let isElite = false
  if (elites.length && rng() < eliteChance) {
    chosen = elites[Math.floor(rng() * elites.length)]!
    isElite = true
  } else {
    chosen = regulars[Math.floor(rng() * regulars.length)] ?? pool[0]!
  }

  const stats = statsAtFloor(chosen, floor)
  const { xp, solars } = regulateMonsterXp(locationId, floor, isElite)

  return {
    id: chosen.id,
    name: chosen.name,
    emoji: chosen.emoji ?? '👾',
    hp: stats.hp,
    maxHp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    tier: isElite ? 'elite' : 'regular',
    type: chosen.type,
    element: chosen.element,
    weakTo: chosen.weakTo,
    resistTo: chosen.resistTo,
    isBoss: false,
    xp,
    solars,
    drops: chosen.drops ?? [],
    locationId,
    floor,
  }
}

/** Start a fight on a floor. Throws when the floor has no monster pool. */
export function startBattle(
  locationId: string,
  floor: number,
  rng: Rng = defaultRng,
): BattleSession {
  const enemy = pickMonsterForFloor(locationId, floor, rng)
  if (!enemy) throw new Error(`No monsters at ${locationId} floor ${floor}`)
  return {
    locationId,
    floor,
    turn: 1,
    enemy,
    defending: false,
    status: 'active',
  }
}

// ── Settlement (creditKill / handleVictory / handleDeath — V0 core) ────────

/**
 * creditKillV0 — what an ordinary dungeon regular/elite kill pays:
 *  - XP: survivalKillXp(player.level, expectedLevelAtFloor) — the path the
 *    bot's creditKill takes for dungeon regulars (speed band is replaced by
 *    the survival override there too; Premium/season/home multipliers are 1
 *    in V0).
 *  - Solars: regulateMonsterXp(...).solars (enemy.solars set at spawn).
 *  - Drops: rollDrops on the monster's table.
 * Then XP lands, wallet fills, applyLevelUps runs (bot order).
 */
export function creditKillV0(
  player: ProgressPlayer & { wallet: Record<string, number>; inventory: string[] },
  enemy: Enemy,
  killTurns: number,
  rng: Rng = defaultRng,
): KillRewards {
  void killTurns // speed band is not the survival path; kept for parity/tests

  const expected = expectedLevelAtFloor(enemy.locationId, enemy.floor)
  const xp = survivalKillXp(player.level, expected, {
    boss: enemy.isBoss,
    elite: enemy.tier === 'elite',
  })
  const solars = enemy.solars

  const drops = rollDrops(enemy.drops, rng)

  player.xp += xp
  player.wallet.solars = (player.wallet.solars ?? 0) + solars
  for (const itemId of drops) player.inventory.push(itemId)

  const rankBefore = getRankForLevel(player.level)
  const { msgs, levelled } = applyLevelUps(player)
  const rankAfter = getRankForLevel(player.level)
  const rankChange =
    levelled && rankAfter.title !== rankBefore.title
      ? { from: rankBefore.title, to: rankAfter.title }
      : null

  return { xp, solars, drops, levelMsgs: msgs, rankChange }
}

/**
 * handleDeathV0 — 50% HP/MP, record the loss, respawn at the hub.
 * V0 simplification: the bot strips ALL inventory + equipped gear and admits
 * you to the hospital with a bill (hospitalAdmit). That system is V1 with the
 * hospital; V0 keeps the half-HP penalty, the loss record and the respawn.
 */
export function handleDeathV0(
  player: ProgressPlayer & {
    stats: { wins?: number; losses?: number }
    location?: string
    inDungeon?: boolean
    battleState?: unknown
  },
): void {
  player.hp = Math.floor(player.maxHp * 0.5)
  player.mp = Math.floor(player.maxMp * 0.5)
  player.stats.losses = (player.stats.losses ?? 0) + 1
  player.location = 'astral_town'
  player.inDungeon = false
  player.battleState = null
}

// ── Turn flow ──────────────────────────────────────────────────────────────

function requireActive(session: BattleSession): boolean {
  return session.status === 'active'
}

/**
 * playerAction — one full round: the player acts, the enemy counters unless
 * it died first, then the turn advances. Mutates player + session; returns
 * the event log (UI renders it, tests assert on it).
 */
export function playerAction(
  player: ProgressPlayer & {
    equippedSkills: string[]
    skills: string[]
    wallet: Record<string, number>
    inventory: string[]
    location?: string
    inDungeon?: boolean
    battleState?: unknown
    dungeonProgress: Record<string, { highestFloor: number }>
    quests: QuestStateShape
    tutorial: TutorialStateShape
  },
  session: BattleSession,
  action: BattleAction,
  rng: Rng = defaultRng,
): TurnResult {
  const events: BattleEvent[] = []
  if (!requireActive(session)) {
    return { events: [{ kind: 'error', text: 'Battle is over.' }], status: session.status }
  }

  // A fresh round starts fresh-footed: the previous defend no longer applies.
  session.defending = false

  // ── Player's move ────────────────────────────────────────────────────────
  if (action.kind === 'defend') {
    const mpRegen = Math.floor(player.maxMp * 0.05)
    player.mp = Math.min(player.maxMp, player.mp + mpRegen)
    session.defending = true
    events.push({ kind: 'info', text: `🛡️ ${player.name} defends! (+${mpRegen} MP)` })
  } else {
    let skill = null as ReturnType<typeof skillLookup> | null
    if (action.kind === 'skill') {
      const owned = player.skills.includes(action.skillId) &&
        player.equippedSkills.includes(action.skillId)
      const def = skillLookup(action.skillId)
      if (!owned || !def || def.type !== 'active') {
        events.push({ kind: 'error', text: 'That skill cannot be used.' })
        return { events, status: session.status }
      }
      if (def.mpCost > player.mp) {
        events.push({ kind: 'error', text: `Not enough MP for ${def.name} (${def.mpCost}).` })
        return { events, status: session.status }
      }
      player.mp -= def.mpCost
      skill = def
      events.push({ kind: 'info', text: `✨ ${player.name} uses ${def.name}!` })
    } else {
      events.push({ kind: 'info', text: `⚔️ ${player.name} attacks!` })
    }

    // Accuracy roll first — a miss spends the action and the enemy still hits.
    const hitChance = calcPlayerHitChance(player, session.enemy)
    if (rng() >= hitChance) {
      events.push({ kind: 'miss', text: `💨 ${player.name}'s strike misses! (${(hitChance * 100).toFixed(1)}%)` })
    } else {
      const { rawDmg, isCrit } = calcPlayerDamage(player, skill, 1, 0, rng)
      let dmg = applyDefense(rawDmg, session.enemy.def)
      const matchup = skillMatchup(skill, session.enemy)
      if (matchup.mult !== 1) {
        dmg = Math.max(1, Math.floor(dmg * matchup.mult))
        if (matchup.text) {
          events.push({ kind: 'matchup', text: `${matchup.text} (${matchup.element}, ×${matchup.mult})` })
        }
      }
      session.enemy.hp = Math.max(0, session.enemy.hp - dmg)
      events.push({
        kind: isCrit ? 'crit' : 'hit',
        text: isCrit
          ? `💥 CRIT! ${dmg} damage to ${session.enemy.name}!`
          : `🎯 ${dmg} damage to ${session.enemy.name}.`,
      })
    }
  }

  // ── Enemy fell? Settle before it can swing back. ─────────────────────────
  if (session.enemy.hp <= 0) {
    const rewards = creditKillV0(player, session.enemy, session.turn, rng)
    player.stats.wins = (player.stats.wins ?? 0) + 1
    session.status = 'won'
    // handleVictory: the fight is over — clear the persisted battle state and
    // record dungeon progress (one-floor-one-win: highestFloor = floor beaten).
    player.battleState = null
    let floorsCleared = false
    if (player.inDungeon) {
      const prog = player.dungeonProgress[session.locationId]
      if (prog && session.floor > prog.highestFloor) {
        prog.highestFloor = session.floor
        floorsCleared = true
      }
    }
    // combat-handlers creditKill hooks: kill always, level per level-up,
    // floor only for dungeon battles.
    recordQuestEvent(player, 'kill', 1)
    if (rewards.levelMsgs.length) recordQuestEvent(player, 'level', rewards.levelMsgs.length)
    if (floorsCleared) recordQuestEvent(player, 'floor', 1)
    recordTutorialEvent(player, 'monster_killed')
    events.push({
      kind: 'win',
      text: `🏆 ${session.enemy.name} is defeated! +${rewards.xp} XP, +${rewards.solars} ☀️`,
    })
    for (const d of rewards.drops) {
      const name = gearMap[d]?.name ?? d
      events.push({ kind: 'drop', text: `🎁 Drop: ${name}` })
    }
    for (const m of rewards.levelMsgs) events.push({ kind: 'levelup', text: m })
    if (rewards.rankChange) {
      events.push({
        kind: 'rank',
        text: `🎖️ Rank up: ${rewards.rankChange.from} → ${rewards.rankChange.to}!`,
      })
    }
    return { events, status: session.status, rewards }
  }

  // ── Enemy's counter ──────────────────────────────────────────────────────
  const enemyHit = calcMonsterHitChance(session.enemy, player)
  if (rng() >= enemyHit) {
    events.push({ kind: 'miss', text: `💨 ${session.enemy.name} misses!` })
  } else {
    // Defending doubles effective DEF for the incoming strike (defend.js).
    const dmg = calcMonsterDamage(session.enemy.atk, player.stats.def, session.defending, rng)
    player.hp = Math.max(0, player.hp - dmg)
    events.push({
      kind: 'hurt',
      text: `${session.enemy.name} hits for ${dmg} damage. ❤️ ${player.hp}/${player.maxHp}`,
    })
  }
  session.defending = false // consumed by this round's counter

  // ── Player fell? ─────────────────────────────────────────────────────────
  if (player.hp <= 0) {
    handleDeathV0(player)
    session.status = 'lost'
    events.push({
      kind: 'lose',
      text: `💀 ${player.name} was slain by ${session.enemy.name}… you wake at Astral Town (HP ${player.hp}/${player.maxHp}).`,
    })
    return { events, status: session.status }
  }

  session.turn += 1
  return { events, status: session.status }
}

function skillLookup(skillId: string) {
  return skillMap[skillId] ?? null
}
