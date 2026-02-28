// ═══════════════════════════════════════════════
//       📜  RPG QUEST SYSTEM — PART 8
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer, addExp } from '../lib/database.js'
import { generateQuestNarrative } from '../lib/gemini.js'
import questsData from '../data/quests.json' assert { type: 'json' }

const MAX_ACTIVE_QUESTS = 5
const ONE_DAY  = 86400000
const ONE_WEEK = 604800000

// ── !questlist ────────────────────────────────────
export async function cmdQuestList(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const now = Date.now()
  const daily  = questsData.daily  || []
  const weekly = questsData.weekly || []
  const story  = questsData.story  || []

  // Filter to level-appropriate quests
  const available = [...daily, ...weekly, ...story].filter(q => {
    if (q.levelReq && player.level < q.levelReq) return false
    if (player.completedQuests?.includes(q.id) && !q.repeatable) return false
    if (player.activeQuests?.find(aq => aq.id === q.id)) return false
    return true
  }).slice(0, 12)

  let msg = `📜 *AVAILABLE QUESTS*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  const grouped = { daily: [], weekly: [], story: [] }
  for (const q of available) grouped[q.type]?.push(q)

  if (grouped.daily.length) {
    msg += `🌅 *DAILY QUESTS* _(resets each day)_\n`
    for (const q of grouped.daily) {
      msg += `  📌 *${q.name}*\n`
      msg += `     └ ${q.desc}\n`
      msg += `     💰 ${q.goldReward}G | ⭐ ${q.expReward} EXP\n\n`
    }
  }

  if (grouped.weekly.length) {
    msg += `📅 *WEEKLY QUESTS*\n`
    for (const q of grouped.weekly) {
      msg += `  📌 *${q.name}*\n`
      msg += `     └ ${q.desc}\n`
      msg += `     💰 ${q.goldReward?.toLocaleString()}G | ⭐ ${q.expReward?.toLocaleString()} EXP\n\n`
    }
  }

  if (grouped.story.length) {
    msg += `📖 *STORY QUESTS*\n`
    for (const q of grouped.story) {
      msg += `  📌 *${q.name}* _(Lv.${q.levelReq}+)_\n`
      msg += `     └ ${q.desc}\n`
      msg += `     💰 ${q.goldReward?.toLocaleString()}G | ⭐ ${q.expReward?.toLocaleString()} EXP\n\n`
    }
  }

  if (!available.length) msg += `_No quests available right now. Check back later!_\n`

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `Active: *${player.activeQuests?.length || 0}/${MAX_ACTIVE_QUESTS}*\n`
  msg += `*!questaccept [name]* to start`

  await ctx.reply(msg)
}

// ── !quest (view active) ──────────────────────────
export async function cmdQuest(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  if (!player.activeQuests?.length) {
    return ctx.reply(
      `📜 *Your Active Quests*\n\n` +
      `_You have no active quests!_\n\n` +
      `Use *!questlist* to see available quests\n` +
      `Use *!questaccept [name]* to accept one`
    )
  }

  let msg = `📜 *ACTIVE QUESTS (${player.activeQuests.length}/${MAX_ACTIVE_QUESTS})*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const aq of player.activeQuests) {
    const qData = findQuestById(aq.id)
    const progress = aq.progress || {}
    msg += `📌 *${aq.name}*\n`

    if (aq.objectives) {
      for (const obj of aq.objectives) {
        const done = progress[obj.key] || 0
        const bar = progressBar(done, obj.amount)
        const check = done >= obj.amount ? '✅' : '🔲'
        msg += `   ${check} ${obj.label}: ${bar} ${done}/${obj.amount}\n`
      }
    }

    msg += `   💰 Reward: ${aq.goldReward?.toLocaleString()}G | ⭐ ${aq.expReward?.toLocaleString()} EXP\n\n`
  }

  msg += `*!questcomplete* to claim finished quests`
  await ctx.reply(msg)
}

function progressBar(current, max) {
  const filled = Math.min(10, Math.round((current / max) * 10))
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

function findQuestById(id) {
  return [...(questsData.daily||[]), ...(questsData.weekly||[]), ...(questsData.story||[])].find(q => q.id === id)
}

// ── !questaccept [name] ───────────────────────────
export async function cmdQuestAccept(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  if ((player.activeQuests?.length || 0) >= MAX_ACTIVE_QUESTS) {
    return ctx.reply(`⚠️ Quest log full! (${MAX_ACTIVE_QUESTS}/${MAX_ACTIVE_QUESTS})\nComplete or abandon a quest first.`)
  }

  const search = ctx.args?.join(' ')?.toLowerCase()
  if (!search) return ctx.reply('❓ Usage: *!questaccept [quest name]*')

  const allQuests = [...(questsData.daily||[]), ...(questsData.weekly||[]), ...(questsData.story||[])]
  const quest = allQuests.find(q => q.name.toLowerCase().includes(search))

  if (!quest) return ctx.reply(`❌ No quest matching "*${search}*".\nUse *!questlist* to see available quests.`)

  if (quest.levelReq && player.level < quest.levelReq) {
    return ctx.reply(`❌ Requires *Level ${quest.levelReq}*! You're Lv.${player.level}.`)
  }

  if (player.completedQuests?.includes(quest.id) && !quest.repeatable) {
    return ctx.reply(`✅ You already completed *${quest.name}*!`)
  }

  if (player.activeQuests?.find(aq => aq.id === quest.id)) {
    return ctx.reply(`⚠️ You already have *${quest.name}* in your quest log!`)
  }

  // Build objective progress tracker
  const activeQuest = {
    id: quest.id,
    name: quest.name,
    type: quest.type,
    goldReward: quest.goldReward,
    expReward: quest.expReward,
    objectives: quest.objectives || [],
    progress: {},
    acceptedAt: Date.now(),
  }

  if (!player.activeQuests) player.activeQuests = []
  player.activeQuests.push(activeQuest)
  await savePlayer(player)

  // Get AI narrative intro
  let narrative = ''
  try {
    narrative = await generateQuestNarrative(player.name, quest.name, quest.desc)
  } catch (e) {
    narrative = `Your journey begins...`
  }

  await ctx.reply(
    `📜 *QUEST ACCEPTED!*\n\n` +
    `📌 *${quest.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${narrative}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 *Objectives:*\n` +
    (quest.objectives || []).map(o => `  🔲 ${o.label}: 0/${o.amount}`).join('\n') +
    `\n\n💰 Reward: *${quest.goldReward?.toLocaleString()}G* + *${quest.expReward?.toLocaleString()} EXP*`
  )
}

// ── !questcomplete ────────────────────────────────
export async function cmdQuestComplete(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  if (!player.activeQuests?.length) return ctx.reply('📜 No active quests. Use *!questlist* to start one!')

  // Find completed quests
  const completed = player.activeQuests.filter(aq => {
    if (!aq.objectives?.length) return true
    return aq.objectives.every(obj => (aq.progress?.[obj.key] || 0) >= obj.amount)
  })

  if (!completed.length) {
    return ctx.reply(
      `📜 *No quests ready to complete yet!*\n\n` +
      `Keep working on your objectives.\n` +
      `Use *!quest* to check your progress.`
    )
  }

  let totalGold = 0
  let totalExp = 0
  let completedNames = []

  for (const aq of completed) {
    totalGold += aq.goldReward || 0
    totalExp += aq.expReward || 0
    completedNames.push(aq.name)

    player.activeQuests = player.activeQuests.filter(q => q.id !== aq.id)
    if (!player.completedQuests) player.completedQuests = []
    if (!player.completedQuests.includes(aq.id)) {
      player.completedQuests.push(aq.id)
    }
  }

  player.gold += totalGold
  const expResult = await addExp(ctx.sender, totalExp)

  let msg = `🎉 *QUEST${completed.length > 1 ? 'S' : ''} COMPLETE!*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const name of completedNames) {
    msg += `✅ *${name}*\n`
  }

  msg += `\n💰 Gold: *+${totalGold.toLocaleString()}G*\n`
  msg += `⭐ EXP: *+${totalExp.toLocaleString()}*\n`
  msg += `💰 New Balance: *${player.gold.toLocaleString()}G*\n`

  if (expResult?.leveledUp) {
    msg += `\n🎊 *LEVEL UP! → Level ${expResult.player.level}!*`
  }

  msg += `\n\nUse *!questlist* to grab more quests!`
  await savePlayer(player)
  await ctx.reply(msg)
}

// Export for use in combat/dungeon (auto-progress quests)
export async function progressQuest(playerId, objectiveKey, amount = 1) {
  const player = getPlayer(playerId)
  if (!player?.activeQuests?.length) return

  let updated = false
  for (const aq of player.activeQuests) {
    const obj = aq.objectives?.find(o => o.key === objectiveKey)
    if (obj) {
      if (!aq.progress) aq.progress = {}
      aq.progress[objectiveKey] = Math.min(obj.amount, (aq.progress[objectiveKey] || 0) + amount)
      updated = true
    }
  }

  if (updated) await savePlayer(player)
}
