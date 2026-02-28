// ═══════════════════════════════════════════════════════
//          🐾  YATORPHG — SUMMON SYSTEM  🐾
// ═══════════════════════════════════════════════════════
import { getPlayer, savePlayer } from '../lib/database.js'
import summonsData from '../data/summons.json' assert { type: 'json' }

// ── !summon [name] ────────────────────────────────────
export async function cmdSummon(ctx) {
  const { senderNumber, reply, args } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  if (!args.length) {
    // Show summon menu
    const owned = player.summons || []
    const active = player.activeSummon

    if (!owned.length) {
      return reply(
`🐾 *SUMMONS*
━━━━━━━━━━━━━━━━━━━━━
You have no summons yet!

How to get summons:
🥚 Hatch *eggs* found in dungeons/exploration
🏆 Defeat *world bosses* for rare drops
🛒 Check certain *shops* in high-level regions

Use *!eggs* to see your eggs!`
      )
    }

    let msg = `🐾 *YOUR SUMMONS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`
    for (const summonId of owned) {
      const s = summonsData[summonId]
      if (!s) continue
      const isActive = active === summonId
      msg += `${s.emoji} *${s.name}* [Grade ${s.grade}]${isActive ? ' ← 🟢 ACTIVE' : ''}\n`
      msg += `   ❤️ ${s.hp} HP | ⚔️ ${s.atk} ATK | 🛡️ ${s.def} DEF\n`
      msg += `   ✨ Skill: *${s.skill}*\n`
      msg += `   _${s.desc}_\n\n`
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`
    msg += `*!summon [name]* — Activate a summon\n`
    msg += `*!releasesummon* — Release active summon`
    return reply(msg)
  }

  const search  = args.join(' ').toLowerCase()
  const summonId = Object.keys(summonsData).find(id => {
    const s = summonsData[id]
    return s.name.toLowerCase().includes(search) || id.includes(search.replace(/\s+/g,'_'))
  })

  if (!summonId) {
    return reply(`❌ Summon "*${args.join(' ')}*" not found!\nUse *!summon* to see your summons.`)
  }

  const owned = player.summons || []
  if (!owned.includes(summonId)) {
    return reply(
`❌ You don't own *${summonsData[summonId]?.name}*!

You can get summons by hatching eggs.
Use *!eggs* to check your eggs.`
    )
  }

  const summon = summonsData[summonId]
  player.activeSummon = summonId
  await savePlayer(player)

  await reply(
`🐾 *SUMMON ACTIVATED!*
━━━━━━━━━━━━━━━━━━━━━

${summon.emoji} *${summon.name}* [Grade ${summon.grade}]

_${summon.desc}_

━━━━━━━━━━━━━━━━━━━━━
⚔️ ATK: *${summon.atk}* | 🛡️ DEF: *${summon.def}*
❤️ HP: *${summon.hp}*
✨ Battle Skill: *${summon.skill}*
${summon.special ? `🌟 Special: *${summon.special.replace(/_/g,' ')}*` : ''}

_Your summon will fight alongside you in battle!_
Use *!releasesummon* to dismiss it.`
  )
}

// ── !summons ──────────────────────────────────────────
export async function cmdSummons(ctx) {
  return cmdSummon(ctx)  // same menu
}

// ── !releasesummon ────────────────────────────────────
export async function cmdReleaseSummon(ctx) {
  const { senderNumber, reply } = ctx
  const player = getPlayer(senderNumber)
  if (!player) return reply('❌ Not registered.')

  if (!player.activeSummon) {
    return reply(`⚠️ You don't have an active summon!\nUse *!summon [name]* to activate one.`)
  }

  const summon = summonsData[player.activeSummon]
  player.activeSummon = null
  await savePlayer(player)

  await reply(
`👋 *${summon?.name || 'Your summon'}* has returned to stand-by mode.
_Use *!summon [name]* to call them again anytime._`
  )
}
