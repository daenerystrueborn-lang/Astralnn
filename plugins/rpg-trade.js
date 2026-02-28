// ═══════════════════════════════════════════════
//       🤝  RPG TRADE SYSTEM — PART 7
// ═══════════════════════════════════════════════
import { getPlayer, savePlayer, getDB } from '../lib/database.js'
import items from '../data/items.json' assert { type: 'json' }

// In-memory trade offers (keyed by sender ID)
const pendingTrades = {}

// ── !trade @player [item name] ──────────────────
export async function cmdTrade(ctx) {
  const sender = getPlayer(ctx.sender)
  if (!sender) return ctx.reply('❌ Not registered.')
  if (sender.inDungeon || sender.inBattle) return ctx.reply('⚠️ You can\'t trade right now!')

  const mentionedId = ctx.mentions?.[0]
  if (!mentionedId) return ctx.reply('❓ Usage: *!trade @player [item name]*\nTag the player you want to trade with.')

  if (mentionedId === ctx.sender) return ctx.reply('🤦 You tried to trade with yourself...')

  const target = getPlayer(mentionedId)
  if (!target) return ctx.reply('❌ That player is not registered.')
  if (target.inDungeon || target.inBattle) return ctx.reply(`⚠️ *${target.name}* is busy right now!`)

  const args = ctx.args?.slice(1).join(' ')?.toLowerCase() // skip first arg (mention)
  if (!args) return ctx.reply(`❓ Specify what to offer:\n*!trade @${target.name.toLowerCase()} [item name]*`)

  // Find item in sender's inventory
  const idx = sender.inventory.findIndex(e => {
    const item = items[e.id]
    return item && item.name.toLowerCase().includes(args)
  })
  if (idx === -1) return ctx.reply(`❌ No item matching "*${args}*" in your inventory.`)

  const item = items[sender.inventory[idx].id]
  const eq = sender.equipped
  if (eq.weapon === item.id || eq.armor === item.id || eq.accessory === item.id) {
    return ctx.reply(`⚠️ *${item.name}* is equipped! Unequip it before trading.`)
  }

  // Save pending offer
  pendingTrades[mentionedId] = {
    fromId: ctx.sender,
    fromName: sender.name,
    itemId: item.id,
    itemName: item.name,
    expiresAt: Date.now() + 120000, // 2 min to accept
  }

  await ctx.reply(
    `🤝 *TRADE OFFER SENT!*\n\n` +
    `📦 Offering: *${item.emoji} ${item.name}*\n` +
    `👤 To: *${target.name}*\n\n` +
    `_@${mentionedId.split('@')[0]} — use *!accept* to accept or *!decline* to refuse._\n` +
    `_(Offer expires in 2 minutes)_`
  )
}

// ── !accept ──────────────────────────────────────
export async function cmdAccept(ctx) {
  const receiver = getPlayer(ctx.sender)
  if (!receiver) return ctx.reply('❌ Not registered.')

  const offer = pendingTrades[ctx.sender]
  if (!offer) return ctx.reply('❌ You have no pending trade offers.')
  if (Date.now() > offer.expiresAt) {
    delete pendingTrades[ctx.sender]
    return ctx.reply('⌛ That trade offer has expired.')
  }

  const sender = getPlayer(offer.fromId)
  if (!sender) {
    delete pendingTrades[ctx.sender]
    return ctx.reply('❌ The trader is no longer available.')
  }

  // Verify sender still has the item
  const idx = sender.inventory.findIndex(e => e.id === offer.itemId)
  if (idx === -1) {
    delete pendingTrades[ctx.sender]
    return ctx.reply(`❌ *${sender.name}* no longer has the *${offer.itemName}*. Trade cancelled.`)
  }

  const item = items[offer.itemId]

  // Transfer item
  if (sender.inventory[idx].qty > 1) {
    sender.inventory[idx].qty--
  } else {
    sender.inventory.splice(idx, 1)
  }

  const existing = receiver.inventory.find(e => e.id === offer.itemId)
  if (existing) existing.qty = (existing.qty || 1) + 1
  else receiver.inventory.push({ id: offer.itemId, qty: 1 })

  await savePlayer(sender)
  await savePlayer(receiver)
  delete pendingTrades[ctx.sender]

  await ctx.reply(
    `✅ *TRADE COMPLETE!*\n\n` +
    `${item?.emoji || '📦'} *${offer.itemName}* transferred:\n` +
    `👤 *${sender.name}* → *${receiver.name}*\n\n` +
    `_Fair trade between adventurers!_ 🤝`
  )
}

// ── !decline ─────────────────────────────────────
export async function cmdDecline(ctx) {
  const offer = pendingTrades[ctx.sender]
  if (!offer) return ctx.reply('❌ No pending trade to decline.')

  const fromName = offer.fromName
  delete pendingTrades[ctx.sender]

  await ctx.reply(`❌ Trade from *${fromName}* declined.`)
}

// ── !sendgold @player [amount] ──────────────────
export async function cmdSendGold(ctx) {
  const sender = getPlayer(ctx.sender)
  if (!sender) return ctx.reply('❌ Not registered.')

  const mentionedId = ctx.mentions?.[0]
  if (!mentionedId) return ctx.reply('❓ Usage: *!sendgold @player [amount]*')
  if (mentionedId === ctx.sender) return ctx.reply('🤦 You tried to send gold to yourself.')

  const amount = parseInt(ctx.args?.[ctx.args.length - 1])
  if (!amount || amount < 1) return ctx.reply('❓ Specify a valid amount: *!sendgold @player 500*')

  if (amount > sender.gold) {
    return ctx.reply(`❌ Not enough gold! You have *${sender.gold.toLocaleString()}G* on hand.`)
  }

  const target = getPlayer(mentionedId)
  if (!target) return ctx.reply('❌ That player is not registered.')

  sender.gold -= amount
  target.gold += amount

  await savePlayer(sender)
  await savePlayer(target)

  await ctx.reply(
    `💰 *Gold Sent!*\n\n` +
    `${sender.name} → *${target.name}*\n` +
    `Amount: *${amount.toLocaleString()}G*\n\n` +
    `${sender.name}'s balance: *${sender.gold.toLocaleString()}G*`
  )
}
