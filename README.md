# Astral Fantasy

A landscape browser RPG built with TypeScript, Phaser 3, original SVG illustrations, and the reusable Astral Silks UI pack. All assets are local; no paid service, account, backend, or runtime CDN is required.

## Run

Install Node.js 20.19+ or 22.12+, then run `npm install` and `npm run dev`. Open the URL Vite prints. For phones, connect to the same network and open the host computer's LAN address on port 5173. Rotate to landscape.

`npm run build` validates content/assets, type-checks, and builds `dist/`. `npm run preview` serves the production build. `npm test` verifies navigation, progression, purchases, rewards, and saving.

## Play

Wait for the illustrated loading gate, then choose Begin or Continue. Story Mode introduces Lyra and a branching invitation to the Verdant Sanctum. Move with WASD/arrows or tap the ground. Skills use keys 1–8; F is a basic attack, Space is Ultimate, and Auto handles movement and combat.

Defeat three foes to awaken the guardian, restore the shrine, and finish the return conversation. Claim commissions, recruit chosen companions with earned Shards, and equip purchased relics. Six original characters have distinct recruit conditions and party blessings; seven purchasable items include health, mana, attack, and stamina choices.

Progress saves locally in this browser. Stamina regenerates one point per minute, including time away. Sound is optional and synthesized locally. The Settings page includes an illustrated confirmation before resetting progress.

## Pages and artwork

Title, Hub, Party, Recruit, Shop, Season, Missions, Settings, Guide, Story, Cutscene, and Dungeon are separate screen routes. Feature pages have dedicated layouts, filters, and selection; they are not shared feature popups. Hash URLs support direct links and browser history. Opening settings or another feature page during combat pauses the instance; Back resumes it.

`src/ui/kit/materials.ts` generates eight editable SVG silhouettes in pearl, jade, and midnight finishes. Borders, seams, filigree, satin grain, and glossy reflections surround live HTML text. Standalone assets and documentation are in `public/assets/uikit/`.

Original character drawings and real facial-expression variants live in `public/assets/characters/`. They are newly authored vector artwork, not reference cutouts. Artwork provenance and font licenses are in `public/assets/PROVENANCE.md` and `public/assets/ORIGINAL_ART.md`.

Scenes, items, characters, skills, commissions, chapter locations, and asset manifests are defined in `content/`. Missing images have illustrated fallbacks; missing world textures use role-specific terrain/character/prop recipes.

Art sources: `tools/art/build_assets.py` builds environments/icons and invokes `original_characters.py`; the UI pack README explains rebuilding its standalone skins. Visual review files are in `tools/art/` and `test-results/`.
