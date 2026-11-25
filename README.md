# Astral Fantasy

A landscape browser RPG. This project is being rebuilt as the **game version** of the
Astral WhatsApp bot ([northernblader-sys/astralgaming](https://github.com/northernblader-sys/astralgaming)):
the bot's combat, gacha, characters, progression, and story logic are being ported into
the browser as pure TypeScript engine modules rendered by a thin UI.

## Status

Clean slate. The previous browser combat/game was removed; the engine is being rebuilt
from the bot's logic.

## Planning

- [`BOT_LOGIC_PORT_NOTES.md`](BOT_LOGIC_PORT_NOTES.md) — captured game logic and data shapes to replicate from the bot.

## Run

```bash
pnpm install
pnpm dev
```

`pnpm build` runs the TypeScript type-check and a production build.
