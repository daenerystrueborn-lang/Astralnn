// ═══════════════════════════════════════════════
//       💼  RPG JOBS SYSTEM — PART 8
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer, addExp } from '../lib/database.js'
import { checkCooldown, setCooldown } from '../lib/cooldown.js'
import jobsData from '../data/jobs.json' assert { type: 'json' }

const WORK_COOLDOWN_MS = 7200000 // 2 hours
const JOB_EXP_PER_LEVEL = 100

// ── !jobs ────────────────────────────────────────
export async function cmdJobs(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  let msg = `💼 *AVAILABLE JOBS*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`

  for (const [id, job] of Object.entries(jobsData)) {
    const canApply = player.level >= job.levelReq
    const statusIcon = canApply ? '✅' : `🔒 Lv.${job.levelReq}+`
    const isYours = player.job === id

    msg += `${job.emoji} *${job.name}* ${isYours ? '← *YOUR JOB*' : statusIcon}\n`
    msg += `   💰 ${job.goldPerWork}G/work | +${job.statBonus.toUpperCase()} stat\n`
    msg += `   _${job.desc}_\n\n`
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  if (player.job) {
    const myJob = jobsData[player.job]
    msg += `Your job: *${myJob?.emoji} ${myJob?.name}* (Lv.${player.jobLevel || 1}/10)\n`
  }
  msg += `*!jobapply [job name]* — Apply for a job\n`
  msg += `*!work* — Do your job (2hr cooldown)`

  await ctx.reply(msg)
}

// ── !jobapply [job name] ──────────────────────────
export async function cmdJobApply(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')

  const search = ctx.args?.join(' ')?.toLowerCase()
  if (!search) return ctx.reply('❓ Usage: *!jobapply [job name]*\nExample: *!jobapply blacksmith*')

  const jobEntry = Object.entries(jobsData).find(([id, j]) =>
    j.name.toLowerCase().includes(search) || id.includes(search)
  )
  if (!jobEntry) return ctx.reply(`❌ No job matching "*${search}*".\nUse *!jobs* to see the full list.`)

  const [jobId, job] = jobEntry

  if (player.level < job.levelReq) {
    return ctx.reply(
      `❌ *${job.emoji} ${job.name}* requires *Level ${job.levelReq}*!\n` +
      `You're Level ${player.level}. Keep leveling up!`
    )
  }

  if (player.job === jobId) {
    return ctx.reply(`⚠️ You're already working as a *${job.emoji} ${job.name}*!`)
  }

  const prevJob = player.job ? jobsData[player.job]?.name : null
  player.job = jobId
  player.jobLevel = 1
  player.jobExp = 0
  await savePlayer(player)

  let msg = `${job.emoji} *Job Accepted: ${job.name}!*\n\n`
  if (prevJob) msg += `_(Resigned from ${prevJob})_\n\n`
  msg += `📋 *${job.desc}*\n\n`
  msg += `💰 Pay: *${job.goldPerWork}G* per shift\n`
  msg += `📊 Stat Bonus: *+${job.statBonus.toUpperCase()}* per level\n`
  msg += `⏱️ Cooldown: *2 hours between shifts*\n\n`
  msg += `Use *!work* to start your first shift!`

  await ctx.reply(msg)
}

// ── !work ─────────────────────────────────────────
export async function cmdWork(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (player.inDungeon) return ctx.reply('⚠️ Can\'t work while in a dungeon!')
  if (player.inBattle) return ctx.reply('⚠️ Can\'t work during a battle!')

  if (!player.job) {
    return ctx.reply(
      `💼 *You don't have a job!*\n\n` +
      `Use *!jobs* to see available jobs\n` +
      `Use *!jobapply [job name]* to get hired!`
    )
  }

  // Cooldown check
  const cd = checkCooldown(ctx.sender, 'work', WORK_COOLDOWN_MS)
  if (cd.onCooldown) {
    return ctx.reply(
      `⏳ *You're tired from your last shift!*\n\n` +
      `Next shift available in: *${cd.remaining}*\n\n` +
      `_Rest up, then get back to work!_ 💤`
    )
  }

  const job = jobsData[player.job]
  if (!job) {
    player.job = null; await savePlayer(player)
    return ctx.reply('❌ Job data missing. Please re-apply with *!jobapply*.')
  }

  setCooldown(ctx.sender, 'work')

  // Calculate earnings (scales with job level)
  const jobLevel = player.jobLevel || 1
  const levelBonus = 1 + ((jobLevel - 1) * 0.15) // +15% per level
  const baseGold = job.goldPerWork
  const goldEarned = Math.floor(baseGold * levelBonus)
  const expEarned = job.expPerWork || 30

  // Random narrative
  const narratives = job.workNarrative || ['You work hard and earn your pay.']
  const narrative = narratives[Math.floor(Math.random() * narratives.length)]

  // Stat bonus (every 3 levels)
  let statBonus = ''
  if (jobLevel % 3 === 0 && job.statBonus !== 'all') {
    const stat = job.statBonus
    if (player[stat] !== undefined && player[stat] < 100) {
      player[stat] = Math.min(100, player[stat] + job.bonusAmt)
      statBonus = `\n📊 *${stat.toUpperCase()} +${job.bonusAmt}* (job perk!)`
    }
  } else if (job.statBonus === 'all' && jobLevel % 3 === 0) {
    for (const s of ['str','agi','int','def','lck']) {
      if (player[s] < 100) player[s] = Math.min(100, player[s] + 1)
    }
    statBonus = `\n📊 *ALL STATS +1* (Dragon Tamer perk!)`
  }

  // Job level up
  player.jobExp = (player.jobExp || 0) + 1
  let jobLevelUp = ''
  if (player.jobExp >= JOB_EXP_PER_LEVEL && player.jobLevel < job.maxLevel) {
    player.jobLevel = Math.min(job.maxLevel, (player.jobLevel || 1) + 1)
    player.jobExp = 0
    jobLevelUp = `\n\n🎊 *${job.name} Level Up! → Lv.${player.jobLevel}*\n💰 Pay increased to *${Math.floor(baseGold * (1 + ((player.jobLevel - 1) * 0.15)))}G* per shift!`
  }

  player.gold += goldEarned
  const expResult = await addExp(ctx.sender, expEarned)
  await savePlayer(player)

  let msg = `${job.emoji} *${job.name.toUpperCase()} — SHIFT COMPLETE*\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`
  msg += `_${narrative}_\n\n`
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`
  msg += `💰 Earned: *+${goldEarned.toLocaleString()}G*\n`
  msg += `⭐ EXP: *+${expEarned}*\n`
  msg += `💰 Balance: *${player.gold.toLocaleString()}G*\n`
  msg += `🔨 Job Lv: *${player.jobLevel || 1}/${job.maxLevel}*`
  msg += statBonus
  msg += jobLevelUp

  if (expResult?.leveledUp) {
    msg += `\n\n🌟 *CHARACTER LEVEL UP! → Level ${expResult.player.level}!*`
  }

  msg += `\n\n⏳ _Next shift available in 2 hours_`
  await ctx.reply(msg)
}

// ── !jobresign ────────────────────────────────────
export async function cmdJobResign(ctx) {
  const player = getPlayer(ctx.sender)
  if (!player) return ctx.reply('❌ Not registered.')
  if (!player.job) return ctx.reply('❌ You don\'t have a job to resign from!')

  const job = jobsData[player.job]
  const jobName = job?.name || player.job
  player.job = null
  player.jobLevel = 0
  player.jobExp = 0
  await savePlayer(player)

  await ctx.reply(
    `📤 *Resigned from ${jobName}.*\n\n` +
    `_You handed in your resignation letter.\n` +
    `Job level progress has been reset._\n\n` +
    `Use *!jobapply* to get a new job anytime!`
  )
}
