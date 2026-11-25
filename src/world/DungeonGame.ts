import Phaser from 'phaser';
import skillContent from '../../content/skills/skills.json';
import dungeonContent from '../../content/dungeons/verdant-sanctum.json';
import type { CombatResult, DungeonAPI, DungeonOptions, DungeonStats, Skill } from '../types';
import { findRoute } from '../dungeon/navigation';

const WORLD = { width: dungeonContent.width, height: dungeonContent.height };
const SKILLS = skillContent as Skill[];
const EXTERNAL_ART = [
  ['ground', 1024, 1024], ['tree', 320, 420], ['ruin', 320, 290],
  ['crystal', 180, 210], ['hero', 256, 256], ['wisp', 192, 180],
  ['sentinel', 256, 256], ['boss', 384, 368],
] as const;

type EnemyKind = 'wisp' | 'sentinel' | 'boss';
type Point = { x: number; y: number };
type Blocker = { x: number; y: number; width: number; height: number };
interface Enemy {
  kind: EnemyKind;
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Image;
  meter: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  speed: number;
  attackAt: number;
  stunnedUntil: number;
  seed: number;
  dead: boolean;
  casting: boolean;
  phase: number;
  slowedUntil: number;
}
interface Hazard { x: number; y: number; radius: number; expires: number; damage: number; ring: Phaser.GameObjects.Image; bloom: Phaser.GameObjects.Image; owner: Enemy; }
interface Projectile { sprite: Phaser.GameObjects.Image; vx: number; vy: number; damage: number; expires: number; }

const svg = (width: number, height: number, body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const uri = (source: string) => `data:image/svg+xml;base64,${btoa(Array.from(new TextEncoder().encode(source), byte => String.fromCharCode(byte)).join(''))}`;
const loaderURL = (url: string) => url.startsWith('data:') && !url.slice(0, url.indexOf(',')).includes(';base64') ? uri(decodeURIComponent(url.slice(url.indexOf(',') + 1))) : url;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Detailed, deterministic illustration recipes keep missing downloads visually usable. */
function fallbackArt(key: string, width: number, height: number): string {
  const defs = `<defs><linearGradient id="gold" x2=".8" y2="1"><stop stop-color="#fff0b5"/><stop offset=".45" stop-color="#c6a36b"/><stop offset="1" stop-color="#584a36"/></linearGradient><linearGradient id="stone" x2=".6" y2="1"><stop stop-color="#8a9989"/><stop offset=".5" stop-color="#4e635c"/><stop offset="1" stop-color="#263d3e"/></linearGradient><radialGradient id="glow"><stop stop-color="#edfff8"/><stop offset=".25" stop-color="#84e6e1"/><stop offset="1" stop-color="#478cba" stop-opacity="0"/></radialGradient><filter id="grain"><feTurbulence baseFrequency=".14" numOctaves="3" seed="12"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".17"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>`;
  let body = '';
  if (key === 'ground') {
    const growth = Array.from({ length: 180 }, (_, i) => {
      const x = (i * 137 + 31) % width, y = (i * 193 + 67) % height;
      return `<path d="M${x} ${y}q-9-20-18-18m18 18q7-28 18-25m-18 25q-2-33 3-38" stroke="${['#566449', '#8b9460', '#2e5349', '#a8aa77'][i % 4]}" stroke-width="${2 + i % 3}" opacity=".42"/><ellipse cx="${x + 9}" cy="${y + 14}" rx="${6 + i % 9}" ry="${3 + i % 5}" fill="#b4a583" opacity=".14"/>`;
    }).join('');
    body = `<path d="M0 0H${width}V${height}H0Z" fill="#455944" filter="url(#grain)"/>${growth}`;
  } else if (key === 'tree') {
    const leaves = Array.from({ length: 39 }, (_, i) => {
      const x = 72 + (i * 61) % 236, y = 57 + (i * 47) % 235;
      return `<ellipse cx="${x}" cy="${y}" rx="${34 + i % 20}" ry="${25 + i % 14}" fill="${['#354f45', '#4f6d4c', '#6f8651', '#839363', '#a3ac79'][i % 5]}" opacity=".94"/><path d="M${x - 16} ${y - 9}q18-14 37 2" stroke="#bcc299" stroke-width="2" opacity=".19"/>`;
    }).join('');
    body = `<ellipse cx="190" cy="457" rx="103" ry="27" fill="#122d2d" opacity=".28"/><path d="M143 458q40-95 20-240l36-82 22 11-19 170q12 75 50 141l-47-13-29 24-14-17z" fill="#685c4a" stroke="#333f39" stroke-width="4"/><path d="M185 424q4-144-17-176m28 109 38-89m-51 61-45-59" stroke="#b4a17a" stroke-width="7" opacity=".35"/>${leaves}<path d="M164 453q-30 6-46 28m67-28q2 17 22 28" stroke="#788369" stroke-width="8" stroke-linecap="round"/>`;
  } else if (key === 'ruin') {
    body = `<ellipse cx="174" cy="258" rx="136" ry="26" fill="#183638" opacity=".35"/><path d="M43 244V95l36-27 39 8v168M231 244V76l40-8 37 27v149" fill="url(#stone)" stroke="#314741" stroke-width="4"/><path d="M75 90q92-126 195 0l-22 30q-75-82-151 0Z" fill="url(#stone)" stroke="#b1b89a" stroke-width="3"/><path d="M58 99h46m143 0h46M66 117v105m196-108v111" stroke="#bbc1a1" stroke-width="3" opacity=".45"/><path d="M129 55l-13 20 27 12m-31 108-22 15 9 18m-28-88 13 14-9 20" fill="none" stroke="#293f3b" stroke-width="3"/><path d="M28 245l83-12 20 25-47 21-61-14m208-16 81-14 11 39-77 9" fill="url(#stone)"/><path d="M81 107q-24 13-23 53m183-59q24 14 23 38m-193 99q24-25 46-11" stroke="#88a069" stroke-width="7" fill="none"/><path d="m171 49 9-13 9 13-9 14Z" fill="url(#gold)"/>`;
  } else if (key === 'crystal') {
    body = `<ellipse cx="90" cy="196" rx="83" ry="59" fill="url(#glow)"/><path d="m90 33 39 52-13 103-32 21-22-76Z" fill="#80d7d4" stroke="#c8fff0" stroke-width="3"/><path d="m90 33-6 176-22-76Zm0 0 39 52-40 28Z" fill="#e2fff0" opacity=".65"/><path d="m51 114 23 36-11 57-23-18Zm79-4 16 26-6 63-25-12Z" fill="#72bdbc" stroke="#baf5e5" stroke-width="2"/><path d="m26 207 52-13 45 2 36 23-53 18-65-6Z" fill="url(#stone)"/><path d="M60 223q30-18 66 0" fill="none" stroke="#b9cdb0" stroke-width="2"/>`;
  } else if (key === 'wisp') {
    body = `<circle cx="96" cy="100" r="86" fill="url(#glow)"/><path d="M65 118Q43 59 96 39q46 2 31 58 38-14 28 22-27 10-30 36l-34-14-28 11-11-28Z" fill="#9fe8dd" stroke="#e6fff0" stroke-width="3" opacity=".92"/><path d="M73 116q-12-52 24-63m21 55q-28 5-36 29" stroke="#fffbe0" stroke-width="4" fill="none"/><path d="m76 92 10-5m20-1 10 5" stroke="#294f64" stroke-width="5" stroke-linecap="round"/><path d="M40 48q-25 25-12 46m130 19q26-20 16-41" stroke="#a8f5ef" stroke-width="3" fill="none" opacity=".6"/>`;
  } else if (key === 'sentinel' || key === 'boss') {
    body = `<g transform="scale(${width / 256} ${height / 320})"><ellipse cx="128" cy="281" rx="84" ry="25" fill="#203238" opacity=".3"/><path d="m91 205-13 72 33 9 17-64 22 61 38-8-24-75Z" fill="url(#stone)" stroke="#293d3c" stroke-width="5"/><path d="m83 101-33 40 8 84 28 7 23-68 27 7 22 70 34-14-6-80-31-44Z" fill="url(#stone)" stroke="#293d3c" stroke-width="5"/><path d="m90 54 40-19 33 27-9 48-57-3Z" fill="url(#stone)" stroke="#b8bca1" stroke-width="3"/><path d="M109 73h32m-38 64 21 35 23-34M74 148l12 26m74-31 15 24" stroke="#a9efe2" stroke-width="5"/><path d="m122 121 19 19-18 34-18-31Z" fill="url(#glow)"/><path d="m91 36 10-23 24 14 28-20 17 39-43-9Z" fill="url(#gold)"/><path d="M86 197q42 23 78-3m-54 46 1 29m39-31 9 26" stroke="#96a591" stroke-width="4"/><path d="M61 176q-19 28-18 60m134-35q20 30 22 43" stroke="#89975a" stroke-width="7" fill="none"/></g>`;
  } else {
    body = `<ellipse cx="128" cy="291" rx="70" ry="16" fill="#203338" opacity=".3"/><path d="m101 225-8 63 22 8 17-59 12 57 23-5-13-65Z" fill="#45436b" stroke="#d3c9a8" stroke-width="3"/><path d="M91 109q-39 29-31 76l24 8 25-44 40 1 31 48 18-17q-6-42-43-74Z" fill="#eee1c3" stroke="#706684" stroke-width="3"/><path d="m97 130-22 105 49 18 57-14-31-113Z" fill="#5d5b8a" stroke="#d0b583" stroke-width="4"/><path d="m110 140 19 67 23-66m-57 77q39-11 71 0" stroke="#d8c29b" stroke-width="5" fill="none"/><path d="M89 74q-6-54 47-45 45 5 30 69l-20 8-38-7Z" fill="#b9b3d6" stroke="#746c93" stroke-width="3"/><path d="M106 57q22-11 41 6l9 24-10 23-27-2-19-22Z" fill="#f5d8c6"/><path d="M93 50q26-25 57-5l-27 17-30 26-12 90 23-20 6-84m43-23q17 48 13 111l26 15-23-101Z" fill="#c2bcdc" stroke="#847d9e" stroke-width="3"/><path d="m116 81 7-2m15 0 7 2" stroke="#4b586f" stroke-width="3"/><path d="m181 121 22-7 6 104-15 23Z" fill="url(#gold)"/><path d="M180 147h40m-22-31 1-17" stroke="#d2f4ec" stroke-width="4"/><path d="m123 30 6-15 8 16" fill="url(#gold)"/>`;
  }
  const recipeSize: Record<string, [number, number]> = { tree: [380, 500], ruin: [340, 300], crystal: [180, 260], wisp: [192, 192], hero: [256, 320] };
  const original = recipeSize[key];
  return svg(width, height, defs + (original ? `<g transform="scale(${width / original[0]} ${height / original[1]})">${body}</g>` : body));
}

function fxArt(): Record<string, string> {
  const radial = `<defs><radialGradient id="g"><stop stop-color="#eaffed"/><stop offset=".22" stop-color="#a2e5d7" stop-opacity=".65"/><stop offset="1" stop-color="#77b9c4" stop-opacity="0"/></radialGradient><linearGradient id="b" x2="0" y2="1"><stop stop-color="#fff5cd" stop-opacity=".4"/><stop offset="1" stop-color="#fef7d4" stop-opacity="0"/></linearGradient></defs>`;
  const runeTicks = Array.from({ length: 16 }, (_, i) => `<path d="M128 15v${i % 2 ? 7 : 13}" transform="rotate(${i * 22.5} 128 128)" stroke="#e2c78f" stroke-width="2"/>`).join('');
  return {
    shadow: svg(256, 96, `<defs><radialGradient id="s"><stop stop-color="#102e32" stop-opacity=".55"/><stop offset="1" stop-color="#102e32" stop-opacity="0"/></radialGradient></defs><ellipse cx="128" cy="48" rx="125" ry="44" fill="url(#s)"/>`),
    aura: svg(256, 256, radial + `<circle cx="128" cy="128" r="123" fill="url(#g)"/>`),
    rune: svg(256, 256, `<circle cx="128" cy="128" r="103" fill="none" stroke="#a7ebdf" stroke-width="2"/><circle cx="128" cy="128" r="92" fill="none" stroke="#c9ad77" stroke-width="1"/><circle cx="128" cy="128" r="119" fill="none" stroke="#c9ad77" stroke-width="2" stroke-dasharray="4 15"/>${runeTicks}<path d="m128 28 86 150H42Zm0 200L42 78h172Z" fill="none" stroke="#bbe9d8" stroke-width="1" opacity=".65"/><path d="m128 79 19 38 41 11-41 11-19 38-19-38-41-11 41-11Z" fill="#b1e7dc" opacity=".25"/>`),
    warning: svg(256, 256, `<defs><radialGradient id="r"><stop stop-color="#e38476" stop-opacity=".02"/><stop offset=".8" stop-color="#e6a17e" stop-opacity=".22"/><stop offset="1" stop-color="#fbd4ac" stop-opacity=".65"/></radialGradient></defs><circle cx="128" cy="128" r="117" fill="url(#r)" stroke="#ffcc9c" stroke-width="3"/><circle cx="128" cy="128" r="104" fill="none" stroke="#e7ad83" stroke-width="2" stroke-dasharray="12 10"/><path d="m128 47 70 121H58Z" fill="none" stroke="#eacdb1" stroke-width="2" opacity=".6"/>`),
    spark: svg(96, 96, radial + `<circle cx="48" cy="48" r="44" fill="url(#g)"/><path d="m48 5 6 36 37 7-37 7-6 36-7-36-36-7 36-7Z" fill="#fff2c0"/><path d="m23 23 25 20 25-20-20 25 20 25-25-20-25 20 20-25Z" fill="#e1fff4" opacity=".7"/>`),
    bolt: svg(160, 80, radial + `<ellipse cx="91" cy="40" rx="65" ry="35" fill="url(#g)"/><path d="M8 41q57-33 143-3Q80 41 8 41Z" fill="#d9fff4"/><path d="M27 54q55-17 113-12M34 26q44 19 105 13" fill="none" stroke="#8bdbd8" stroke-width="3"/>`),
    slash: svg(256, 256, `<path d="M26 221Q-5 18 230 29 68 62 26 221Z" fill="#f8eac2" opacity=".9"/><path d="M31 199Q31 37 207 35" stroke="#c4ffff" stroke-width="5" fill="none"/><path d="M39 228Q32 95 179 44" stroke="#82cbd1" stroke-width="3" fill="none" opacity=".6"/>`),
    ray: svg(256, 1024, radial + `<path d="M110 0h35l111 1024H0Z" fill="url(#b)"/><path d="M123 0h9l63 1024H71Z" fill="url(#b)" opacity=".5"/>`),
    healthFrame: svg(256, 42, `<defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#1f353d"/><stop offset="1" stop-color="#122733"/></linearGradient></defs><path d="m3 21 16-17h218l16 17-16 17H19Z" fill="url(#s)" stroke="#beaa78" stroke-width="3"/><path d="M23 10h210m-210 23h210" stroke="#e4d2a0" stroke-width="1" opacity=".5"/><path d="m12 21 8-5 8 5-8 5m208-5 8-5 8 5-8 5" fill="#b0d7c6"/>`),
    healthFill: svg(208, 18, `<defs><linearGradient id="h" x2="0" y2="1"><stop stop-color="#e2d599"/><stop offset=".4" stop-color="#b9ab6e"/><stop offset="1" stop-color="#6e8159"/></linearGradient></defs><path d="m0 9 5-8h198l5 8-5 8H5Z" fill="url(#h)"/><path d="M9 4h183" stroke="#f6eec4" opacity=".65"/><path d="m30 3 10 12m33-12 10 12m33-12 10 12m33-12 10 12" stroke="#e1d69c" opacity=".16"/>`),
    path: pathArt(),
  };
}

function pathArt(): string {
  const stones = Array.from({ length: 110 }, (_, i) => {
    const t = i / 109;
    const x = 300 + t * 1120 + Math.sin(t * Math.PI * 3.3) * 95 + ((i * 13) % 65 - 32);
    const y = 940 - t * 820 + Math.cos(t * Math.PI * 2.7) * 75 + ((i * 23) % 73 - 36);
    return `<path d="m${x} ${y} 23-6 19 8-4 16-28 4-13-9Z" fill="${['#8b8c75', '#9d9d83', '#687c6b', '#b0aa8b'][i % 4]}" stroke="#4f665a" stroke-width="2" opacity=".72"/><path d="m${x + 3} ${y + 2} 20-3 10 3" stroke="#c2b89b" stroke-width="1" opacity=".48"/>`;
  }).join('');
  return svg(WORLD.width, WORLD.height, `<defs><filter id="soil"><feTurbulence baseFrequency=".035" numOctaves="3" seed="5"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".15"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><g transform="scale(${WORLD.width / 1600} ${WORLD.height / 1080})"><path d="M255 1000Q570 710 765 770T1170 403Q1430 275 1390 85" stroke="#283f39" stroke-width="173" opacity=".24" fill="none"/><path d="M255 1000Q570 710 765 770T1170 403Q1430 275 1390 85" stroke="#8b8c6c" stroke-width="143" opacity=".65" fill="none" filter="url(#soil)"/><path d="M255 1000Q570 710 765 770T1170 403Q1430 275 1390 85" stroke="#b2a487" stroke-width="98" opacity=".25" fill="none"/>${stones}<ellipse cx="1294" cy="216" rx="182" ry="127" fill="#a5a185" opacity=".26"/><ellipse cx="1294" cy="216" rx="149" ry="105" fill="none" stroke="#9eaa89" stroke-width="8" opacity=".5"/><ellipse cx="1294" cy="216" rx="127" ry="88" fill="none" stroke="#415d53" stroke-width="3"/><path d="M110 375q320 190 610 108" stroke="#657c69" stroke-width="79" fill="none" opacity=".32"/></g>`);
}

export function createDungeon(container: HTMLElement, options: DungeonOptions): DungeonAPI {
  let disposed = false;
  let pendingPause = false;
  let game: Phaser.Game | undefined;
  let scene: WoodlandScene | undefined;

  class WoodlandScene extends Phaser.Scene {
    private hero!: Phaser.Physics.Arcade.Sprite;
    private heroShadow!: Phaser.GameObjects.Image;
    private shieldArt!: Phaser.GameObjects.Image;
    private destinationArt!: Phaser.GameObjects.Image;
    private gateArt!: Phaser.GameObjects.Image;
    private props!: Phaser.Physics.Arcade.StaticGroup;
    private enemies: Enemy[] = [];
    private hazards: Hazard[] = [];
    private projectiles: Projectile[] = [];
    private blockers: Blocker[] = [];
    private keys?: Record<string, Phaser.Input.Keyboard.Key>;
    private cursor?: Phaser.Types.Input.Keyboard.CursorKeys;
    private target: Point | null = null;
    private route: Point[] = [];
    private routeAt = 0;
    private selected: Enemy | null = null;
    private ready = false;
    private elapsed = 0;
    private statsAt = 0;
    private basicAt = 0;
    private hintAt = -100;
    private maxHp = 300 + Math.max(0, (options.playerLevel ?? 1) - 1) * 25 + (options.partyBonuses?.hp ?? (options.companions ?? 0) * 35) + (options.hpBonus ?? 0);
    private maxMp = 160 + (options.partyBonuses?.mp ?? (options.companions ?? 0) * 15) + (options.mpBonus ?? 0);
    private hp = this.maxHp;
    private mp = this.maxMp;
    private shield = 0;
    private shieldUntil = 0;
    private invulnerableUntil = 0;
    private ultimate = 22;
    private kills = 0;
    private auto = false;
    private ended = false;
    private bossUnlocked = false;
    private boss?: Enemy;
    private cooldowns = Array<number>(9).fill(0);
    private fxSources = fxArt();
    private failureReported = false;

    constructor() { super('AstralWoodland'); }

    preload() {
      for (const [key, width, height] of EXTERNAL_ART) {
        if (options.assets?.[key] === '') continue;
        this.load.svg(key, loaderURL(options.assets?.[key] || `/assets/world/${key}.svg`), { width, height });
      }
      for (const [key, source] of Object.entries(this.fxSources)) this.load.svg(key, uri(source));
    }

    create() { void this.initialize().catch(error => this.failInitialization(error)); }

    private failInitialization(error: unknown) {
      if (disposed || this.failureReported) return;
      this.failureReported = true;
      this.ready = false;
      this.ended = true;
      console.error('[Astral woodland] Unable to initialize illustrated world', error);
      const message = 'The shrine could not open. Your stamina has been returned; try again.';
      if (options.onError) options.onError(message);
      else options.onHint(message);
    }

    private async initialize() {
      const missing: Array<[string, string]> = [
        ...EXTERNAL_ART.filter(([key]) => !this.textures.exists(key)).map(([key, width, height]): [string, string] => [key, fallbackArt(key, width, height)]),
        ...Object.entries(this.fxSources).filter(([key]) => !this.textures.exists(key)),
      ];
      await Promise.all(missing.map(([key, source]) => new Promise<void>((resolve, reject) => {
        const illustration = new Image();
        illustration.onload = () => {
          if (!disposed) this.textures.addImage(key, illustration);
          resolve();
        };
        illustration.onerror = () => reject(new Error(`Could not rasterize illustrated fallback: ${key}`));
        illustration.src = uri(source);
      })));
      if (disposed) return;
      this.physics.world.setBounds(60, 65, WORLD.width - 120, WORLD.height - 120);
      this.add.tileSprite(WORLD.width / 2, WORLD.height / 2, WORLD.width, WORLD.height, 'ground').setDepth(-20);
      this.add.image(0, 0, 'path').setOrigin(0).setDepth(-15);
      this.buildEnvironment();
      this.heroShadow = this.add.image(dungeonContent.spawn.x, dungeonContent.spawn.y + 5, 'shadow').setDisplaySize(73, 27).setDepth(dungeonContent.spawn.y - 1);
      this.hero = this.physics.add.sprite(dungeonContent.spawn.x, dungeonContent.spawn.y, 'hero').setOrigin(.5, .88).setDisplaySize(93, 93).setDepth(dungeonContent.spawn.y);
      const body = this.hero.body as Phaser.Physics.Arcade.Body;
      body.setSize(this.hero.width * .32, this.hero.height * .17).setOffset(this.hero.width * .34, this.hero.height * .72);
      this.hero.setCollideWorldBounds(true);
      this.physics.add.collider(this.hero, this.props);
      this.shieldArt = this.add.image(this.hero.x, this.hero.y - 38, 'rune').setDisplaySize(117, 117).setDepth(930).setAlpha(0);
      this.destinationArt = this.add.image(0, 0, 'rune').setDisplaySize(42, 25).setAlpha(0).setDepth(1);
      for (const enemy of dungeonContent.enemies) this.spawnEnemy(enemy.type as EnemyKind, enemy.x, enemy.y, enemy.hp);
      this.gateArt = this.add.image(dungeonContent.boss.x, dungeonContent.boss.y, 'rune').setDisplaySize(250, 175).setAlpha(.75).setDepth(dungeonContent.boss.y + 5);
      this.add.image(dungeonContent.boss.x, dungeonContent.boss.y, 'aura').setDisplaySize(330, 210).setAlpha(.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
      this.bindInput();
      this.game.canvas.tabIndex = 0;
      this.game.canvas.setAttribute('aria-label', 'Verdant Sanctum. Move with WASD or arrow keys; tap to travel. Skills 1 through 8, F basic attack, Space Ultimate.');
      this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
      this.cameras.main.startFollow(this.hero, true, .055, .055, 0, 48);
      this.adjustCamera();
      this.scale.on('resize', this.adjustCamera, this);
      this.ready = true;
      this.publishStats();
      options.onHint('Follow the stone path. Defeat three guardians to break the celestial ward.');
      if (pendingPause) this.scene.pause();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off('resize', this.adjustCamera, this);
        this.ready = false;
        this.hazards = [];
        this.projectiles = [];
      });
    }

    private buildEnvironment() {
      this.props = this.physics.add.staticGroup();
      const trees: Array<[number, number, number]> = [
        [90, 198, 1.2], [247, 223, 1], [462, 188, 1.2], [714, 177, 1.1], [954, 125, 1.3], [1175, 88, 1], [1517, 168, 1.3],
        [82, 443, 1.15], [266, 470, 1.15], [485, 397, 1.3], [748, 405, .95], [997, 309, 1.05], [1496, 471, 1.2],
        [79, 690, 1.3], [337, 681, 1], [523, 627, .9], [1485, 728, 1.3], [1304, 758, 1.12], [1110, 853, 1.05],
        [92, 996, 1.35], [223, 1029, 1], [628, 1017, 1.1], [851, 990, 1.25], [1427, 1028, 1.25], [1540, 953, 1.3],
      ];
      const layoutX = WORLD.width / 1600, layoutY = WORLD.height / 1080;
      for (const [originalX, originalY, originalSize] of trees) {
        const x = originalX * layoutX, y = originalY * layoutY, size = originalSize * Math.min(layoutX, layoutY);
        this.add.image(x + 25, y + 6, 'shadow').setDisplaySize(250 * size, 88 * size).setAlpha(.7).setDepth(y - 3);
        const tree = this.props.create(x, y, 'tree') as Phaser.Physics.Arcade.Sprite;
        tree.setOrigin(.5, .9).setDisplaySize(220 * size, 290 * size).setDepth(y + 10);
        tree.refreshBody();
        const body = tree.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(48 * size, 31 * size).setOffset(tree.displayWidth * .5 - 24 * size, tree.displayHeight * .83);
        this.blockers.push({ x: x - 24 * size, y: y - 20 * size, width: 48 * size, height: 31 * size });
      }
      for (const [originalX, originalY, originalScale] of [[727, 610, .85], [1120, 266, .8], [1445, 304, 1], [400, 848, .42]] as Array<[number, number, number]>) {
        const x = originalX * layoutX, y = originalY * layoutY, scale = originalScale * Math.min(layoutX, layoutY);
        const ruin = this.props.create(x, y, 'ruin') as Phaser.Physics.Arcade.Sprite;
        ruin.setOrigin(.5, .85).setDisplaySize(240 * scale, 212 * scale).setDepth(y);
        ruin.refreshBody();
        const body = ruin.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(138 * scale, 38 * scale).setOffset(ruin.displayWidth / 2 - 69 * scale, ruin.displayHeight * .74);
        this.blockers.push({ x: x - 69 * scale, y: y - 23 * scale, width: 138 * scale, height: 38 * scale });
      }
      for (const [originalX, originalY, originalScale] of [[450, 757, .68], [964, 685, .8], [1247, 293, .74], [1342, 643, .62], [598, 290, .8]] as Array<[number, number, number]>) {
        const x = originalX * layoutX, y = originalY * layoutY, scale = originalScale * Math.min(layoutX, layoutY);
        this.add.image(x, y - 18, 'aura').setDisplaySize(162, 134).setAlpha(.25).setDepth(y - 10).setBlendMode(Phaser.BlendModes.ADD);
        const crystal = this.add.image(x, y, 'crystal').setOrigin(.5, .83).setDisplaySize(76 * scale, 110 * scale).setDepth(y);
        if (!options.reducedMotion) this.tweens.add({ targets: crystal, alpha: { from: .8, to: 1 }, duration: 1600 + x % 500, yoyo: true, repeat: -1 });
      }
      for (const [originalX, originalY] of [[100, 0], [650, -90], [1230, -160]]) {
        const x = originalX * layoutX, y = originalY * layoutY;
        this.add.image(x, y, 'ray').setOrigin(.5, 0).setDisplaySize(330, 1050).setRotation(-.36).setDepth(1600).setAlpha(.25).setBlendMode(Phaser.BlendModes.ADD);
      }
      if (!options.reducedMotion) {
        this.add.particles(0, 0, 'spark', {
          x: { min: 100, max: 1500 }, y: { min: 80, max: 1020 }, lifespan: 5000,
          speedX: { min: -8, max: 6 }, speedY: { min: -14, max: -3 },
          scale: { start: .022, end: .005 }, alpha: { start: .5, end: 0 },
          frequency: 190, quantity: 1, blendMode: Phaser.BlendModes.ADD,
        }).setDepth(1600);
      }
    }

    private bindInput() {
      this.keys = this.input.keyboard?.addKeys('W,A,S,D') as Record<string, Phaser.Input.Keyboard.Key> | undefined;
      this.cursor = this.input.keyboard?.createCursorKeys();
      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
        if (!this.ready || this.ended || pendingPause || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
        if (event.code === 'Space' && active instanceof HTMLElement && active.tagName === 'BUTTON') return;
        if (/^[1-8]$/.test(event.key)) this.cast(Number(event.key) - 1);
        else if (event.code === 'Space') { event.preventDefault(); this.cast(8); }
        else if (event.code === 'KeyF') this.basicAttack(true);
      });
      this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (!this.ready || this.ended || pendingPause || pointer.rightButtonDown()) return;
        this.game.canvas.focus({ preventScroll: true });
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const foe = this.enemies.find((enemy) => !enemy.dead && distance(enemy.sprite, world) < (enemy.kind === 'boss' ? 80 : 50));
        this.selected = foe ?? null;
        this.target = { x: clamp(world.x, 75, WORLD.width - 75), y: clamp(world.y, 80, WORLD.height - 65) };
        this.route = findRoute(this.hero, this.target, this.blockers, WORLD);
        if (this.route.length) this.target = this.route[this.route.length - 1];
        this.routeAt = this.elapsed + .6;
        this.destinationArt.setPosition(this.target.x, this.target.y).setAlpha(.7);
        if (foe && distance(this.hero, foe.sprite) < 285) this.basicAttack(false);
      });
    }

    private adjustCamera() {
      const { width, height } = this.scale.gameSize;
      const zoom = width < 700 ? .78 : clamp(Math.min(width / 1250, height / 780), .7, 1.35);
      this.cameras.main.setZoom(zoom);
    }

    private spawnEnemy(kind: EnemyKind, x: number, y: number, contentHp?: number): Enemy {
      const size = kind === 'boss' ? 150 : kind === 'sentinel' ? 95 : 71;
      const sprite = this.physics.add.sprite(x, y, kind).setOrigin(.5, kind === 'wisp' ? .7 : .88);
      sprite.setDisplaySize(size * sprite.width / sprite.height, size).setDepth(y);
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(sprite.width * .34, sprite.height * .19).setOffset(sprite.width * .33, sprite.height * .69);
      sprite.setCollideWorldBounds(true);
      this.physics.add.collider(sprite, this.props);
      const maxHp = contentHp ?? (kind === 'boss' ? 380 : kind === 'sentinel' ? 100 : 75);
      const shadow = this.add.image(x, y + 6, 'shadow').setDisplaySize(size * .91, size * .31).setDepth(y - 1);
      const frame = this.add.image(x, y - size - 10, 'healthFrame').setDisplaySize(kind === 'boss' ? 142 : 81, kind === 'boss' ? 21 : 13).setDepth(1800);
      const meter = this.add.image(x, y - size - 10, 'healthFill').setDisplaySize(kind === 'boss' ? 116 : 66, kind === 'boss' ? 9 : 6).setDepth(1801);
      const enemy: Enemy = { kind, sprite, shadow, frame, meter, hp: maxHp, maxHp, speed: kind === 'wisp' ? 54 : kind === 'sentinel' ? 39 : 30, attackAt: this.elapsed + 1.8, stunnedUntil: 0, seed: x * .02, dead: false, casting: false, phase: 1, slowedUntil: 0 };
      this.enemies.push(enemy);
      return enemy;
    }

    update(_time: number, rawDelta: number) {
      if (!this.ready || disposed || pendingPause || this.ended) return;
      const dt = Math.min(rawDelta / 1000, .05);
      this.elapsed += dt;
      this.mp = Math.min(this.maxMp, this.mp + dt * (3.8 + (options.partyBonuses?.regen ?? (options.companions ?? 0) * .5)));
      this.cooldowns = this.cooldowns.map((remaining) => Math.max(0, remaining - dt));
      if (this.shieldUntil < this.elapsed) this.shield = 0;
      this.updateMovement();
      this.heroShadow.setPosition(this.hero.x + 2, this.hero.y + 4).setDepth(this.hero.y - 1);
      this.hero.setDepth(this.hero.y + 2);
      this.shieldArt.setPosition(this.hero.x, this.hero.y - 34).setDepth(this.hero.y + 3).setAlpha(this.shield > 0 ? .6 : 0);
      if (!options.reducedMotion) {
        this.shieldArt.rotation += dt * .3;
        this.destinationArt.rotation += dt * .5;
        if (!this.bossUnlocked) this.gateArt.rotation += dt * .12;
      }
      for (const enemy of this.enemies) this.updateEnemy(enemy, dt);
      this.updateHazards(dt);
      if (this.auto && this.elapsed >= this.basicAt) {
        this.basicAttack(false);
        const enemy = this.findTarget(400);
        if (enemy && this.cooldowns[1] <= 0 && this.mp > 35) this.cast(1, true);
        if (this.hp < this.maxHp * .55 && this.cooldowns[3] <= 0) this.cast(3, true);
      }
      if (this.elapsed >= this.statsAt) { this.statsAt = this.elapsed + .1; this.publishStats(); }
    }

    private updateMovement() {
      const dx = Number(Boolean(this.keys?.D.isDown || this.cursor?.right.isDown)) - Number(Boolean(this.keys?.A.isDown || this.cursor?.left.isDown));
      const dy = Number(Boolean(this.keys?.S.isDown || this.cursor?.down.isDown)) - Number(Boolean(this.keys?.W.isDown || this.cursor?.up.isDown));
      if (dx || dy) {
        this.target = null;
        this.route = [];
        this.destinationArt.setAlpha(0);
        const length = Math.hypot(dx, dy);
        this.hero.setVelocity(dx / length * 186, dy / length * 186);
        if (dx) this.hero.setFlipX(dx < 0);
        return;
      }
      if (this.selected && !this.selected.dead && this.target) {
        if (distance(this.hero, this.selected.sprite) < 220) { this.target = null; this.route = []; this.destinationArt.setAlpha(0); }
        else if (this.elapsed > this.routeAt) { this.route = findRoute(this.hero, this.selected.sprite, this.blockers, WORLD); this.routeAt = this.elapsed + .65; }
      }
      if (!this.target && this.auto) {
        const enemy = this.findTarget(1100);
        if (enemy && distance(this.hero, enemy.sprite) > 245) {
          if (this.elapsed > this.routeAt || !this.route.length) { this.route = findRoute(this.hero, enemy.sprite, this.blockers, WORLD); this.routeAt = this.elapsed + .75; }
        } else this.route = [];
      }
      while (this.route.length && distance(this.hero, this.route[0]) < 12) this.route.shift();
      const goal = this.route[0] ?? this.target;
      if (goal && distance(this.hero, goal) > 12) {
        const deltaX = goal.x - this.hero.x, deltaY = goal.y - this.hero.y, length = Math.hypot(deltaX, deltaY);
        this.hero.setVelocity(deltaX / length * 180, deltaY / length * 180);
        if (Math.abs(deltaX) > 3) this.hero.setFlipX(deltaX < 0);
      } else {
        this.hero.setVelocity(0);
        if (this.target) { this.target = null; this.route = []; this.destinationArt.setAlpha(0); }
      }
    }

    private updateEnemy(enemy: Enemy, dt: number) {
      if (enemy.dead) return;
      const { sprite } = enemy;
      const proximity = distance(this.hero, sprite);
      const active = proximity < (enemy.kind === 'boss' ? 600 : 430);
      const stunned = this.elapsed < enemy.stunnedUntil;
      if (!active || stunned || enemy.casting || proximity < (enemy.kind === 'wisp' ? 180 : enemy.kind === 'boss' ? 185 : 70)) sprite.setVelocity(0);
      else {
        const speed = enemy.speed * (enemy.slowedUntil > this.elapsed ? .35 : 1);
        sprite.setVelocity((this.hero.x - sprite.x) / proximity * speed, (this.hero.y - sprite.y) / proximity * speed);
        sprite.setFlipX(this.hero.x < sprite.x);
      }
      sprite.setDepth(sprite.y + 2);
      if (!options.reducedMotion) sprite.setRotation(Math.sin(this.elapsed * 2.2 + enemy.seed) * (enemy.kind === 'wisp' ? .065 : .013));
      enemy.shadow.setPosition(sprite.x + 3, sprite.y + 5).setDepth(sprite.y - 1);
      enemy.frame.setPosition(sprite.x, sprite.y - sprite.displayHeight - 5);
      enemy.meter.setPosition(sprite.x, sprite.y - sprite.displayHeight - 5);
      enemy.meter.setCrop(0, 0, 208 * enemy.hp / enemy.maxHp, 18);
      if (enemy.kind === 'boss' && enemy.hp < enemy.maxHp * .5 && enemy.phase === 1) {
        enemy.phase = 2;
        enemy.speed = 44;
        this.hint('The Guardian awakens! Dodge the falling stars and cast your Ultimate.');
        this.effect('rune', sprite.x, sprite.y - 45, 270, 1100, '#e3c2a4');
      }
      if (active && !stunned && !enemy.casting && this.elapsed >= enemy.attackAt) {
        if (enemy.kind === 'wisp' && proximity < 370) {
          enemy.attackAt = this.elapsed + 2.6;
          this.projectile(enemy.sprite.x, enemy.sprite.y - 27, this.hero.x, this.hero.y - 18, 138, 19);
        } else if (enemy.kind === 'sentinel' && proximity < 113) {
          enemy.attackAt = this.elapsed + 2.5;
          this.telegraph(enemy, sprite.x, sprite.y, 90, .8, 29);
        } else if (enemy.kind === 'boss') {
          enemy.attackAt = this.elapsed + (enemy.phase === 2 ? 2.1 : 3);
          this.telegraph(enemy, this.hero.x, this.hero.y, enemy.phase === 2 ? 125 : 105, 1.15, enemy.phase === 2 ? 48 : 38);
          if (enemy.phase === 2) {
            this.telegraph(enemy, this.hero.x + 145, this.hero.y - 50, 85, 1.4, 30);
            this.telegraph(enemy, this.hero.x - 145, this.hero.y + 50, 85, 1.4, 30);
          }
          this.projectile(sprite.x, sprite.y - 62, this.hero.x, this.hero.y - 20, 124, 24);
        }
      }
      if (stunned && Math.floor(this.elapsed * 4) % 2 === 0) sprite.setTint(0xb5e6e6);
      else sprite.clearTint();
      void dt;
    }

    private telegraph(owner: Enemy, x: number, y: number, radius: number, delay: number, damage: number) {
      owner.casting = true;
      const ring = this.add.image(x, y - 8, 'warning').setDisplaySize(radius * 2, radius * 1.25).setDepth(y - 2).setAlpha(.75);
      const bloom = this.add.image(x, y - 8, 'aura').setDisplaySize(radius * 1.2, radius * .8).setTint(0xffb698).setAlpha(.1).setDepth(y - 3);
      this.hazards.push({ owner, x, y, radius, expires: this.elapsed + delay, damage, ring, bloom });
      if (!options.reducedMotion) this.tweens.add({ targets: ring, alpha: .35, duration: 200, yoyo: true, repeat: Math.ceil(delay * 2) });
    }

    private projectile(x: number, y: number, targetX: number, targetY: number, speed: number, damage: number) {
      const angle = Math.atan2(targetY - y, targetX - x);
      const sprite = this.add.image(x, y, 'bolt').setDisplaySize(54, 27).setRotation(angle).setDepth(y + 20).setTint(0xedd0aa).setBlendMode(Phaser.BlendModes.ADD);
      this.projectiles.push({ sprite, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, expires: this.elapsed + 5 });
    }

    private updateHazards(dt: number) {
      for (let i = this.hazards.length - 1; i >= 0; i--) {
        const hazard = this.hazards[i];
        if (hazard.owner.dead || this.elapsed >= hazard.expires) {
          if (!hazard.owner.dead) {
            this.effect('aura', hazard.x, hazard.y - 12, hazard.radius * 2.4, 420, '#edc7a1');
            this.effect('rune', hazard.x, hazard.y - 12, hazard.radius * 1.8, 500, '#e4b98b');
            if (Math.hypot(this.hero.x - hazard.x, (this.hero.y - hazard.y + 8) * 1.6) < hazard.radius) this.hurt(hazard.damage);
          }
          hazard.owner.casting = false;
          this.tweens.killTweensOf(hazard.ring);
          hazard.ring.destroy(); hazard.bloom.destroy(); this.hazards.splice(i, 1);
        } else hazard.bloom.setAlpha(.15 + .3 * (1 - (hazard.expires - this.elapsed) / 1.4));
      }
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const projectile = this.projectiles[i];
        projectile.sprite.x += projectile.vx * dt;
        projectile.sprite.y += projectile.vy * dt;
        projectile.sprite.setDepth(projectile.sprite.y + 20);
        const hit = distance(projectile.sprite, { x: this.hero.x, y: this.hero.y - 23 }) < 27;
        if (hit || this.elapsed >= projectile.expires) {
          if (hit) this.hurt(projectile.damage);
          projectile.sprite.destroy(); this.projectiles.splice(i, 1);
        }
      }
    }

    private findTarget(range: number): Enemy | undefined {
      if (this.selected && !this.selected.dead && distance(this.hero, this.selected.sprite) <= range) return this.selected;
      return this.enemies.filter((enemy) => !enemy.dead && distance(this.hero, enemy.sprite) <= range).sort((a, b) => distance(this.hero, a.sprite) - distance(this.hero, b.sprite))[0];
    }

    private basicAttack(userTriggered: boolean) {
      if (this.elapsed < this.basicAt || this.ended || pendingPause) return;
      const target = this.findTarget(295);
      if (!target) { if (userTriggered) this.hint('Move closer to a guardian to attack.'); return; }
      this.basicAt = this.elapsed + .65;
      this.hero.setFlipX(target.sprite.x < this.hero.x);
      this.flyBolt(target, this.offense(26));
      this.ultimate = Math.min(100, this.ultimate + 4);
    }

    cast(index: number, quiet = false) {
      if (!this.ready || this.ended || disposed || pendingPause || index < 0 || index > 8) return;
      const skill = SKILLS[index];
      if (!skill) return;
      if (this.cooldowns[index] > 0) { if (!quiet) this.hint(`${skill.name} is still recovering.`); return; }
      if (index === 8 && this.ultimate < 100) { if (!quiet) this.hint('The Ultimate needs 100 celestial charge. Fight to fill the gauge.'); return; }
      if (this.mp < skill.mana) { if (!quiet) this.hint('Not enough mana. Keep moving while your mana regenerates.'); return; }
      const rawKind = skill.kind.toLowerCase();
      const defaultKinds = ['damage', 'damage', 'dash', 'heal', 'shield', 'aoe', 'aoe', 'stun', 'ultimate'];
      const kind = /heal|mend/.test(rawKind) ? 'heal' : /shield|guard|barrier/.test(rawKind) ? 'shield' : /dash|step/.test(rawKind) ? 'dash' : /mana|restore|well/.test(rawKind) ? 'restore' : /stun|bind|freeze/.test(rawKind) ? 'stun' : /aoe|area|nova|burst/.test(rawKind) ? 'aoe' : /damage|bolt|strike|single/.test(rawKind) ? 'damage' : defaultKinds[index];
      const target = this.findTarget(index === 8 ? 650 : index === 0 ? 230 : 465);
      if (!target && ['damage', 'aoe', 'stun', 'ultimate'].includes(kind)) { if (!quiet) this.hint('Choose a guardian in range, or move closer along the path.'); return; }
      this.mp -= skill.mana;
      this.cooldowns[index] = skill.cooldown;
      const power = kind === 'heal' ? Math.round(skill.power * (1 + Math.max(0, (options.playerLevel ?? 1) - 1) * .06)) : this.offense(Math.max(1, skill.power));
      this.ultimate = Math.min(100, this.ultimate + (index === 8 ? 0 : 7));
      if (index === 8) {
        this.ultimate = 0;
        const epicenter = target?.sprite ?? this.hero;
        this.effect('rune', epicenter.x, epicenter.y - 20, 550, 900, '#f7ddb0');
        this.effect('aura', epicenter.x, epicenter.y - 35, 610, 650, '#c4eced');
        for (const foe of this.enemies) if (!foe.dead && distance(foe.sprite, epicenter) < 330) { this.damage(foe, power); foe.stunnedUntil = this.elapsed + 1.7; }
        if (!options.reducedMotion) this.cameras.main.shake(180, .003);
        this.floating(this.hero.x, this.hero.y - 95, 'CELESTIAL ECLIPSE', '#fff0ba', 18);
      } else if (kind === 'heal') {
        this.hp = Math.min(this.maxHp, this.hp + power);
        this.effect('rune', this.hero.x, this.hero.y - 24, 130, 750, '#b4e5c4');
        this.floating(this.hero.x, this.hero.y - 85, `+${power}`, '#bce4bd');
      } else if (kind === 'shield') {
        this.shield = Math.max(this.shield, 80 + (options.companions ?? 0) * 20);
        this.shieldUntil = this.elapsed + skill.power;
        this.effect('aura', this.hero.x, this.hero.y - 40, 150, 450, '#c6def0');
        this.floating(this.hero.x, this.hero.y - 85, 'ASTRAL WARD', '#bce0eb', 15);
      } else if (kind === 'restore') {
        this.mp = Math.min(this.maxMp, this.mp + power);
        this.effect('rune', this.hero.x, this.hero.y - 10, 140, 650, '#b9dfe9');
        this.floating(this.hero.x, this.hero.y - 85, `+${power} MP`, '#bde7ed', 18);
      } else if (kind === 'dash') {
        const goal = this.target ?? target?.sprite ?? { x: this.hero.x + (this.hero.flipX ? -150 : 150), y: this.hero.y };
        const angle = Math.atan2(goal.y - this.hero.y, goal.x - this.hero.x);
        const start = { x: this.hero.x, y: this.hero.y };
        let landing = start;
        for (let step = 1; step <= 15; step++) {
          const candidate = { x: clamp(start.x + Math.cos(angle) * step * 12, 80, WORLD.width - 80), y: clamp(start.y + Math.sin(angle) * step * 12, 80, WORLD.height - 70) };
          if (this.blockers.some((blocker) => candidate.x > blocker.x - 17 && candidate.x < blocker.x + blocker.width + 17 && candidate.y > blocker.y - 16 && candidate.y < blocker.y + blocker.height + 14)) break;
          landing = candidate;
        }
        this.effect('slash', start.x, start.y - 25, 105, 300, '#b9e8ef');
        this.hero.setPosition(landing.x, landing.y);
        this.target = null;
        this.route = [];
        this.invulnerableUntil = this.elapsed + .65;
        const segmentX = landing.x - start.x, segmentY = landing.y - start.y;
        const segmentLengthSq = segmentX * segmentX + segmentY * segmentY;
        for (const foe of this.enemies) {
          if (foe.dead) continue;
          const t = segmentLengthSq ? clamp(((foe.sprite.x - start.x) * segmentX + (foe.sprite.y - start.y) * segmentY) / segmentLengthSq, 0, 1) : 0;
          if (distance(foe.sprite, { x: start.x + t * segmentX, y: start.y + t * segmentY }) < 85) this.damage(foe, power);
        }
      } else if (target) {
        this.hero.setFlipX(target.sprite.x < this.hero.x);
        if (kind === 'aoe' && index === 6) {
          const center = { x: target.sprite.x, y: target.sprite.y };
          this.effect('rune', center.x, center.y - 12, 250, 1100, '#f0d6ad');
          for (let strike = 0; strike < 3; strike++) this.time.delayedCall(120 + strike * 250, () => {
            if (this.ended) return;
            const impact = { x: center.x + Math.cos(strike * 2.3) * 48, y: center.y + Math.sin(strike * 2.3) * 34 };
            this.effect('spark', impact.x, impact.y - 18, 180, 460, '#f4dcac');
            this.effect('aura', impact.x, impact.y - 18, 200, 420, '#d8e6c8');
            for (const foe of this.enemies) if (!foe.dead && distance(foe.sprite, center) < 210) this.damage(foe, Math.round(power / 3));
          });
        } else if (kind === 'aoe') {
          this.effect('rune', target.sprite.x, target.sprite.y - 15, 240, 550, '#d8c8f0');
          this.effect('aura', target.sprite.x, target.sprite.y - 30, 290, 460, '#b7dce9');
          for (const foe of this.enemies) if (!foe.dead && distance(foe.sprite, target.sprite) < 180) {
            this.damage(foe, power);
            foe.slowedUntil = this.elapsed + 4;
            if (!foe.dead && foe !== target) {
              const proximity = distance(foe.sprite, target.sprite);
              if (proximity > 45) foe.sprite.setPosition(foe.sprite.x + (target.sprite.x - foe.sprite.x) * .27, foe.sprite.y + (target.sprite.y - foe.sprite.y) * .27);
            }
          }
        } else {
          if (index === 0) {
            this.effect('slash', (this.hero.x + target.sprite.x) / 2, (this.hero.y + target.sprite.y) / 2 - 30, 155, 300, '#efdbab');
            this.damage(target, power);
          } else this.flyBolt(target, power);
          if (kind === 'stun') { target.stunnedUntil = this.elapsed + 3; this.effect('rune', target.sprite.x, target.sprite.y - 30, 120, 700, '#c0dce8'); }
        }
      }
      this.publishStats();
    }

    private flyBolt(target: Enemy, power: number) {
      const startX = this.hero.x, startY = this.hero.y - 44;
      const bolt = this.add.image(startX, startY, 'bolt').setDisplaySize(75, 34).setDepth(1800).setBlendMode(Phaser.BlendModes.ADD);
      bolt.setRotation(Math.atan2(target.sprite.y - 35 - startY, target.sprite.x - startX));
      this.tweens.add({ targets: bolt, x: target.sprite.x, y: target.sprite.y - 35, duration: options.reducedMotion ? 70 : 180, ease: 'Quad.easeIn', onComplete: () => {
        bolt.destroy();
        if (!this.ended && !target.dead) { this.damage(target, power); this.effect('slash', target.sprite.x, target.sprite.y - 40, 82, 250, '#daf0dd'); }
      } });
    }

    private damage(enemy: Enemy, amount: number) {
      if (enemy.dead || this.ended) return;
      const actual = Math.round(amount);
      enemy.hp = Math.max(0, enemy.hp - actual);
      this.ultimate = Math.min(100, this.ultimate + 3);
      this.floating(enemy.sprite.x, enemy.sprite.y - enemy.sprite.displayHeight * .7, `${actual}`, '#ffedc4');
      enemy.sprite.setTintFill(0xe8eed4);
      this.time.delayedCall(95, () => { if (!enemy.dead) enemy.sprite.clearTint(); });
      if (enemy.hp <= 0) {
        enemy.dead = true;
        enemy.sprite.setVelocity(0);
        enemy.frame.destroy(); enemy.meter.destroy();
        this.effect('spark', enemy.sprite.x, enemy.sprite.y - 35, enemy.kind === 'boss' ? 190 : 90, 600, '#dbedd5');
        this.tweens.add({ targets: [enemy.sprite, enemy.shadow], alpha: 0, duration: 360, onComplete: () => { enemy.sprite.destroy(); enemy.shadow.destroy(); } });
        this.kills++;
        this.mp = Math.min(this.maxMp, this.mp + 18);
        this.ultimate = Math.min(100, this.ultimate + 14);
        if (enemy.kind === 'boss') this.finish(true);
        else if (this.kills >= dungeonContent.unlockKills && !this.bossUnlocked) this.unlockBoss();
        else this.hint(`Guardian dispersed. ${Math.max(0, dungeonContent.unlockKills - this.kills)} more to break the ward.`);
      }
    }

    private unlockBoss() {
      this.bossUnlocked = true;
      this.tweens.add({ targets: this.gateArt, alpha: 0, scaleX: this.gateArt.scaleX * 1.5, scaleY: this.gateArt.scaleY * 1.5, duration: 1000 });
      this.boss = this.spawnEnemy('boss', dungeonContent.boss.x, dungeonContent.boss.y, dungeonContent.boss.hp);
      this.hp = Math.min(this.maxHp, this.hp + 45);
      this.mp = Math.min(this.maxMp, this.mp + 40);
      this.effect('rune', dungeonContent.boss.x, dungeonContent.boss.y, 360, 900, '#f3d4a6');
      options.onHint(`The celestial ward is broken. Seek ${dungeonContent.boss.name} in the northern circle.`);
      this.publishStats();
    }

    private hurt(damage: number) {
      if (this.ended || this.elapsed < this.invulnerableUntil) return;
      const absorbed = Math.min(this.shield, damage);
      this.shield -= absorbed;
      const actual = damage - absorbed;
      this.hp = Math.max(0, this.hp - actual);
      this.ultimate = Math.min(100, this.ultimate + 4);
      this.invulnerableUntil = this.elapsed + .28;
      this.floating(this.hero.x, this.hero.y - 80, actual ? `−${actual}` : 'WARD', actual ? '#ffd0bc' : '#c2e5ef', 21);
      if (!options.reducedMotion) this.cameras.main.shake(90, .0015);
      if (this.hp <= 0) this.finish(false);
    }

    private floating(x: number, y: number, value: string, color: string, size = 23) {
      const text = this.add.text(x, y, value, { fontFamily: 'Georgia, serif', fontSize: `${size}px`, color, stroke: '#253a43', strokeThickness: 4, shadow: { offsetX: 0, offsetY: 2, color: '#142630', blur: 5, fill: true } }).setOrigin(.5).setDepth(2200);
      this.tweens.add({ targets: text, y: y - 44, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => text.destroy() });
    }

    private offense(base: number) {
      return Math.round(base * (1 + Math.max(0, (options.playerLevel ?? 1) - 1) * .06) + (options.attackBonus ?? 0) + (options.partyBonuses?.attack ?? (options.companions ?? 0) * 3));
    }

    private effect(key: string, x: number, y: number, size: number, duration: number, tint?: string) {
      const effect = this.add.image(x, y, key).setDisplaySize(size * .55, size * .55).setDepth(y + 120).setBlendMode(Phaser.BlendModes.ADD);
      if (tint) effect.setTint(Number(`0x${tint.slice(1)}`));
      this.tweens.add({ targets: effect, scaleX: effect.scaleX * 1.8, scaleY: effect.scaleY * 1.8, alpha: 0, rotation: key === 'rune' ? .4 : 0, duration: options.reducedMotion ? Math.min(duration, 250) : duration, ease: 'Cubic.easeOut', onComplete: () => effect.destroy() });
    }

    private hint(message: string) {
      if (this.elapsed - this.hintAt < 1.8) return;
      this.hintAt = this.elapsed;
      options.onHint(message);
    }

    private publishStats() {
      if (disposed) return;
      const stats: DungeonStats = { hp: Math.ceil(this.hp), maxHp: this.maxHp, mp: Math.floor(this.mp), maxMp: this.maxMp, ultimate: Math.round(this.ultimate), auto: this.auto, cooldowns: [...this.cooldowns], enemiesRemaining: this.enemies.filter((enemy) => !enemy.dead).length, kills: this.kills, phase: this.ended ? (this.hp > 0 ? 'Sanctuary restored' : 'Retreat to the observatory') : this.bossUnlocked ? `${dungeonContent.boss.name}${this.boss && this.boss.hp > 0 ? ` · ${Math.ceil(this.boss.hp)} / ${this.boss.maxHp} HP` : ''}` : `Break the celestial ward · ${Math.min(this.kills, dungeonContent.unlockKills)} / ${dungeonContent.unlockKills}`, player: this.hero ? {x:this.hero.x,y:this.hero.y} : { ...dungeonContent.spawn }, enemies: this.enemies.filter(enemy=>!enemy.dead).map(enemy=>({x:enemy.sprite.x,y:enemy.sprite.y,boss:enemy.kind==='boss'})), mapWidth: WORLD.width, mapHeight: WORLD.height };
      options.onStats(stats);
    }

    private finish(victory: boolean) {
      if (this.ended || disposed) return;
      this.ended = true;
      this.hero.setVelocity(0);
      for (const enemy of this.enemies) if (!enemy.dead) enemy.sprite.setVelocity(0);
      this.physics.pause();
      this.publishStats();
      const result: CombatResult = { victory, gold: victory ? dungeonContent.rewards.gold + this.kills * 15 : this.kills * 15, shards: victory ? dungeonContent.rewards.shards : this.kills * 2, xp: victory ? dungeonContent.rewards.xp + this.kills * 10 : this.kills * 10, kills: this.kills };
      this.time.delayedCall(victory ? 900 : 500, () => { if (!disposed) options.onResult(result); });
    }

    toggle() { if (!this.ready || this.ended || pendingPause) return; this.auto = !this.auto; this.publishStats(); options.onHint(this.auto ? 'Auto enabled: Lyra approaches guardians and uses Astral Bolt and healing.' : 'Auto disabled. Tap to move, or use WASD. F casts a basic attack.'); }
  }

  scene = new WoodlandScene();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    transparent: true,
    antialias: true,
    pixelArt: false,
    powerPreference: 'low-power',
    scale: { mode: Phaser.Scale.RESIZE, width: Math.max(320, container.clientWidth), height: Math.max(300, container.clientHeight) },
    physics: { default: 'arcade', arcade: { debug: false } },
    input: { activePointers: 2 },
    audio: { noAudio: true },
    scene: [scene],
    render: { roundPixels: false, maxTextures: 16 },
  });
  const resizeObserver = new ResizeObserver(() => {
    if (!disposed && game && container.clientWidth && container.clientHeight) game.scale.resize(container.clientWidth, container.clientHeight);
  });
  resizeObserver.observe(container);

  return {
    castSkill(index) { scene?.cast(index); },
    toggleAuto() { scene?.toggle(); },
    setReducedMotion(enabled) { options.reducedMotion = enabled; },
    setPaused(paused) {
      pendingPause = paused;
      if (!game || disposed) return;
      if (paused) game.scene.pause('AstralWoodland');
      else game.scene.resume('AstralWoodland');
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      game?.destroy(true);
      game = undefined;
      scene = undefined;
    },
  };
}
