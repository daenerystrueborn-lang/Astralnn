// ═══════════════════════════════════════════════════════
//       🎖️  YATORPHG — ACHIEVEMENTS SYSTEM  🎖️
// ═══════════════════════════════════════════════════════
import { getPlayer } from '../lib/database.js'
import titlesData from '../data/titles.json' assert { type: 'json' }

function progressBar(cur, max) {
  const pct = Math.min(1, cur / max)
  const filled = Math.round(pct * 10)
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${cur.toLocaleString()}/${max.toLocaleString()}`
}

// Build achievement progress for a player
function buildAchievements(player) {
  const kc = player.killCounts || {}
  const achievements = []

  // Kill-based
  achievements.push({ name: '🗡️ Goblin Hunter',       req: 'Kill 100 Goblins',       cur: kc.goblin||0,       max: 100,  titleId:'goblin_hunter', done: (kc.goblin||0)>=100 })
  achievements.push({ name: '⚔️ Slayer of Goblins',   req: 'Kill 1000 Goblins',      cur: kc.goblin||0,       max: 1000, titleId:'goblin_slayer', done: (kc.goblin||0)>=1000 })
  achievements.push({ name: '🐉 Dragon Slayer',        req: 'Kill 100 Dragons',       cur: kc.dragon||0,       max: 100,  titleId:'dragon_slayer', done: (kc.dragon||0)>=100 })
  achievements.push({ name: '👑 Dragonlord',           req: 'Kill 1000 Dragons',      cur: kc.dragon||0,       max: 1000, titleId:'dragonlord',    done: (kc.dragon||0)>=1000 })
  achievements.push({ name: '👻 Ghost Reaper',         req: 'Kill 500 Undead',        cur: kc.undead||0,       max: 500,  titleId:'ghost_reaper',  done: (kc.undead||0)>=500 })
  achievements.push({ name: '🏆 Boss Hunter',          req: 'Kill 50 Bosses',         cur: kc.bossKills||0,    max: 50,   titleId:'boss_hunter',   done: (kc.bossKills||0)>=50 })
  achievements.push({ name: '🌟 Legend Breaker',       req: 'Kill 1 Legendary Boss',  cur: Math.min(kc.legendaryBossKills||0,1), max: 1, titleId:'legend_breaker', done: (kc.legendaryBossKills||0)>=1 })
  achievements.push({ name: '👑 Dungeon Sovereign',    req: 'Clear all 100 floors',   cur: kc.fullDungeonClears||0, max: 1, titleId:'dungeon_sovereign', done:(kc.fullDungeonClears||0)>=1 })
  achievements.push({ name: '🪳 Cockroach',            req: 'Die 100 times',          cur: kc.deaths||0,       max: 100,  titleId:'cockroach',     done: (kc.deaths||0)>=100 })
  achievements.push({ name: '🏴 The Bandit',           req: 'Successfully rob 50 players', cur: kc.robSuccesses||0, max: 50, titleId:'bandit', done:(kc.robSuccesses||0)>=50 })
  achievements.push({ name: '⚔️ Arena Champion',      req: 'Win 100 PVP battles',    cur: kc.pvpWins||0,      max: 100,  titleId:'arena_champion',done: (kc.pvpWins||0)>=100 })
  achievements.push({ name: '🥚 Egg Collector',        req: 'Find 10 eggs',           cur: kc.eggsFound||0,    max: 10,   titleId:'egg_collector', done: (kc.eggsFound||0)>=10 })
  achievements.push({ name: '🐲 Dragon Tamer',         req: 'Hatch a Dragon Egg',     cur: Math.min(kc.dragonEggHatched||0,1), max:1, titleId:'dragon_tamer', done:(kc.dragonEggHatched||0)>=1 })
  achievements.push({ name: '💰 The Wealthy',          req: 'Accumulate 100,000G',    cur: kc.goldAccumulated||0, max:100000, titleId:'wealthy', done:(kc.goldAccumulated||0)>=100000 })
  achievements.push({ name: '🔱 The Transcendent One', req: 'Reach Level 100',        cur: player.level||1,    max: 100,  titleId:'transcendent_one', done:(player.level||1)>=100 })

  return achievements
}

// ── !achievements ─────────────────────────────────────
export async function cmdAchievements(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  const achievements = buildAchievements(player)
  const owned = player.titles || []
  const completed = achievements.filter(a => a.done).length
  const total     = achievements.length

  let msg = `🎖️ *ACHIEVEMENTS* (${completed}/${total})\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  // Completed first
  const done   = achievements.filter(a => a.done)
  const inProg = achievements.filter(a => !a.done)

  if (done.length) {
    msg += `✅ *COMPLETED:*\n`
    for (const a of done) {
      msg += `  ✅ ${a.name}\n`
      msg += `     _${a.req}_\n\n`
    }
  }

  if (inProg.length) {
    msg += `📌 *IN PROGRESS:*\n`
    for (const a of inProg) {
      msg += `  📌 ${a.name}\n`
      msg += `     _${a.req}_\n`
      msg += `     ${progressBar(a.cur, a.max)}\n\n`
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `🏅 Titles earned: *${owned.length}/${achievements.length}*\n`
  msg += `_Complete achievements to earn titles!_`

  await reply(msg)
}
