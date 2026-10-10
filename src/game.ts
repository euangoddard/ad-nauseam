import { SPR, HEART, ICONS, recolorSet, type SpriteSet } from './sprites';
import { sfx } from './audio';
import type { Input } from './input';
import { PERKS, type AdManager, type PerkId } from './ads';
import { UPGRADES, HEROES, loadSave, storeSave, nextCost, heroOwned } from './shop';

export const W = 320;
export const H = 180;
/** Walkable area, measured at the entities' feet. */
const AR = { x0: 12, y0: 40, x1: 308, y1: 172 };
const TORCHES = [40, 120, 200, 280];

export type EnemyType = 'skeleton' | 'zombie' | 'sorcerer' | 'goblin' | 'troll' | 'reaper' | 'glitch' | 'dragon' | 'eyeball' | 'bat' | 'bear' | 'worm' | 'slime';
type EState = 'chase' | 'windup' | 'recover' | 'cast' | 'summon' | 'flee' | 'phase' | 'breathe' | 'aim' | 'laser' | 'tears' | 'swoop' | 'screech' | 'charge' | 'maul' | 'stun' | 'burrow' | 'surface' | 'warp';

interface Stats {
  hp: number;
  speed: number;
  r: number;
  dmg: number;
  range: number;
  windup: number;
  recover: number;
  score: number;
  /** Knockback taken per hit. */
  kb: number;
  /** Height of the hit circle's centre above the feet. */
  hy: number;
  /** Chance of dropping a heart. */
  drop: number;
}

// Skeletons: fragile but hit hard. Zombies: tanky and slow, softer hits. Sorcerers: ranged + summoners.
// Goblins: fastest, stab and run. Trolls: huge, slowest, telegraphed ground slam. Reapers: teleport
// in and sweep a scythe. Baby dragons: fly at mid range and breathe a stream of fire.
const STATS: Record<EnemyType, Stats> = {
  skeleton: { hp: 1, speed: 50, r: 5, dmg: 24, range: 13, windup: 0.3, recover: 0.7, score: 100, kb: 90, hy: 6, drop: 0.1 },
  zombie: { hp: 6, speed: 19, r: 6, dmg: 11, range: 13, windup: 0.45, recover: 0.9, score: 150, kb: 35, hy: 6, drop: 0.2 },
  sorcerer: { hp: 4, speed: 32, r: 5, dmg: 14, range: 0, windup: 0.6, recover: 0, score: 300, kb: 90, hy: 6, drop: 0.1 },
  goblin: { hp: 2, speed: 74, r: 4, dmg: 9, range: 10, windup: 0.18, recover: 0.7, score: 120, kb: 120, hy: 5, drop: 0.1 },
  troll: { hp: 16, speed: 15, r: 9, dmg: 30, range: 24, windup: 0.85, recover: 1.1, score: 450, kb: 12, hy: 9, drop: 0.35 },
  reaper: { hp: 5, speed: 38, r: 5, dmg: 20, range: 16, windup: 0.45, recover: 0.6, score: 350, kb: 70, hy: 8, drop: 0.1 },
  // Rare. Teleports, slashes up close, fires pixel shards from range, and lobs a packet that freezes you.
  glitch: { hp: 7, speed: 42, r: 5, dmg: 16, range: 14, windup: 0.35, recover: 0.5, score: 600, kb: 60, hy: 7, drop: 0.3 },
  dragon: { hp: 4, speed: 56, r: 5, dmg: 8, range: 0, windup: 0.45, recover: 0.5, score: 250, kb: 90, hy: 11, drop: 0.15 },
  // The boss. `dmg` is the laser; every laser hit also pops up an ad.
  eyeball: { hp: 90, speed: 24, r: 14, dmg: 18, range: 0, windup: 0.6, recover: 0, score: 3000, kb: 4, hy: 26, drop: 1 },
  // Boss: two of these at once. `dmg` is the swoop; screech waves do `BAT.sonicDmg`.
  bat: { hp: 40, speed: 58, r: 8, dmg: 16, range: 0, windup: 0.55, recover: 0.4, score: 1500, kb: 10, hy: 18, drop: 1 },
  // Boss: charges (stuns itself on walls) and mauls; every hit gives you rabies.
  bear: { hp: 100, speed: 34, r: 10, dmg: 20, range: 30, windup: 0.8, recover: 0.5, score: 3000, kb: 6, hy: 9, drop: 1 },
  // Map natives. Sandworms (desert) tunnel underground and burst out under you. Slimes (slime land)
  // hop about and lob poison blobs that leave puddles.
  worm: { hp: 6, speed: 70, r: 6, dmg: 18, range: 0, windup: 0.7, recover: 0, score: 300, kb: 15, hy: 10, drop: 0.12 },
  slime: { hp: 4, speed: 34, r: 6, dmg: 8, range: 0, windup: 0.5, recover: 0.4, score: 200, kb: 60, hy: 5, drop: 0.12 },
};
const WORM = { up: 1.8, rise: 0.2, sink: 0.3, spitDmg: 8 };
/** The Glitch: warp time, how long a packet freezes you, shard and packet damage, packet speed. */
const GLITCH = { warp: 0.4, freeze: 3, shardDmg: 9, packetDmg: 6, packetSpeed: 95 };
const BLOB = { flight: 0.8, puddle: 3.5 };
const BOSS_NAMES: Partial<Record<EnemyType, string>> = { eyeball: 'THE ALL-SEEING EYE', bat: 'THE BAT TWINS', bear: 'RABID BEAR' };
const isBoss = (t: EnemyType) => t in BOSS_NAMES;
const BAT = { swoopSpeed: 240, swoop: 0.5, sonicDmg: 10 };
const BEAR = { chargeSpeed: 200, charge: 1.1, stun: 1.3, swipe: 0.2, swipeDmg: 12, rabies: 4 };
/** Coins dropped per kill: [min, max]. Tougher enemies pay more; summoned ones pay half. */
const COINS: Record<EnemyType, [number, number]> = {
  skeleton: [1, 3],
  zombie: [2, 5],
  goblin: [1, 4],
  sorcerer: [3, 7],
  dragon: [4, 8],
  reaper: [5, 9],
  glitch: [8, 14],
  troll: [6, 10],
  eyeball: [50, 50],
  bat: [25, 25],
  bear: [50, 50],
  worm: [4, 8],
  slime: [3, 6],
};
/** Guaranteed gem drops (bosses); everything else drops one 3% of the time. */
const GEMS: Partial<Record<EnemyType, number>> = { eyeball: 10, bear: 10, bat: 5 };
const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
/** Troll slam: area radius around the impact point. */
const SLAM_R = 26;
/** Baby dragon breath duration. */
const BREATH = 0.8;
/** Reaper fade-out + fade-in time. */
const PHASE = 0.5;
/** Boss eyeball: aim (tracking, then locked for `lock`), beam duration, tear damage. */
const EYE = { aim: 1.3, aimEnraged: 1, lock: 0.3, beam: 0.6, beamEnraged: 1.1, tearDmg: 10 };
/** Shop list layout: first row's y and row height. */
const SHOP_Y = 34;
const SHOP_ROW = 11;
/** Play button and tab label positions in the shop. */
const SHOP_PLAY = { x: W / 2 - 50, y: 148, w: 100, h: 13 };
const SHOP_TABS = ['UPGRADES', 'HEROES'];
const HERO_SPRITES = { adventurer: SPR.player, mage: SPR.mage, knight: SPR.knight, achilles: SPR.achilles };
/** Every sixth wave (so straight after clearing wave 5) is a boss wave. */
const isBossWave = (n: number) => n % 6 === 0;

/** Wand and sword are swapped freely; the nova is a special that can be armed when off cooldown. */
type Weapon = 'wand' | 'sword' | 'nova' | 'scatter' | 'bomb';
/** Scatter and bomb are bought in the shop. */
const WEAPON_KEYS: [string, Weapon][] = [
  ['Digit1', 'wand'],
  ['Digit2', 'sword'],
  ['Digit3', 'nova'],
  ['Digit4', 'scatter'],
  ['Digit5', 'bomb'],
];
const SCATTER = { cd: 0.28, spread: 0.18 };
const BOMB = { cd: 0.75, speed: 170, fuse: 0.55, radius: 24, dmg: 5 };
const SWORD = { cd: 0.32, swing: 0.12, reach: 22, arc: 1.1, dmg: 3 };
const NOVA = { cd: 30, radius: 110, speed: 260 };

/** Adopted in the shop. Pets can't be hurt. */
const PET_KINDS = ['spider', 'wolf', 'dragon', 'phoenix'] as const;

interface Pet {
  kind: (typeof PET_KINDS)[number];
  x: number;
  y: number;
  face: number;
  anim: number;
  cd: number;
  /** Dragon: time left breathing fire. Wolf: time left in a pounce. */
  breathT: number;
  aimX: number;
  aimY: number;
  /** Wolf pounce velocity. */
  vx: number;
  vy: number;
  /** The phoenix has already used its once-per-run revive. */
  spent: boolean;
}

interface Nova {
  x: number;
  y: number;
  r: number;
  hit: Set<Enemy>;
}

interface Enemy {
  type: EnemyType;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  state: EState;
  t: number;
  atkCd: number;
  flash: number;
  face: number;
  anim: number;
  aimX: number;
  aimY: number;
  /** Counts the bear's maul swipes. */
  combo: number;
  /** Coins a goblin has stolen and is running off with. */
  loot: number;
  /** Webbed by the pet spider: moves at half speed. */
  slowT: number;
  /** Troll slam target. */
  tx: number;
  ty: number;
  strafe: number;
  strafeT: number;
  fireCd: number;
  summonCd: number;
  summoned: boolean;
  dead: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  enemy: boolean;
  /** Dragon breath: short-lived flame instead of a fireball. */
  flame?: boolean;
  /** Boss tears: a blue fireball. */
  tear?: boolean;
  /** Player bomb: slows down and explodes when its fuse runs out or it touches an enemy. */
  bomb?: boolean;
  /** Bat screech: a sound-wave arc. */
  sonic?: boolean;
  /** Sandworm spit. */
  sand?: boolean;
  /** Slime poison blob: lobbed in an arc (x/y is the spot on the ground under it); leaves a puddle. */
  blob?: boolean;
  /** Glitch shard: a fast corrupted pixel. */
  shard?: boolean;
  /** Glitch packet: a slow corrupted block that freezes you in place. */
  packet?: boolean;
  /** Phoenix fire: a friendly fireball that homes in on the nearest enemy. */
  homing?: boolean;
  /** Mage bolts pass through this many more enemies (never hitting the same one twice). */
  pierce?: number;
  hits?: Set<Enemy>;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  grav: number;
  floor: number;
}

interface Portal {
  x: number;
  y: number;
  t: number;
  type: EnemyType;
  summoned: boolean;
}

/** Troll slam dust ring (purely visual). */
interface Shock {
  x: number;
  y: number;
  t: number;
}

/** Slime poison puddle. */
interface Puddle {
  x: number;
  y: number;
  t: number;
}

interface Pickup {
  x: number;
  y: number;
  t: number;
}

interface Slash {
  x: number;
  y: number;
  ang: number;
  t: number;
  color: string;
  r: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  t: number;
  color: string;
  /** Draw a little coin or gem in front of the text. */
  icon?: 'coin' | 'gem';
}

interface Decal {
  x: number;
  y: number;
  type: EnemyType;
  t: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Biome = 'dungeon' | 'desert' | 'slime';
/** Killing a boss moves you on to the next map, round and round. */
const BIOMES: Biome[] = ['dungeon', 'desert', 'slime'];

interface Look {
  floor: string[];
  grout: string;
  hi: string;
  specks: [string, string];
  crack: string;
  wall: string;
  bricks: string[];
  brickHi: string;
  brickLo: string;
  flame: [string, string, string];
}

const LOOKS: Record<Biome, Look> = {
  dungeon: {
    floor: ['#2b2d42', '#2e3047', '#292b3f', '#2c2f45'],
    grout: '#1f2033',
    hi: '#363852',
    specks: ['#34364f', '#24253a'],
    crack: '#1c1d2e',
    wall: '#16172a',
    bricks: ['#3e4160', '#44476a', '#393b58', '#41435f'],
    brickHi: '#55597f',
    brickLo: '#2c2e45',
    flame: ['#b13e53', '#ef7d57', '#ffcd75'],
  },
  desert: {
    floor: ['#a67c4e', '#ad8352', '#9f764a', '#a98050'],
    grout: '#8a6440',
    hi: '#bf9562',
    specks: ['#c29a66', '#8f6a44'],
    crack: '#7a5636',
    wall: '#5a3c26',
    bricks: ['#c99a5e', '#d1a466', '#bf9256', '#c69a60'],
    brickHi: '#e0b878',
    brickLo: '#9c7448',
    flame: ['#b13e53', '#ef7d57', '#ffcd75'],
  },
  slime: {
    floor: ['#1f3a33', '#223d34', '#1c3630', '#20392f'],
    grout: '#152a24',
    hi: '#2b4a3f',
    specks: ['#2f5446', '#16302a'],
    crack: '#10241e',
    wall: '#10241e',
    bricks: ['#2a4a3a', '#2f5040', '#264434', '#2c4c3c'],
    brickHi: '#3f6a52',
    brickLo: '#1a3428',
    flame: ['#257179', '#38b764', '#a7f070'],
  },
};

/** Each map repaints the enemies too (palette key → palette key). */
const TINTS: Record<Biome, Record<string, string> | null> = {
  dungeon: null,
  // Sun-bleached and sandy.
  desert: { e: 'y', E: 'o', l: 'f', P: 'o', p: 'r', g: 'b', G: 'm', d: 'm', n: 'r', u: 'o', w: 'b' },
  // Dripping with slime.
  slime: { w: 'l', b: 'l', g: 'e', G: 'E', m: 'e', P: 'e', p: 'E', d: 'E', n: 'E', u: 'e', o: 'l', y: 'l', f: 'l', r: 'e' },
};

const BIOME_INTRO: Record<Biome, [string, string]> = {
  dungeon: ['BACK TO THE DUNGEON', 'it never ends'],
  desert: ['THE DESERT', 'something moves under the sand'],
  slime: ['SLIME LAND', 'everything is sticky (-30% speed)'],
};

function makeBackground(biome: Biome): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const rng = mulberry32(1337 + BIOMES.indexOf(biome));
  const r = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const L = LOOKS[biome];

  // Floor tiles.
  for (let y = 32; y < H; y += 16) {
    for (let x = 0; x < W; x += 16) {
      g.fillStyle = r(L.floor);
      g.fillRect(x, y, 16, 16);
      g.fillStyle = L.grout;
      g.fillRect(x, y, 16, 1);
      g.fillRect(x, y, 1, 16);
      g.fillStyle = L.hi;
      g.fillRect(x + 1, y + 1, 15, 1);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = rng() < 0.5 ? L.specks[0] : L.specks[1];
        g.fillRect(x + 2 + Math.floor(rng() * 13), y + 2 + Math.floor(rng() * 13), 1, 1);
      }
      if (rng() < 0.15) {
        g.fillStyle = L.crack;
        let cx = x + 3 + Math.floor(rng() * 8);
        let cy = y + 3 + Math.floor(rng() * 6);
        for (let k = 0; k < 6; k++) {
          g.fillRect(cx, cy, 1, 1);
          cx += rng() < 0.5 ? 1 : 0;
          cy += 1;
        }
      }
      const deco = rng();
      if (biome === 'dungeon' && deco < 0.08) {
        // Moss.
        g.fillStyle = '#2f5a3a';
        for (let k = 0; k < 6; k++) g.fillRect(x + 1 + Math.floor(rng() * 5), y + 10 + Math.floor(rng() * 5), 1, 1);
      } else if (biome === 'desert' && deco < 0.05) {
        // A little cactus.
        const cx = x + 5 + Math.floor(rng() * 6);
        g.fillStyle = '#257179';
        g.fillRect(cx - 1, y + 5, 4, 9);
        g.fillStyle = '#38b764';
        g.fillRect(cx, y + 5, 2, 9);
        g.fillRect(cx - 3, y + 8, 2, 1);
        g.fillRect(cx - 3, y + 6, 1, 2);
        g.fillRect(cx + 3, y + 9, 2, 1);
        g.fillRect(cx + 4, y + 7, 1, 2);
      } else if (biome === 'desert' && deco < 0.1) {
        // Bleached bones.
        g.fillStyle = '#d8cfb4';
        g.fillRect(x + 4, y + 9, 6, 1);
        g.fillRect(x + 3, y + 8, 1, 3);
        g.fillRect(x + 10, y + 8, 1, 3);
      } else if (biome === 'desert' && deco < 0.3) {
        // Ripples in the sand.
        g.fillStyle = L.hi;
        const ry = y + 4 + Math.floor(rng() * 8);
        g.fillRect(x + 2, ry, 5, 1);
        g.fillRect(x + 7, ry + 1, 4, 1);
      } else if (biome === 'slime' && deco < 0.14) {
        // Slime puddle.
        const cx = x + 8 + Math.floor(rng() * 4) - 2;
        const cy = y + 9 + Math.floor(rng() * 4) - 2;
        g.fillStyle = '#257179';
        g.fillRect(cx - 6, cy - 1, 12, 4);
        g.fillRect(cx - 4, cy - 2, 8, 6);
        g.fillStyle = '#38b764';
        g.fillRect(cx - 5, cy - 1, 10, 3);
        g.fillRect(cx - 3, cy - 2, 6, 5);
        g.fillStyle = '#a7f070';
        g.fillRect(cx - 3, cy - 1, 2, 1);
      }
    }
  }

  // Back wall.
  g.fillStyle = L.wall;
  g.fillRect(0, 0, W, 32);
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    for (let x = row % 2 ? -8 : 0; x < W; x += 16) {
      g.fillStyle = r(L.bricks);
      g.fillRect(x + 1, y + 1, 14, 6);
      g.fillStyle = L.brickHi;
      g.fillRect(x + 1, y + 1, 14, 1);
      g.fillStyle = L.brickLo;
      g.fillRect(x + 1, y + 6, 14, 1);
    }
  }
  g.fillStyle = '#0e0e1a';
  g.fillRect(0, 32, W, 2);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(0, 34, W, 4);
  if (biome === 'slime') {
    // Slime oozing down the wall.
    for (let k = 0; k < 26; k++) {
      const x = Math.floor(rng() * W);
      const len = 3 + Math.floor(rng() * 9);
      const top = Math.floor(rng() * 20);
      g.fillStyle = '#38b764';
      g.fillRect(x, top, 2, len);
      g.fillStyle = '#a7f070';
      g.fillRect(x, top + len, 2, 2);
    }
  }

  // Side and bottom walls.
  g.fillStyle = L.wall;
  g.fillRect(0, 32, 6, H);
  g.fillRect(W - 6, 32, 6, H);
  g.fillRect(0, H - 4, W, 4);
  g.fillStyle = L.brickHi;
  g.fillRect(5, 32, 1, H - 36);
  g.fillRect(W - 6, 32, 1, H - 36);
  g.fillRect(6, H - 4, W - 12, 1);

  // Torch brackets.
  for (const tx of TORCHES) {
    g.fillStyle = '#1a1c2c';
    g.fillRect(tx - 2, 18, 5, 3);
    g.fillStyle = '#8b5a3c';
    g.fillRect(tx - 1, 16, 3, 6);
    g.fillStyle = '#566c86';
    g.fillRect(tx - 2, 15, 5, 2);
  }
  return c;
}

function loadBest() {
  try {
    return Number(localStorage.getItem('ad-nauseam-best')) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try {
    localStorage.setItem('ad-nauseam-best', String(v));
  } catch {
    /* storage unavailable — best score just won't persist */
  }
}

function newPlayer(maxHp = 120) {
  return {
    poisonName: 'POISON' as 'POISON' | 'RABIES',
    x: W / 2,
    y: 110,
    hp: maxHp,
    maxHp,
    aimX: 1,
    aimY: 0,
    face: 1,
    anim: 0,
    moving: false,
    shootCd: 0,
    weapon: 'wand' as Weapon,
    /** The weapon to go back to after the armed nova fires. */
    prevWeapon: 'wand' as Weapon,
    swingT: 0,
    specialCd: 0,
    novaT: 0,
    dashCd: 0,
    dashT: 0,
    dashX: 0,
    dashY: 0,
    invuln: 0,
    kx: 0,
    ky: 0,
    /** Rabies (bear) or poison (slime puddles): loses 3 HP a second. */
    poisonT: 0,
    poisonAcc: 0,
    /** Glitched by a Glitch packet: can't move or dash (can still aim and attack). */
    glitchT: 0,
  };
}

export class Game {
  state: 'title' | 'playing' | 'dying' | 'gameover' | 'shop' = 'title';
  paused = false;
  private g: CanvasRenderingContext2D;
  private time = 0;
  private player = newPlayer();
  private pets: Pet[] = [];
  /** Coins and shop purchases, kept between runs. */
  private save = loadSave();
  /** Coins picked up this run; banked when you die. Goblins steal from these. */
  private coins = 0;
  /** Gems found this run; banked when you die. They unlock heroes. */
  private gems = 0;
  private shopSel = 0;
  /** 0: upgrades (coins), 1: heroes (gems). */
  private shopTab = 0;
  /** Last mouse position in the shop, so a resting cursor doesn't fight the keyboard. */
  private shopMouse = { x: -1, y: -1 };
  private shopMsg = { text: '', t: 0, color: '' };
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private portals: Portal[] = [];
  private pickups: Pickup[] = [];
  private slashes: Slash[] = [];
  private novas: Nova[] = [];
  private shocks: Shock[] = [];
  private puddles: Puddle[] = [];
  private biome: Biome = 'dungeon';
  /** Set when a boss dies; the map changes when the next wave starts. */
  private nextBiome: Biome | null = null;
  private bgs = new Map<Biome, HTMLCanvasElement>();
  private tinted = new Map<string, SpriteSet>();
  private texts: FloatText[] = [];
  private decals: Decal[] = [];
  private adTimers: { t: number; src: EnemyType }[] = [];
  /** Timed upgrades/downgrades handed out by ads. */
  private perks: { id: PerkId; t: number }[] = [];
  private spawnQueue: EnemyType[] = [];
  /** Total boss HP at spawn, for the boss bar (the bats share one). */
  private bossMax = 0;
  private spawnT = 0;
  private waveBreak = 0;
  private banner = { text: '', sub: '', t: 0 };
  private shake = 0;
  private hurtFlash = 0;
  private novaFlash = 0;
  private dyingT = 0;
  private score = 0;
  private kills = 0;
  private wave = 0;
  private best = loadBest();
  private newBest = false;

  constructor(
    canvas: HTMLCanvasElement,
    private input: Input,
    private ads: AdManager,
  ) {
    this.g = canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    ads.onPerk = (id) => this.applyPerk(id);
  }

  private has(id: PerkId) {
    return this.perks.some((k) => k.id === id);
  }

  private get speedMul() {
    return (this.has('swift') ? 1.4 : 1) * (this.has('slow') ? 0.65 : 1);
  }

  private get hero() {
    return HEROES[this.save.hero] ?? HEROES[0];
  }

  /**
   * Every upgrade, pet and stronger hero makes the enemies tougher too: +5% HP, +2% damage and +1%
   * speed per point.
   */
  private get threat() {
    const s = this.save;
    const hero = { adventurer: 0, mage: 2, knight: 3, achilles: 5 }[this.hero.id];
    return s.dmg + s.hp + s.nova + s.scatter + s.bomb + 2 * (s.spider + s.wolf) + 3 * (s.dragon + s.phoenix) + hero;
  }

  private get dmgMul() {
    return this.hero.dmg * (1 + this.save.dmg * 0.2) * (this.has('power') ? 2 : 1) * (this.has('weak') ? 0.5 : 1);
  }

  private newPet(kind: Pet['kind']): Pet {
    const p = this.player;
    return { kind, x: p.x + (kind === 'dragon' ? -14 : 14), y: p.y + 4, face: 1, anim: 0, cd: 1, breathT: 0, aimX: 1, aimY: 0, vx: 0, vy: 0, spent: false };
  }

  private get novaCd() {
    return (NOVA.cd - this.save.nova * 5) * (this.hero.id === 'mage' ? 0.6 : 1);
  }

  private owned(w: Weapon) {
    return w === 'scatter' ? this.save.scatter > 0 : w === 'bomb' ? this.save.bomb > 0 : true;
  }

  private get weapons() {
    return WEAPON_KEYS.map(([, w]) => w).filter((w) => this.owned(w));
  }

  private get rateMul() {
    return (this.has('rapid') ? 2 : 1) * (this.has('jam') ? 0.5 : 1);
  }

  private applyPerk(id: PerkId) {
    if (this.state !== 'playing') return;
    const p = this.player;
    const perk = PERKS[id];
    if (id === 'heal') p.hp = Math.min(p.maxHp, p.hp + 30);
    if (id === 'drain') p.hp = Math.max(1, p.hp - 20);
    if (id === 'nova') p.specialCd = Math.min(p.specialCd, 0.01);
    if (perk.secs > 0) {
      this.perks = this.perks.filter((k) => k.id !== id);
      this.perks.push({ id, t: perk.secs });
    }
    this.texts.push({ x: p.x, y: p.y - 24, text: perk.hud || perk.desc, t: 1.4, color: perk.good ? '#a7f070' : '#ff004d' });
    if (perk.good) sfx.pickup();
    else sfx.buzz();
  }

  private get difficulty() {
    return 1 + (this.wave - 1) * 0.04;
  }

  start() {
    this.player = newPlayer(this.hero.hp + this.save.hp * 15);
    this.pets = PET_KINDS.filter((k) => this.save[k] > 0).map((k) => this.newPet(k));
    this.coins = 0;
    this.gems = 0;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.portals = [];
    this.pickups = [];
    this.slashes = [];
    this.novas = [];
    this.shocks = [];
    this.puddles = [];
    this.biome = 'dungeon';
    this.nextBiome = null;
    this.novaFlash = 0;
    this.texts = [];
    this.decals = [];
    this.adTimers = [];
    this.perks = [];
    this.spawnQueue = [];
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.newBest = false;
    this.paused = false;
    this.ads.reset();
    this.state = 'playing';
    this.waveBreak = 1.2;
    this.banner = { text: 'GET READY', sub: 'every kill is sponsored', t: 1.2 };
  }

  private setBiome(b: Biome) {
    this.biome = b;
    this.nextBiome = null;
    this.decals = [];
    this.puddles = [];
    this.novaFlash = 0.6;
  }

  private get background() {
    let bg = this.bgs.get(this.biome);
    if (!bg) {
      bg = makeBackground(this.biome);
      this.bgs.set(this.biome, bg);
    }
    return bg;
  }

  /** Enemy sprites repainted for the current map (map natives keep their own colours). */
  private enemySprite(type: EnemyType): SpriteSet {
    const tint = TINTS[this.biome];
    if (!tint || type === 'worm' || type === 'slime' || type === 'glitch') return SPR[type];
    const key = `${this.biome}:${type}`;
    let set = this.tinted.get(key);
    if (!set) {
      set = recolorSet(SPR[type], tint);
      this.tinted.set(key, set);
    }
    return set;
  }

  private startWave(n: number) {
    this.wave = n;
    this.ads.level = n;
    let intro = '';
    if (this.nextBiome) {
      this.setBiome(this.nextBiome);
      intro = BIOME_INTRO[this.biome][1];
    }
    if (isBossWave(n)) {
      // Which boss you get is down to luck.
      const [queue, sub] = pick<[EnemyType[], string]>([
        [['eyeball'], 'a giant eyeball is watching you'],
        [['bat', 'bat'], 'two giant bats smell your blood'],
        [['bear'], 'a bear with rabies wants a hug'],
      ]);
      this.spawnQueue = queue;
      this.spawnT = 1.5;
      this.bossMax = 0;
      this.banner = { text: 'WARNING!', sub, t: 2.5 };
      sfx.siren();
      return;
    }
    // New enemy types join over the first five waves, one or two of each at first.
    const counts: [EnemyType, number][] = [
      ['skeleton', 2 + Math.ceil(n * 0.8)],
      ['zombie', Math.ceil(n * 0.6)],
      ['sorcerer', n >= 2 ? Math.ceil(n * 0.4) : 0],
      ['goblin', n >= 2 ? Math.ceil((n - 1) * 0.6) : 0],
      ['troll', n >= 3 ? Math.max(1, Math.floor(n / 3)) : 0],
      ['dragon', n >= 4 ? Math.max(1, Math.floor((n - 1) / 3)) : 0],
      ['reaper', n >= 5 ? Math.max(1, Math.floor((n - 2) / 3)) : 0],
      ['worm', this.biome === 'desert' ? 2 + Math.floor(n / 3) : 0],
      ['slime', this.biome === 'slime' ? 3 + Math.floor(n / 3) : 0],
      // Still the rarest enemy: often one a wave from wave 2, sometimes two from wave 7.
      ['glitch', (n >= 2 && Math.random() < Math.min(0.75, 0.3 + n * 0.05) ? 1 : 0) + (n >= 7 && Math.random() < 0.3 ? 1 : 0)],
    ];
    const list: EnemyType[] = [];
    for (const [type, count] of counts) for (let i = 0; i < count; i++) list.push(type);
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    this.spawnQueue = list;
    this.spawnT = 0.6;
    const introSub: Record<number, string> = { 2: 'sorcerers + goblins incoming', 3: 'trolls incoming', 4: 'baby dragons incoming', 5: 'reapers incoming' };
    const glitchSub = list.includes('glitch') ? 's0meth1ng is gl1tch1ng' : '';
    this.banner = { text: intro ? BIOME_INTRO[this.biome][0] : `WAVE ${n}`, sub: intro || (introSub[n] ?? glitchSub), t: intro ? 3 : 2 };
    sfx.wave();
  }

  // --- Update --------------------------------------------------------------

  update(dt: number) {
    this.time += dt;
    const i = this.input;
    if (i.hit('KeyM')) sfx.toggleMute();

    if (this.state === 'title') {
      if (i.hit('KeyS')) {
        this.state = 'shop';
        this.shopSel = 0;
        sfx.click();
      } else if (i.hit('Enter', 'Space') || i.clicked) this.start();
      return;
    }
    if (this.state === 'gameover') {
      this.updateParticles(dt);
      if (!this.ads.blocking && (i.hit('Enter') || i.clicked)) {
        this.state = 'shop';
        this.shopSel = 0;
        sfx.click();
      }
      return;
    }
    if (this.state === 'shop') return this.updateShop(dt);
    if (this.ads.blocking) return;
    if (this.state === 'playing' && i.hit('Escape', 'KeyP')) this.paused = !this.paused;
    if (this.paused) return;

    this.shake = Math.max(0, this.shake - dt * 20);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.novaFlash = Math.max(0, this.novaFlash - dt);
    this.banner.t -= dt;

    if (this.state === 'dying') {
      this.dyingT -= dt;
      this.updateParticles(dt);
      if (this.dyingT <= 0) {
        this.state = 'gameover';
        this.save.coins += this.coins;
        this.save.gems += this.gems;
        storeSave(this.save);
        if (this.score > this.best) {
          this.best = this.score;
          this.newBest = true;
          saveBest(this.best);
        }
        this.ads.push('death');
      }
      return;
    }

    this.updatePlayer(dt);
    this.updatePets(dt);
    this.updateNovas(dt);
    this.updateWaves(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updatePortals(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);

    for (const k of this.perks) k.t -= dt;
    this.perks = this.perks.filter((k) => k.t > 0);

    for (const a of this.adTimers) {
      a.t -= dt;
      if (a.t <= 0) this.ads.push(a.src);
    }
    this.adTimers = this.adTimers.filter((a) => a.t > 0);
  }

  private updateWaves(dt: number) {
    if (this.waveBreak > 0) {
      this.waveBreak -= dt;
      if (this.waveBreak <= 0) this.startWave(this.wave + 1);
      return;
    }
    if (this.spawnQueue.length) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = rand(0.5, 1.1) / this.difficulty;
        const p = this.player;
        const type = this.spawnQueue.pop()!;
        let x = 0;
        let y = 0;
        for (let tries = 0; tries < 20; tries++) {
          x = rand(AR.x0 + 10, AR.x1 - 10);
          y = rand(AR.y0 + 6, AR.y1 - 6);
          if (Math.hypot(x - p.x, y - p.y) > 80) break;
        }
        // Bosses rise up on the far side of the room from the player; the bats arrive together.
        if (isBoss(type)) {
          x = p.x < W / 2 ? 240 : 80;
          y = type === 'bat' ? (this.spawnQueue.length ? 80 : 140) : 100;
          if (type === 'bat') this.spawnT = 0.2;
        }
        this.portals.push({ x, y, t: 0.9, type, summoned: false });
        sfx.spawn();
      }
      return;
    }
    if (!this.enemies.length && !this.portals.length && !this.adTimers.length) {
      this.waveBreak = 3;
      const heal = Math.min(15, this.player.maxHp - this.player.hp);
      this.player.hp += heal;
      this.addGems(1, this.player.x, this.player.y - 28);
      if (isBossWave(this.wave)) this.nextBiome = BIOMES[(BIOMES.indexOf(this.biome) + 1) % BIOMES.length];
      this.banner = this.nextBiome
        ? { text: 'BOSS DEFEATED!', sub: `next stop: ${BIOME_INTRO[this.nextBiome][0].toLowerCase()}`, t: 2.5 }
        : { text: 'WAVE CLEAR!', sub: heal > 0 ? `+${heal} HP` : 'no ad for this one... yet', t: 2.5 };
      sfx.pickup();
    }
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const i = this.input;
    let mx = (i.down('KeyD') ? 1 : 0) - (i.down('KeyA') ? 1 : 0);
    let my = (i.down('KeyS') ? 1 : 0) - (i.down('KeyW') ? 1 : 0);
    const ml = Math.hypot(mx, my);
    if (ml > 0) {
      mx /= ml;
      my /= ml;
    }
    if (this.has('reverse')) {
      mx = -mx;
      my = -my;
    }
    const glitched = p.glitchT > 0;
    if (glitched) {
      p.glitchT -= dt;
      mx = 0;
      my = 0;
      if (Math.random() < 0.3) this.particles.push({ x: p.x + rand(-6, 6), y: p.y - rand(0, 14), vx: 0, vy: 0, life: 0.15, color: pick(['#ff004d', '#73eff7', '#8a3f9e']), size: 1, grav: 0, floor: 999 });
    }
    p.dashCd -= dt;
    p.invuln -= dt;
    p.shootCd -= dt;
    p.swingT -= dt;
    p.novaT -= dt;

    if (glitched) {
      // No dashing or blinking out of a glitch.
      if (i.hit('Space', 'ShiftLeft', 'ShiftRight')) sfx.buzz();
    } else if (i.hit('Space', 'ShiftLeft', 'ShiftRight') && p.dashCd <= 0 && this.hero.id === 'mage') {
      // The mage blinks instead of dashing: an instant short teleport.
      const bx = ml > 0 ? mx : p.aimX;
      const by = ml > 0 ? my : p.aimY;
      this.burst(p.x, p.y - 6, 12, ['#8a3f9e', '#f5a3c7', '#41a6f6'], 50);
      p.x = clamp(p.x + bx * 48, AR.x0, AR.x1);
      p.y = clamp(p.y + by * 48, AR.y0, AR.y1);
      this.burst(p.x, p.y - 6, 12, ['#8a3f9e', '#f5a3c7', '#41a6f6'], 50);
      p.dashCd = 0.8;
      p.invuln = Math.max(p.invuln, 0.3);
      sfx.blink();
    } else if (i.hit('Space', 'ShiftLeft', 'ShiftRight') && p.dashCd <= 0) {
      p.dashX = ml > 0 ? mx : p.aimX;
      p.dashY = ml > 0 ? my : p.aimY;
      p.dashT = 0.16;
      p.dashCd = 0.8;
      p.invuln = Math.max(p.invuln, 0.22);
      sfx.dash();
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashX * 230 * dt;
      p.y += p.dashY * 230 * dt;
      this.particles.push({ x: p.x + rand(-3, 3), y: p.y - rand(2, 12), vx: 0, vy: 0, life: 0.2, color: '#41a6f6', size: 2, grav: 0, floor: 999 });
    } else {
      // Slime land: everything is sticky.
      const sticky = this.biome === 'slime' ? 0.7 : 1;
      p.x += mx * this.hero.speed * this.speedMul * sticky * dt;
      p.y += my * this.hero.speed * this.speedMul * sticky * dt;
      if (sticky < 1 && ml > 0 && Math.random() < 0.2) this.particles.push({ x: p.x + rand(-3, 3), y: p.y, vx: 0, vy: 0, life: 0.5, color: pick(['#38b764', '#a7f070']), size: 1, grav: 0, floor: 999 });
    }
    if (p.poisonT > 0) {
      p.poisonT -= dt;
      p.poisonAcc += 3 * dt;
      while (p.poisonAcc >= 1) {
        p.poisonAcc -= 1;
        p.hp -= 1;
      }
      if (Math.random() < 0.3) this.particles.push({ x: p.x + rand(-3, 3), y: p.y - 10, vx: rand(-10, 10), vy: 0, life: 0.5, color: pick(['#a7f070', '#f4f4f4']), size: 1, grav: 80, floor: p.y });
      if (p.hp <= 0) this.playerDown();
    }
    p.x += p.kx * dt;
    p.y += p.ky * dt;
    p.kx *= Math.exp(-10 * dt);
    p.ky *= Math.exp(-10 * dt);
    p.x = clamp(p.x, AR.x0, AR.x1);
    p.y = clamp(p.y, AR.y0, AR.y1);
    p.moving = ml > 0 && !glitched;
    if (p.moving) p.anim += dt;

    // Aim: arrow keys take priority (twin-stick on keyboard), otherwise follow the mouse.
    let ax = (i.down('ArrowRight') ? 1 : 0) - (i.down('ArrowLeft') ? 1 : 0);
    let ay = (i.down('ArrowDown') ? 1 : 0) - (i.down('ArrowUp') ? 1 : 0);
    let firing = false;
    if (ax || ay) {
      const al = Math.hypot(ax, ay);
      ax /= al;
      ay /= al;
      p.aimX = ax;
      p.aimY = ay;
      firing = true;
    } else if (i.mouse.active) {
      const dx = i.mouse.x - p.x;
      const dy = i.mouse.y - (p.y - 6);
      const d = Math.hypot(dx, dy) || 1;
      p.aimX = dx / d;
      p.aimY = dy / d;
      firing = i.mouse.down;
    }
    p.face = p.aimX < 0 ? -1 : 1;

    // Weapon switching: 1/2/3 select, Q swaps wand/sword, the mouse wheel cycles all three.
    // E / right-click fire the nova directly.
    for (const [key, w] of WEAPON_KEYS) if (i.hit(key)) this.selectWeapon(w);
    if (i.hit('KeyQ')) this.selectWeapon(p.weapon === 'wand' ? 'sword' : 'wand');
    if (i.wheel) this.cycleWeapon(i.wheel);
    if (i.hit('KeyE') || i.rightClicked) this.castNova();

    if (firing && p.shootCd <= 0) {
      if (p.weapon === 'nova') this.castNova();
      else if (p.weapon === 'sword') this.swingSword();
      else if (p.weapon === 'scatter') {
        p.shootCd = SCATTER.cd / this.rateMul;
        const base = Math.atan2(p.aimY, p.aimX);
        for (const da of [-SCATTER.spread, 0, SCATTER.spread]) {
          const ax = Math.cos(base + da);
          const ay = Math.sin(base + da);
          this.bullets.push(this.bolt(ax, ay, 1.2));
        }
        sfx.shoot();
      } else if (p.weapon === 'bomb') {
        p.shootCd = BOMB.cd / this.rateMul;
        this.bullets.push({ x: p.x + p.aimX * 8, y: p.y - 6 + p.aimY * 8, vx: p.aimX * BOMB.speed, vy: p.aimY * BOMB.speed, r: 3, dmg: BOMB.dmg * this.dmgMul, life: BOMB.fuse, enemy: false, bomb: true });
        sfx.toss();
      } else {
        p.shootCd = 0.17 / this.rateMul;
        this.bullets.push(this.bolt(p.aimX, p.aimY, 1.5));
        sfx.shoot();
      }
    }
  }

  private nearestEnemy(x: number, y: number, range: number) {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * Pets. The dragon hovers behind you and breathes bursts of blue fire at the nearest enemy; the
   * spider scuttles off to bite things (webbing them to half speed) and comes back when it's quiet.
   * The wolf runs down enemies and pounces. The phoenix circles you firing homing fireballs, and brings
   * you back to life once per run (see `playerDown()`).
   */
  private updatePets(dt: number) {
    const p = this.player;
    for (const pet of this.pets) {
      pet.cd -= dt;
      pet.anim += dt;
      if (pet.kind === 'dragon') {
        const tx = p.x - p.face * 14;
        const ty = p.y + 2;
        pet.x += (tx - pet.x) * Math.min(1, dt * 4);
        pet.y += (ty - pet.y) * Math.min(1, dt * 4);
        const mx = pet.x + pet.face * 7;
        const my = pet.y - 14;
        const target = this.nearestEnemy(pet.x, pet.y, 110);
        if (target) {
          const d = Math.hypot(target.x - mx, target.y - STATS[target.type].hy - my) || 1;
          pet.aimX = (target.x - mx) / d;
          pet.aimY = (target.y - STATS[target.type].hy - my) / d;
          pet.face = pet.aimX < 0 ? -1 : 1;
          if (pet.cd <= 0 && pet.breathT <= 0) {
            pet.breathT = 0.5;
            pet.cd = 1.8;
            sfx.breath();
          }
        } else {
          pet.face = p.face;
        }
        if (pet.breathT > 0) {
          pet.breathT -= dt;
          const a = Math.atan2(pet.aimY, pet.aimX) + rand(-0.2, 0.2);
          const v = rand(150, 180);
          this.bullets.push({ x: mx, y: my, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2, dmg: 0.4 * this.dmgMul, life: rand(0.38, 0.46), enemy: false, flame: true });
        }
      } else if (pet.kind === 'phoenix') {
        const a = this.time * 1.8;
        const tx = p.x + Math.cos(a) * 20;
        const ty = p.y + Math.sin(a) * 10;
        pet.x += (tx - pet.x) * Math.min(1, dt * 5);
        pet.y += (ty - pet.y) * Math.min(1, dt * 5);
        pet.face = Math.cos(a + Math.PI / 2) < 0 ? -1 : 1;
        if (Math.random() < 0.3) this.particles.push({ x: pet.x + rand(-4, 4), y: pet.y - 14, vx: 0, vy: 15, life: 0.4, color: pick(['#ffcd75', '#ef7d57', '#ff004d']), size: 1, grav: 0, floor: 999 });
        const target = this.nearestEnemy(pet.x, pet.y, 150);
        if (target && pet.cd <= 0) {
          pet.cd = 1.6;
          const d = Math.hypot(target.x - pet.x, target.y - pet.y) || 1;
          this.bullets.push({ x: pet.x, y: pet.y - 16, vx: ((target.x - pet.x) / d) * 140, vy: ((target.y - pet.y) / d) * 140, r: 3, dmg: 3 * this.dmgMul, life: 2, enemy: false, homing: true });
          sfx.fireball();
        }
      } else if (pet.kind === 'wolf') {
        // Runs enemies down and pounces from close range; trots back to your side when it's quiet.
        const target = this.nearestEnemy(p.x, p.y, 140);
        if (pet.breathT > 0) {
          pet.breathT -= dt;
          pet.x += pet.vx * dt;
          pet.y += pet.vy * dt;
          for (const e of this.enemies) {
            if (!this.targetable(e) || Math.hypot(e.x - pet.x, e.y - pet.y) > STATS[e.type].r + 7) continue;
            const d = Math.hypot(pet.vx, pet.vy) || 1;
            this.hitEnemy(e, 3 * this.dmgMul, pet.vx / d, pet.vy / d, 1.5);
            sfx.bite();
            pet.breathT = 0;
            break;
          }
        } else {
          const tx = target ? target.x : p.x - 16;
          const ty = target ? target.y : p.y + 6;
          const dx = tx - pet.x;
          const dy = ty - pet.y;
          const d = Math.hypot(dx, dy) || 1;
          if (target && d < 40 && pet.cd <= 0) {
            pet.breathT = 0.22;
            pet.cd = 1.1;
            pet.vx = (dx / d) * 260;
            pet.vy = (dy / d) * 260;
            sfx.howl();
          } else if (d > (target ? 12 : 8)) {
            const step = Math.min(d, (target ? 125 : 100) * dt);
            pet.x += (dx / d) * step;
            pet.y += (dy / d) * step;
            pet.anim += dt * 2;
          }
          if (Math.abs(dx) > 1) pet.face = dx < 0 ? -1 : 1;
        }
      } else {
        const target = this.nearestEnemy(p.x, p.y, 120);
        let tx = p.x + 14;
        let ty = p.y + 4;
        if (target) {
          tx = target.x;
          ty = target.y;
        }
        const dx = tx - pet.x;
        const dy = ty - pet.y;
        const d = Math.hypot(dx, dy);
        if (target && d < STATS[target.type].r + 6) {
          if (pet.cd <= 0) {
            pet.cd = 0.9;
            target.slowT = 2;
            this.hitEnemy(target, 2 * this.dmgMul, dx / (d || 1), dy / (d || 1), 0.5);
            sfx.bite();
          }
        } else if (d > (target ? 0 : 6)) {
          const step = Math.min(d, 95 * dt);
          pet.x += (dx / d) * step;
          pet.y += (dy / d) * step;
          pet.anim += dt * 2;
        }
        if (Math.abs(dx) > 1) pet.face = dx < 0 ? -1 : 1;
      }
      pet.x = clamp(pet.x, AR.x0, AR.x1);
      pet.y = clamp(pet.y, AR.y0, AR.y1);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private updateShop(dt: number) {
    const i = this.input;
    this.shopMsg.t -= dt;
    const m = i.mouse;
    const overTab = m.active && m.y >= 20 && m.y < 30 ? (m.x < W / 2 ? 0 : 1) : -1;
    if (i.hit('KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight') || (i.clicked && overTab >= 0 && overTab !== this.shopTab)) {
      this.shopTab = 1 - this.shopTab;
      this.shopSel = 0;
      sfx.click();
      return;
    }
    const rows = this.shopTab ? HEROES.length : UPGRADES.length;
    if (i.hit('KeyW', 'ArrowUp')) this.shopSel = (this.shopSel + rows - 1) % rows;
    if (i.hit('KeyS', 'ArrowDown')) this.shopSel = (this.shopSel + 1) % rows;
    const overRow = m.active && m.x > 8 && m.x < W - 8 ? Math.floor((m.y - SHOP_Y + 2) / SHOP_ROW) : -1;
    const moved = m.x !== this.shopMouse.x || m.y !== this.shopMouse.y;
    this.shopMouse = { x: m.x, y: m.y };
    if ((moved || i.clicked) && overRow >= 0 && overRow < rows) this.shopSel = overRow;
    if (i.hit('Enter') || (i.clicked && this.overPlay())) {
      sfx.click();
      this.start();
      return;
    }
    if (i.hit('Space', 'KeyE') || (i.clicked && overRow >= 0 && overRow < rows)) {
      if (this.shopTab) this.pickHero(this.shopSel);
      else this.buy(UPGRADES[this.shopSel]);
    }
  }

  private overPlay() {
    const m = this.input.mouse;
    return m.active && m.x > SHOP_PLAY.x && m.x < SHOP_PLAY.x + SHOP_PLAY.w && m.y > SHOP_PLAY.y && m.y < SHOP_PLAY.y + SHOP_PLAY.h;
  }

  private buy(u: (typeof UPGRADES)[number]) {
    const cost = nextCost(this.save, u);
    if (cost === null) {
      this.shopMsg = { text: u.costs.length > 1 ? 'MAXED OUT' : 'ALREADY OWNED', t: 1.2, color: '#94b0c2' };
      sfx.buzz();
    } else if (cost > this.save.coins) {
      this.shopMsg = { text: `NEED ${cost - this.save.coins} MORE COINS`, t: 1.2, color: '#ff004d' };
      sfx.buzz();
    } else {
      this.save.coins -= cost;
      this.save[u.id]++;
      storeSave(this.save);
      this.shopMsg = { text: `BOUGHT ${u.name}! ENEMIES TOUGHEN UP`, t: 1.6, color: '#a7f070' };
      sfx.buy();
    }
  }

  /** Unlock a hero with gems, or switch to one you already have. */
  private pickHero(idx: number) {
    const h = HEROES[idx];
    if (!heroOwned(this.save, h)) {
      if (h.gems > this.save.gems) {
        this.shopMsg = { text: `NEED ${h.gems - this.save.gems} MORE GEMS`, t: 1.2, color: '#ff004d' };
        sfx.buzz();
        return;
      }
      this.save.gems -= h.gems;
      this.save[h.id as Exclude<typeof h.id, 'adventurer'>] = 1;
      sfx.buy();
    } else {
      sfx.equip();
    }
    this.save.hero = idx;
    storeSave(this.save);
    this.shopMsg = { text: `PLAYING AS ${h.name}`, t: 1.2, color: '#a7f070' };
  }

  /** A wand/scatter bolt. The mage's are magic: faster, and they pierce through two more enemies. */
  private bolt(ax: number, ay: number, life: number): Bullet {
    const p = this.player;
    const mage = this.hero.id === 'mage';
    const v = mage ? 250 : 220;
    const b: Bullet = { x: p.x + ax * 9, y: p.y - 6 + ay * 9, vx: ax * v, vy: ay * v, r: 2, dmg: this.dmgMul, life, enemy: false };
    if (mage) {
      b.pierce = 2;
      b.hits = new Set();
    }
    return b;
  }

  private addGems(n: number, x: number, y: number) {
    this.gems += n;
    this.texts.push({ x, y, text: `+${n}`, t: 1.2, color: '#73eff7', icon: 'gem' });
    sfx.gem();
  }

  private selectWeapon(w: Weapon) {
    const p = this.player;
    if (w === p.weapon || !this.owned(w)) return;
    if (w === 'nova') {
      if (p.specialCd > 0) return this.novaNotReady();
      p.prevWeapon = p.weapon;
    }
    p.weapon = w;
    sfx.equip();
  }

  private cycleWeapon(dir: number) {
    const p = this.player;
    const list = this.weapons;
    let idx = list.indexOf(p.weapon);
    for (let k = 0; k < list.length; k++) {
      idx = (idx + Math.sign(dir) + list.length) % list.length;
      if (list[idx] !== 'nova' || p.specialCd <= 0) break;
    }
    this.selectWeapon(list[idx]);
  }

  private novaNotReady() {
    const p = this.player;
    this.texts.push({ x: p.x, y: p.y - 18, text: `NOVA ${Math.ceil(p.specialCd)}s`, t: 0.8, color: '#94b0c2' });
    sfx.buzz();
  }

  /** Melee arc in the aim direction. Hits everything in the arc and knocks fireballs out of the air. */
  private swingSword() {
    const p = this.player;
    p.shootCd = SWORD.cd / this.rateMul;
    p.swingT = SWORD.swing;
    p.kx += p.aimX * 40;
    p.ky += p.aimY * 40;
    const cx = p.x;
    const cy = p.y - 6;
    const ang = Math.atan2(p.aimY, p.aimX);
    this.slashes.push({ x: cx + p.aimX * 6, y: cy + p.aimY * 6, ang, t: 0.14, color: '#73eff7', r: 14 });
    sfx.slash();
    const inArc = (x: number, y: number, reach: number) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > reach) return false;
      let da = Math.abs(Math.atan2(dy, dx) - ang);
      if (da > Math.PI) da = Math.PI * 2 - da;
      return d < 6 || da < SWORD.arc;
    };
    for (const e of this.enemies) {
      const ey = e.y - STATS[e.type].hy;
      if (!this.targetable(e) || !inArc(e.x, ey, SWORD.reach + STATS[e.type].r)) continue;
      const d = Math.hypot(e.x - cx, ey - cy) || 1;
      this.hitEnemy(e, SWORD.dmg * this.dmgMul, (e.x - cx) / d, (ey - cy) / d, 1.8);
    }
    let parried = false;
    for (const b of this.bullets) {
      if (!b.enemy || b.life <= 0 || !inArc(b.x, b.y, SWORD.reach + b.r)) continue;
      b.life = 0;
      this.burst(b.x, b.y, b.flame ? 2 : 6, ['#73eff7', '#f4f4f4', '#ffcd75'], 50);
      parried = true;
    }
    if (parried) sfx.parry();
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /** The special: an expanding shockwave that hits every enemy once and wipes out fireballs. */
  private castNova() {
    const p = this.player;
    if (p.specialCd > 0) return this.novaNotReady();
    p.specialCd = this.novaCd;
    p.novaT = 0.4;
    p.shootCd = 0.3;
    p.invuln = Math.max(p.invuln, 1);
    if (p.weapon === 'nova') p.weapon = p.prevWeapon;
    this.novas.push({ x: p.x, y: p.y - 6, r: 0, hit: new Set() });
    this.shake = 7;
    this.novaFlash = 0.35;
    this.texts.push({ x: p.x, y: p.y - 24, text: 'NOVA!', t: 1, color: '#ffcd75' });
    this.burst(p.x, p.y - 6, 30, ['#ffcd75', '#73eff7', '#f4f4f4'], 120);
    sfx.nova();
  }

  private updateNovas(dt: number) {
    const p = this.player;
    const wasCooling = p.specialCd > 0;
    p.specialCd = Math.max(0, p.specialCd - dt);
    if (wasCooling && p.specialCd <= 0) {
      this.texts.push({ x: p.x, y: p.y - 24, text: 'NOVA READY', t: 1.2, color: '#ffcd75' });
      sfx.novaReady();
    }
    const dmg = (12 + this.wave) * this.dmgMul;
    for (const n of this.novas) {
      n.r += NOVA.speed * dt;
      for (const e of this.enemies) {
        if (!this.targetable(e) || n.hit.has(e)) continue;
        const dx = e.x - n.x;
        const dy = e.y - STATS[e.type].hy - n.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > n.r + STATS[e.type].r) continue;
        n.hit.add(e);
        this.hitEnemy(e, dmg, dx / d, dy / d, 3.5);
      }
      for (const b of this.bullets) {
        if (b.enemy && b.life > 0 && Math.hypot(b.x - n.x, b.y - n.y) < n.r) {
          b.life = 0;
          this.burst(b.x, b.y, 4, ['#ffcd75', '#f4f4f4'], 40);
        }
      }
    }
    this.novas = this.novas.filter((n) => n.r < NOVA.radius);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /** Returns whether the hit actually landed (so callers can add extra effects like rabies). */
  private hurtPlayer(dmg: number, dx: number, dy: number): boolean {
    const p = this.player;
    if (p.invuln > 0 || this.state !== 'playing') return false;
    dmg = Math.round(dmg * (1 + this.threat * 0.02));
    if (this.hero.id === 'achilles') {
      // Achilles shrugs off every hit... except the 1 in 10 that finds his heel, for half his max HP.
      if (Math.random() >= 0.1) {
        p.invuln = 0.4;
        this.texts.push({ x: p.x, y: p.y - 18, text: 'IMMUNE', t: 0.6, color: '#ffcd75' });
        this.burst(p.x, p.y - 6, 6, ['#ffcd75', '#f4f4f4'], 50);
        sfx.immune();
        return false;
      }
      dmg = Math.ceil(p.maxHp / 2);
      this.texts.push({ x: p.x, y: p.y - 28, text: 'HEEL!', t: 1.2, color: '#ff004d' });
    }
    p.hp -= dmg;
    p.invuln = 0.8;
    // The knight's armour means he barely gets knocked about.
    const kb = this.hero.id === 'knight' ? 60 : 160;
    p.kx += dx * kb;
    p.ky += dy * kb;
    this.shake = 5;
    this.hurtFlash = 0.18;
    this.texts.push({ x: p.x, y: p.y - 18, text: `-${dmg}`, t: 0.8, color: '#ff004d' });
    this.burst(p.x, p.y - 6, 8, ['#b13e53', '#ff004d'], 60);
    sfx.hurt();
    if (p.hp <= 0) this.playerDown();
    return true;
  }

  /** Out of HP: the phoenix brings you back once per run, otherwise it's game over. */
  private playerDown() {
    const p = this.player;
    const phoenix = this.pets.find((k) => k.kind === 'phoenix' && !k.spent);
    if (phoenix) {
      phoenix.spent = true;
      p.hp = Math.round(p.maxHp / 2);
      p.invuln = 2;
      p.poisonT = 0;
      p.glitchT = 0;
      this.shake = 6;
      this.novaFlash = 0.4;
      this.burst(p.x, p.y - 6, 40, ['#ffcd75', '#ef7d57', '#ff004d', '#f4f4f4'], 120);
      this.texts.push({ x: p.x, y: p.y - 30, text: 'REBORN!', t: 1.6, color: '#ffcd75' });
      sfx.rebirth();
      return;
    }
    p.hp = 0;
    this.state = 'dying';
    this.dyingT = 1.4;
    this.burst(p.x, p.y - 6, 30, ['#3b5dc9', '#94b0c2', '#b13e53'], 90);
    sfx.gameOver();
  }

  private spawnEnemy(type: EnemyType, x: number, y: number, summoned: boolean) {
    const st = STATS[type];
    const hp = Math.round(st.hp * (1 + (this.wave - 1) * 0.06) * (1 + this.threat * 0.05));
    if (isBoss(type)) this.bossMax += hp;
    this.enemies.push({
      type,
      x,
      y,
      kx: 0,
      ky: 0,
      hp,
      maxHp: hp,
      state: 'chase',
      t: 0,
      // Give the player a moment to take in the boss before it opens fire.
      atkCd: isBoss(type) ? 2.5 : rand(0.3, 1),
      flash: 0,
      face: 1,
      anim: Math.random(),
      aimX: 1,
      aimY: 0,
      combo: 0,
      loot: 0,
      slowT: 0,
      tx: x,
      ty: y,
      strafe: Math.random() < 0.5 ? -1 : 1,
      strafeT: rand(1, 3),
      fireCd: rand(1.2, 2.5),
      summonCd: rand(3.5, 6),
      summoned,
      dead: false,
    });
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    const speedMul = this.difficulty * (1 + this.threat * 0.01);
    for (const e of this.enemies) {
      const st = STATS[e.type];
      e.flash -= dt;
      e.atkCd -= dt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let mvx = 0;
      let mvy = 0;
      let spd = st.speed * speedMul * (e.slowT > 0 ? 0.5 : 1);
      e.slowT -= dt;

      if (e.type === 'sorcerer') {
        switch (e.state) {
          case 'chase': {
            if (d < 85) {
              mvx = -dx / d;
              mvy = -dy / d;
            } else if (d > 140) {
              mvx = dx / d;
              mvy = dy / d;
            } else {
              mvx = (-dy / d) * e.strafe;
              mvy = (dx / d) * e.strafe;
            }
            e.strafeT -= dt;
            if (e.strafeT <= 0) {
              e.strafe *= -1;
              e.strafeT = rand(1.5, 3);
            }
            e.fireCd -= dt;
            e.summonCd -= dt;
            if (e.summonCd <= 0 && this.enemies.length + this.portals.length < 20) {
              e.state = 'summon';
              e.t = 1;
              sfx.summon();
            } else if (e.fireCd <= 0 && d < 230) {
              e.state = 'cast';
              e.t = st.windup;
            }
            break;
          }
          case 'cast':
            e.t -= dt;
            if (e.t <= 0) {
              this.castFireball(e);
              e.fireCd = rand(1.8, 2.8) / speedMul;
              e.state = 'chase';
            }
            break;
          case 'summon':
            e.t -= dt;
            if (Math.random() < 0.6) {
              const a = rand(0, Math.PI * 2);
              this.particles.push({ x: e.x + Math.cos(a) * 12, y: e.y - 4 + Math.sin(a) * 6, vx: 0, vy: -25, life: 0.4, color: pick(['#8a3f9e', '#f5a3c7', '#5d275d']), size: 1, grav: 0, floor: 999 });
            }
            if (e.t <= 0) {
              const n = 1 + (Math.random() < 0.3 + this.wave * 0.05 ? 1 : 0);
              for (let k = 0; k < n; k++) {
                const a = rand(0, Math.PI * 2);
                this.portals.push({
                  x: clamp(e.x + Math.cos(a) * rand(14, 26), AR.x0, AR.x1),
                  y: clamp(e.y + Math.sin(a) * rand(10, 18), AR.y0, AR.y1),
                  t: 0.8,
                  type: pick<EnemyType>(this.wave >= 3 ? ['skeleton', 'skeleton', 'zombie', 'goblin'] : ['skeleton', 'zombie']),
                  summoned: true,
                });
              }
              e.summonCd = rand(7, 10);
              e.state = 'chase';
            }
            break;
          default:
            e.state = 'chase';
        }
        e.face = dx < 0 ? -1 : 1;
      } else if (e.type === 'eyeball') {
        [mvx, mvy] = this.aiEyeball(e, dx, dy, d, dt);
      } else if (e.type === 'bat') {
        [mvx, mvy] = this.aiBat(e, dx, dy, d, dt);
      } else if (e.type === 'bear') {
        [mvx, mvy] = this.aiBear(e, dx, dy, d, dt);
      } else if (e.type === 'worm') {
        [mvx, mvy] = this.aiWorm(e, dx, dy, d, dt);
      } else if (e.type === 'slime') {
        [mvx, mvy] = this.aiSlime(e, dx, dy, d, dt);
      } else if (e.type === 'dragon') {
        [mvx, mvy] = this.aiDragon(e, dx, dy, d, dt);
      } else if (e.type === 'reaper' && (e.state === 'chase' || e.state === 'phase')) {
        [mvx, mvy] = this.aiReaper(e, dx, dy, d, dt);
      } else if (e.type === 'glitch' && e.state !== 'windup' && e.state !== 'recover') {
        [mvx, mvy] = this.aiGlitch(e, dx, dy, d, dt);
      } else {
        // Melee: skeleton, zombie, goblin, troll, and the reaper or glitch once it's next to you.
        switch (e.state) {
          case 'chase':
            mvx = dx / d;
            mvy = dy / d;
            if (d < st.range + 6 && e.atkCd <= 0) this.startWindup(e, dx / d, dy / d);
            break;
          case 'windup':
            e.t -= dt;
            if (e.t <= 0) this.meleeStrike(e);
            break;
          case 'recover':
            e.t -= dt;
            mvx = dx / d;
            mvy = dy / d;
            spd *= 0.3;
            if (e.t <= 0) {
              e.state = 'chase';
              e.atkCd = e.type === 'reaper' ? rand(1.8, 3) : e.type === 'glitch' ? rand(1, 1.6) : 0.2;
              // A Glitch never sticks around after a slash.
              if (e.type === 'glitch') e.summonCd = 0;
            }
            break;
          case 'flee':
            // Goblins stab and run, then come back for more. One carrying your coins gets away for good.
            e.t -= dt;
            mvx = -dx / d;
            mvy = -dy / d;
            spd *= e.loot ? 1.25 : 1.1;
            if (e.t <= 0 && e.loot) {
              e.dead = true;
              this.burst(e.x, e.y - 6, 14, ['#ffcd75', '#a7f070', '#f4f4f4'], 50);
              this.texts.push({ x: e.x, y: e.y - 20, text: `ESCAPED WITH ${e.loot}`, t: 1.4, color: '#ff004d', icon: 'coin' });
              sfx.steal();
            } else if (e.t <= 0) {
              e.state = 'chase';
              e.atkCd = 0.2;
            }
            break;
          default:
            e.state = 'chase';
        }
        if (e.state === 'flee') e.face = dx < 0 ? 1 : -1;
        else if (e.state !== 'windup') e.face = dx < 0 ? -1 : 1;
      }

      e.x += mvx * spd * dt + e.kx * dt;
      e.y += mvy * spd * dt + e.ky * dt;
      e.kx *= Math.exp(-9 * dt);
      e.ky *= Math.exp(-9 * dt);
      // Flyers flap and float even when hovering still.
      if (e.type === 'dragon') e.anim += dt * 2;
      else if (e.type === 'reaper' || e.type === 'eyeball' || e.type === 'slime' || e.type === 'glitch') e.anim += dt;
      else if (e.type === 'bat') e.anim += dt * (e.state === 'windup' || e.state === 'screech' ? 3 : 1.6);
      else if (mvx || mvy) e.anim += dt * (e.type === 'zombie' ? 0.6 : 1);
    }

    // Keep enemies from stacking on top of each other (and the player).
    for (let a = 0; a < this.enemies.length; a++) {
      const e = this.enemies[a];
      for (let b = a + 1; b < this.enemies.length; b++) {
        const o = this.enemies[b];
        const dx = o.x - e.x;
        const dy = o.y - e.y;
        const min = STATS[e.type].r + STATS[o.type].r;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          e.x -= (dx / d) * push;
          e.y -= (dy / d) * push;
          o.x += (dx / d) * push;
          o.y += (dy / d) * push;
        }
      }
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      const min = STATS[e.type].r + 4;
      if (d > 0 && d < min && this.targetable(e)) {
        e.x += (dx / d) * (min - d);
        e.y += (dy / d) * (min - d);
      }
      // The boss is big: keep the whole eye inside the room and below the HUD.
      const big = e.type === 'eyeball' || e.type === 'bat';
      e.x = clamp(e.x, big ? 24 : AR.x0, big ? W - 24 : AR.x1);
      e.y = clamp(e.y, e.type === 'eyeball' ? 76 : e.type === 'bat' ? 66 : AR.y0, AR.y1);
    }
  }

  private startWindup(e: Enemy, ax: number, ay: number) {
    e.state = 'windup';
    e.t = STATS[e.type].windup;
    e.aimX = ax;
    e.aimY = ay;
    e.face = ax < 0 ? -1 : 1;
    if (e.type === 'troll') {
      // The slam lands a little in front of the troll; the warning circle shows exactly where.
      e.tx = clamp(e.x + ax * 14, AR.x0, AR.x1);
      e.ty = clamp(e.y + ay * 14, AR.y0, AR.y1);
    }
  }

  private meleeStrike(e: Enemy) {
    const p = this.player;
    const st = STATS[e.type];
    e.state = 'recover';
    e.t = st.recover;
    if (e.type === 'troll') {
      this.shocks.push({ x: e.tx, y: e.ty, t: 0.35 });
      this.shake = Math.max(this.shake, 6);
      this.burst(e.tx, e.ty - 2, 16, ['#8b5a3c', '#566c86', '#94b0c2'], 80);
      sfx.slam();
      // The danger zone is drawn squashed (floor perspective), so test against the same ellipse.
      const d = Math.hypot(p.x - e.tx, p.y - e.ty) || 1;
      if (Math.hypot(p.x - e.tx, (p.y - e.ty) / 0.6) < SLAM_R) this.hurtPlayer(st.dmg, (p.x - e.tx) / d, (p.y - e.ty) / d);
      return;
    }
    const ang = Math.atan2(e.aimY, e.aimX);
    const cy = e.y - st.hy;
    if (e.type === 'skeleton' || e.type === 'goblin') {
      const lunge = e.type === 'goblin' ? 230 : 150;
      e.kx += e.aimX * lunge;
      e.ky += e.aimY * lunge;
    }
    if (e.type === 'reaper') {
      // A wide double sweep of the scythe.
      this.slashes.push({ x: e.x + e.aimX * 8, y: cy + e.aimY * 8, ang, t: 0.2, color: '#8a3f9e', r: 17 });
      this.slashes.push({ x: e.x + e.aimX * 8, y: cy + e.aimY * 8, ang, t: 0.12, color: '#f4f4f4', r: 14 });
    } else if (e.type === 'glitch') {
      // An RGB-split slash.
      this.slashes.push({ x: e.x + e.aimX * 9 - 1, y: cy + e.aimY * 9, ang, t: 0.16, color: '#ff004d', r: 11 });
      this.slashes.push({ x: e.x + e.aimX * 9 + 1, y: cy + e.aimY * 9, ang, t: 0.16, color: '#73eff7', r: 11 });
    } else {
      const color = e.type === 'goblin' ? '#ffcd75' : e.type === 'zombie' ? '#a7f070' : '#f4f4f4';
      this.slashes.push({ x: e.x + e.aimX * 9, y: cy + e.aimY * 9, ang, t: 0.14, color, r: e.type === 'goblin' ? 6 : 8 });
    }
    if (e.type === 'goblin') sfx.stab();
    else if (e.type === 'glitch') sfx.glitch();
    else sfx.swing();
    const extra = e.type === 'skeleton' ? 10 : e.type === 'goblin' ? 12 : e.type === 'reaper' ? 8 : 6;
    const hit = p.invuln <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < st.range + extra;
    if (hit) this.hurtPlayer(st.dmg, e.aimX, e.aimY);
    if (e.type === 'goblin') {
      e.state = 'flee';
      e.t = rand(0.5, 0.8);
      // Goblins pick your pocket on a hit, then make a run for it. Kill them to get the coins back.
      const take = hit && !e.loot ? Math.min(this.coins, randInt(3, 6) + Math.floor(this.wave / 2)) : 0;
      if (take > 0) {
        this.coins -= take;
        e.loot = take;
        e.t = 3;
        this.texts.push({ x: p.x, y: p.y - 28, text: `-${take} STOLEN!`, t: 1.2, color: '#ff004d', icon: 'coin' });
        sfx.steal();
      }
    }
  }

  /** Reapers drift towards you, then fade out and reappear right behind you, scythe raised. */
  private aiReaper(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const st = STATS.reaper;
    const smoke = ['#333c57', '#8a3f9e', '#f4f4f4'];
    if (e.state === 'phase') {
      const before = e.t;
      e.t -= dt;
      if (before > PHASE / 2 && e.t <= PHASE / 2) {
        this.burst(e.x, e.y - st.hy, 10, smoke, 40);
        const a = Math.atan2(-p.aimY, -p.aimX) + rand(-0.8, 0.8);
        e.x = clamp(p.x + Math.cos(a) * 18, AR.x0, AR.x1);
        e.y = clamp(p.y + Math.sin(a) * 18, AR.y0, AR.y1);
        e.kx = 0;
        e.ky = 0;
        this.burst(e.x, e.y - st.hy, 10, smoke, 40);
        sfx.blink();
      }
      if (e.t <= 0) {
        const nd = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        this.startWindup(e, (p.x - e.x) / nd, (p.y - e.y) / nd);
      }
      return [0, 0];
    }
    e.face = dx < 0 ? -1 : 1;
    if (e.atkCd <= 0) {
      if (d < st.range + 6) {
        this.startWindup(e, dx / d, dy / d);
        return [0, 0];
      }
      if (d < 170) {
        e.state = 'phase';
        e.t = PHASE;
        this.burst(e.x, e.y - st.hy, 8, smoke, 30);
        sfx.blink();
        return [0, 0];
      }
    }
    return [dx / d, dy / d];
  }

  /**
   * The Glitch jitters around at mid range and warps somewhere else every couple of seconds (sometimes
   * right next to you, to slash). From range it fires bursts of pixel shards, or a slow corrupted
   * packet that freezes you in place for 3 seconds. `summonCd` doubles as the warp timer and `combo`
   * as the chosen ranged attack (0: shards, 1: packet).
   */
  private aiGlitch(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const st = STATS.glitch;
    const noise = ['#ff004d', '#73eff7', '#8a3f9e', '#f4f4f4'];
    if (e.state === 'warp') {
      const before = e.t;
      e.t -= dt;
      if (before > GLITCH.warp / 2 && e.t <= GLITCH.warp / 2) {
        this.burst(e.x, e.y - st.hy, 10, noise, 50);
        // Either right beside you (and straight into a slash) or somewhere across the room.
        const close = Math.random() < 0.4;
        const a = rand(0, Math.PI * 2);
        const r = close ? 16 : rand(60, 100);
        e.x = clamp(p.x + Math.cos(a) * r, AR.x0, AR.x1);
        e.y = clamp(p.y + Math.sin(a) * r * 0.7, AR.y0, AR.y1);
        e.kx = 0;
        e.ky = 0;
        if (close) e.atkCd = 0;
        this.burst(e.x, e.y - st.hy, 10, noise, 50);
        sfx.glitch();
      }
      if (e.t <= 0) {
        e.state = 'chase';
        e.summonCd = rand(1.8, 3);
      }
      return [0, 0];
    }
    if (e.state === 'cast') {
      e.t -= dt;
      e.face = dx < 0 ? -1 : 1;
      if (Math.random() < 0.6) this.particles.push({ x: e.x + rand(-7, 7), y: e.y - rand(4, 16), vx: rand(-20, 20), vy: 0, life: 0.15, color: pick(noise), size: 1, grav: 0, floor: 999 });
      if (e.t <= 0) {
        const ox = e.x + e.face * 6;
        const oy = e.y - st.hy;
        const base = Math.atan2(p.y - 6 - oy, p.x - ox);
        if (e.combo) {
          this.bullets.push({ x: ox, y: oy, vx: Math.cos(base) * GLITCH.packetSpeed, vy: Math.sin(base) * GLITCH.packetSpeed, r: 4, dmg: GLITCH.packetDmg, life: 3.5, enemy: true, packet: true });
        } else {
          for (const s of [-0.15, 0, 0.15]) {
            const v = 150 + this.wave * 3;
            this.bullets.push({ x: ox, y: oy, vx: Math.cos(base + s) * v, vy: Math.sin(base + s) * v, r: 2, dmg: GLITCH.shardDmg, life: 2, enemy: true, shard: true });
          }
        }
        sfx.glitch();
        e.state = 'chase';
        e.fireCd = rand(1.6, 2.6) / this.difficulty;
      }
      return [0, 0];
    }
    e.state = 'chase';
    e.face = dx < 0 ? -1 : 1;
    e.summonCd -= dt;
    e.fireCd -= dt;
    if (e.atkCd <= 0 && d < st.range + 6) {
      this.startWindup(e, dx / d, dy / d);
      return [0, 0];
    }
    if (e.summonCd <= 0) {
      e.state = 'warp';
      e.t = GLITCH.warp;
      this.burst(e.x, e.y - st.hy, 6, noise, 30);
      return [0, 0];
    }
    if (e.fireCd <= 0 && d < 200) {
      e.state = 'cast';
      e.t = 0.5;
      // Only lob a packet when you aren't already frozen.
      e.combo = p.glitchT <= 0 && Math.random() < 0.45 ? 1 : 0;
      return [0, 0];
    }
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafe *= -1;
      e.strafeT = rand(0.4, 1.2);
    }
    if (d < 50) return [-dx / d, -dy / d];
    if (d > 110) return [dx / d, dy / d];
    return [(-dy / d) * e.strafe, (dx / d) * e.strafe];
  }

  /** A Glitch packet hit: frozen to the spot for a few seconds. */
  private glitchPlayer() {
    const p = this.player;
    if (p.glitchT <= 0) this.texts.push({ x: p.x, y: p.y - 38, text: 'GL1TCHED!', t: 1.2, color: '#73eff7' });
    p.glitchT = GLITCH.freeze;
    p.dashT = 0;
    this.burst(p.x, p.y - 6, 14, ['#ff004d', '#73eff7', '#8a3f9e'], 60);
    sfx.glitch();
  }

  /** Boss hits are sponsored too. */
  private bossHitAd(src: EnemyType) {
    const p = this.player;
    this.texts.push({ x: p.x, y: p.y - 28, text: 'AD BREAK!', t: 1, color: '#ff004d' });
    this.adTimers.push({ t: 0.25, src });
  }

  /**
   * Bat twins: flutter around you erratically, then either screech (a fan of sound waves) or
   * swoop: hover, lock on, and dive straight through where you were. The last bat standing gets angry.
   */
  private aiBat(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const enraged = e.hp < e.maxHp / 2 || this.enemies.filter((o) => o.type === 'bat' && !o.dead).length === 1;
    switch (e.state) {
      case 'windup':
        // Hovers and shrieks, tracking you until just before the dive.
        e.t -= dt;
        e.face = dx < 0 ? -1 : 1;
        if (e.t > 0.15) {
          e.aimX = dx / d;
          e.aimY = dy / d;
        }
        if (e.t <= 0) {
          e.state = 'swoop';
          e.t = BAT.swoop;
        }
        return [0, 0];
      case 'swoop': {
        e.t -= dt;
        if (Math.random() < 0.7) this.particles.push({ x: e.x + rand(-6, 6), y: e.y - 8, vx: 0, vy: 0, life: 0.25, color: pick(['#5d275d', '#8a3f9e']), size: 2, grav: 0, floor: 999 });
        if (p.invuln <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < 14) {
          this.hurtPlayer(STATS.bat.dmg, e.aimX, e.aimY);
          this.bossHitAd('bat');
        }
        if (e.t <= 0) {
          e.state = 'recover';
          e.t = STATS.bat.recover;
        }
        const k = (BAT.swoopSpeed * (enraged ? 1.15 : 1)) / STATS.bat.speed;
        return [e.aimX * k, e.aimY * k];
      }
      case 'screech':
        e.t -= dt;
        if (e.t <= 0) {
          const base = Math.atan2(dy, dx);
          const n = enraged ? 7 : 5;
          for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * 0.22;
            this.bullets.push({ x: e.x, y: e.y - 18, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, r: 4, dmg: BAT.sonicDmg, life: 3, enemy: true, sonic: true });
          }
          e.state = 'chase';
          e.atkCd = enraged ? rand(0.8, 1.3) : rand(1.6, 2.6);
        }
        return [0, 0];
      case 'recover':
        e.t -= dt;
        if (e.t <= 0) {
          e.state = 'chase';
          e.atkCd = enraged ? rand(0.8, 1.3) : rand(1.6, 2.6);
        }
        return [0, 0];
      default: {
        e.state = 'chase';
        e.face = dx < 0 ? -1 : 1;
        if (e.atkCd <= 0) {
          if (Math.random() < 0.65) {
            e.state = 'windup';
            e.t = STATS.bat.windup;
          } else {
            e.state = 'screech';
            e.t = 0.6;
          }
          sfx.screech();
          return [0, 0];
        }
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafe *= -1;
          e.strafeT = rand(0.6, 1.6);
        }
        // Circle at 60-100px with a jittery wobble.
        const radial = d < 60 ? -1 : d > 100 ? 1 : 0;
        const wob = Math.sin(this.time * 7 + e.x) * 0.6;
        const m = enraged ? 1.4 : 1;
        return [((dx / d) * radial + (-dy / d) * e.strafe + wob) * m, ((dy / d) * radial + (dx / d) * e.strafe) * m];
      }
    }
  }

  /**
   * Rabid bear: lumbers after you foaming at the mouth. Up close it mauls (three quick swipes); from
   * range it paws the ground and charges in a straight line, stunning itself if it hits a wall.
   * Every hit gives you rabies.
   */
  private aiBear(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const st = STATS.bear;
    const enraged = e.hp < e.maxHp / 2;
    const bite = (dmg: number, ax: number, ay: number) => {
      if (p.invuln > 0) return;
      if (this.hurtPlayer(dmg, ax, ay)) {
        p.poisonT = BEAR.rabies;
        p.poisonName = 'RABIES';
        this.texts.push({ x: p.x, y: p.y - 38, text: 'RABIES!', t: 1.2, color: '#a7f070' });
      }
      this.bossHitAd('bear');
    };
    if (Math.random() < 0.15) {
      this.particles.push({ x: e.x + e.face * 10, y: e.y - 10, vx: e.face * rand(5, 20), vy: 0, life: 0.6, color: pick(['#f4f4f4', '#a7f070']), size: 1, grav: 120, floor: e.y });
    }
    switch (e.state) {
      case 'windup':
        // Pawing the ground before a charge.
        e.t -= dt;
        if (e.t > 0.25) {
          e.aimX = dx / d;
          e.aimY = dy / d;
          e.face = dx < 0 ? -1 : 1;
        }
        if (Math.random() < 0.4) this.particles.push({ x: e.x - e.face * 6, y: e.y, vx: -e.face * rand(20, 50), vy: rand(-30, -10), life: 0.4, color: '#8b5a3c', size: 1, grav: 150, floor: e.y + 1 });
        if (e.t <= 0) {
          e.state = 'charge';
          e.t = BEAR.charge;
          sfx.roar();
        }
        return [0, 0];
      case 'charge': {
        e.t -= dt;
        if (Math.random() < 0.6) this.particles.push({ x: e.x - e.aimX * 8, y: e.y, vx: 0, vy: -10, life: 0.3, color: '#566c86', size: 2, grav: 0, floor: 999 });
        if (p.invuln <= 0 && Math.hypot(p.x - e.x, p.y - e.y) < 18) bite(st.dmg, e.aimX, e.aimY);
        const wall = e.x <= AR.x0 + 1 || e.x >= AR.x1 - 1 || e.y <= AR.y0 + 1 || e.y >= AR.y1 - 1;
        if (wall && e.t < BEAR.charge - 0.1) {
          e.state = 'stun';
          e.t = BEAR.stun;
          this.shake = Math.max(this.shake, 6);
          this.burst(e.x + e.aimX * 10, e.y - 8, 14, ['#94b0c2', '#566c86', '#f4f4f4'], 70);
          sfx.slam();
          return [0, 0];
        }
        if (e.t <= 0) {
          e.state = 'recover';
          e.t = st.recover;
        }
        const k = (BEAR.chargeSpeed * (enraged ? 1.2 : 1)) / st.speed;
        return [e.aimX * k, e.aimY * k];
      }
      case 'stun':
        e.t -= dt;
        if (e.t <= 0) {
          e.state = 'chase';
          e.atkCd = 0.8;
        }
        return [0, 0];
      case 'maul':
        e.t -= dt;
        if (e.t <= 0) {
          e.aimX = dx / d;
          e.aimY = dy / d;
          e.face = dx < 0 ? -1 : 1;
          const cy = e.y - st.hy;
          this.slashes.push({ x: e.x + e.aimX * 12, y: cy + e.aimY * 12, ang: Math.atan2(e.aimY, e.aimX) + (e.combo % 2 ? 0.4 : -0.4), t: 0.14, color: '#f4f4f4', r: 11 });
          sfx.swing();
          if (d < 28) bite(BEAR.swipeDmg, e.aimX, e.aimY);
          e.combo++;
          e.t = BEAR.swipe;
          if (e.combo >= 3) {
            e.state = 'recover';
            e.t = st.recover;
          }
        }
        return [(dx / d) * 0.3, (dy / d) * 0.3];
      case 'recover':
        e.t -= dt;
        if (e.t <= 0) {
          e.state = 'chase';
          e.atkCd = enraged ? rand(0.6, 1) : rand(1.2, 1.8);
        }
        return [0, 0];
      default: {
        e.state = 'chase';
        e.face = dx < 0 ? -1 : 1;
        if (e.atkCd <= 0 && d < st.range) {
          e.state = 'maul';
          e.combo = 0;
          e.t = 0.3;
          sfx.roar();
          return [0, 0];
        }
        if (e.atkCd <= 0 && d > 60) {
          e.state = 'windup';
          e.t = st.windup;
          return [0, 0];
        }
        const m = enraged ? 1.35 : 1;
        return [(dx / d) * m, (dy / d) * m];
      }
    }
  }

  /**
   * Sandworm: tunnels towards you as a mound of sand (can't be hit), locks onto where you're standing,
   * rumbles, then bursts out of the ground there. It stays up for a moment (spits sand at you, and can
   * be hit), then dives back down.
   */
  private aiWorm(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const st = STATS.worm;
    switch (e.state) {
      case 'windup': {
        e.t -= dt;
        if (Math.random() < 0.6) this.particles.push({ x: e.tx + rand(-8, 8), y: e.ty, vx: rand(-15, 15), vy: rand(-50, -20), life: 0.4, color: pick(['#bf9562', '#7a5636']), size: 1, grav: 200, floor: e.ty + 1 });
        if (e.t <= 0) {
          e.x = e.tx;
          e.y = e.ty;
          e.state = 'surface';
          e.t = WORM.up;
          e.combo = 0;
          this.shake = Math.max(this.shake, 3);
          this.burst(e.x, e.y - 4, 16, ['#bf9562', '#7a5636', '#ef7d57'], 80);
          sfx.slam();
          const pd = Math.hypot(p.x - e.x, p.y - e.y);
          if (pd < 16) this.hurtPlayer(st.dmg, (p.x - e.x) / (pd || 1), (p.y - e.y) / (pd || 1));
        }
        // Slides under the marked spot while it rumbles.
        const tdx = e.tx - e.x;
        const tdy = e.ty - e.y;
        const td = Math.hypot(tdx, tdy);
        return td > 2 ? [(tdx / td) * 1.5, (tdy / td) * 1.5] : [0, 0];
      }
      case 'surface':
        e.t -= dt;
        e.face = dx < 0 ? -1 : 1;
        if (!e.combo && e.t < WORM.up - 0.6) {
          e.combo = 1;
          this.bullets.push({ x: e.x, y: e.y - 14, vx: (dx / d) * 110, vy: ((dy + 8) / d) * 110, r: 3, dmg: WORM.spitDmg, life: 2, enemy: true, sand: true });
          sfx.toss();
        }
        if (e.t <= 0) {
          e.state = 'burrow';
          e.atkCd = rand(1.2, 2.2);
          this.burst(e.x, e.y - 2, 10, ['#bf9562', '#7a5636'], 50);
        }
        return [0, 0];
      default:
        e.state = 'burrow';
        if (Math.random() < 0.3) this.particles.push({ x: e.x + rand(-5, 5), y: e.y, vx: 0, vy: -10, life: 0.4, color: '#bf9562', size: 1, grav: 60, floor: e.y + 1 });
        if (e.atkCd <= 0 && d < 30) {
          e.state = 'windup';
          e.t = st.windup;
          e.tx = p.x;
          e.ty = p.y;
          return [0, 0];
        }
        return [dx / d, dy / d];
    }
  }

  /** Slimes hop towards you, keeping a little distance, and lob arcing poison blobs that leave puddles. */
  private aiSlime(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const st = STATS.slime;
    switch (e.state) {
      case 'windup':
        e.t -= dt;
        if (e.t <= 0) {
          // Aim a little ahead of where you're running.
          const tx = clamp(p.x + p.kx * 0.1, AR.x0, AR.x1);
          const ty = clamp(p.y + p.ky * 0.1, AR.y0, AR.y1);
          this.bullets.push({ x: e.x, y: e.y, vx: (tx - e.x) / BLOB.flight, vy: (ty - e.y) / BLOB.flight, r: 3, dmg: st.dmg, life: BLOB.flight, enemy: true, blob: true });
          sfx.toss();
          e.state = 'recover';
          e.t = st.recover;
        }
        return [0, 0];
      case 'recover':
        e.t -= dt;
        if (e.t <= 0) {
          e.state = 'chase';
          e.fireCd = rand(2, 3.2) / this.difficulty;
        }
        return [0, 0];
      default: {
        e.state = 'chase';
        e.face = dx < 0 ? -1 : 1;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && d < 150) {
          e.state = 'windup';
          e.t = st.windup;
          return [0, 0];
        }
        // Only moves during the airborne half of each hop.
        if (e.anim % 0.8 >= 0.4) return [0, 0];
        const away = d < 50 ? -1 : 1;
        return [(dx / d) * away * 1.6, (dy / d) * away * 1.6];
      }
    }
  }

  private slimeFrame(e: Enemy) {
    if (e.state === 'windup') return 0;
    return e.state === 'chase' && e.anim % 0.8 < 0.4 ? 0 : 1;
  }

  /** A slime blob hits the ground: a direct hit hurts, and it leaves a poison puddle either way. */
  private landBlob(b: Bullet) {
    const p = this.player;
    b.life = 0;
    this.puddles.push({ x: b.x, y: b.y, t: BLOB.puddle });
    this.burst(b.x, b.y - 2, 8, ['#8a3f9e', '#a7f070', '#5d275d'], 50);
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < 10) this.hurtPlayer(b.dmg, (p.x - b.x) / (d || 1), (p.y - b.y) / (d || 1));
  }


  /** Where a baby dragon's flames come out. */
  private dragonMouth(e: Enemy) {
    return { x: e.x + e.face * 7, y: e.y - 8 - this.lift(e) };
  }

  /** Baby dragons hover at mid range, breathe in, then breathe a stream of fire that slowly tracks you. */
  private aiDragon(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const st = STATS.dragon;
    const m = this.dragonMouth(e);
    switch (e.state) {
      case 'windup':
        e.t -= dt;
        // Embers get sucked into its mouth.
        if (Math.random() < 0.7) {
          const a = rand(0, Math.PI * 2);
          this.particles.push({ x: m.x + Math.cos(a) * 10, y: m.y + Math.sin(a) * 8, vx: -Math.cos(a) * 40, vy: -Math.sin(a) * 32, life: 0.25, color: pick(['#ef7d57', '#ffcd75']), size: 1, grav: 0, floor: 999 });
        }
        if (e.t <= 0) {
          e.state = 'breathe';
          e.t = BREATH;
          e.fireCd = 0;
          sfx.breath();
        }
        return [0, 0];
      case 'breathe': {
        e.t -= dt;
        // Turns towards you, but slowly enough that you can run around it.
        const cur = Math.atan2(e.aimY, e.aimX);
        let da = Math.atan2(p.y - 6 - m.y, p.x - m.x) - cur;
        if (da > Math.PI) da -= Math.PI * 2;
        if (da < -Math.PI) da += Math.PI * 2;
        const ang = cur + clamp(da, -1.3 * dt, 1.3 * dt);
        e.aimX = Math.cos(ang);
        e.aimY = Math.sin(ang);
        e.face = e.aimX < 0 ? -1 : 1;
        // fireCd doubles as the flame emitter's timer while breathing.
        e.fireCd -= dt;
        while (e.fireCd <= 0) {
          e.fireCd += 0.03;
          const a = ang + rand(-0.2, 0.2);
          const v = rand(150, 180);
          this.bullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2, dmg: st.dmg, life: rand(0.38, 0.46), enemy: true, flame: true });
        }
        if (e.t <= 0) {
          e.state = 'recover';
          e.t = st.recover;
        }
        return [0, 0];
      }
      case 'recover':
        e.t -= dt;
        if (e.t <= 0) {
          e.state = 'chase';
          e.fireCd = rand(2, 3) / this.difficulty;
        }
        return [0, 0];
      default: {
        e.state = 'chase';
        e.face = dx < 0 ? -1 : 1;
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafe *= -1;
          e.strafeT = rand(1, 2.5);
        }
        e.fireCd -= dt;
        if (e.fireCd <= 0 && d < 85) {
          this.startWindup(e, dx / d, dy / d);
          sfx.inhale();
        }
        if (d < 40) return [-dx / d, -dy / d];
        if (d > 70) return [dx / d, dy / d];
        return [(-dy / d) * e.strafe, (dx / d) * e.strafe];
      }
    }
  }

  /** How high a flyer floats above its shadow. */
  private lift(e: Enemy) {
    if (e.type === 'dragon') return 5 + Math.round(Math.sin(e.anim * 2.5) * 1.5);
    if (e.type === 'reaper') return 2 + Math.round(Math.sin(e.anim * 3));
    if (e.type === 'eyeball') return 10 + Math.round(Math.sin(e.anim * 2) * 2);
    if (e.type === 'slime') {
      const h = e.anim % 0.8;
      return e.state === 'chase' && h < 0.4 ? Math.round(Math.sin((h / 0.4) * Math.PI) * 4) : 0;
    }
    if (e.type === 'bat') return e.state === 'swoop' ? 4 : 14 + Math.round(Math.sin(e.anim * 4) * 3);
    return 0;
  }

  /** The middle of the boss's eye, in whole pixels so the iris lines up with the sprite. */
  private eyeCentre(e: Enemy) {
    return { x: Math.round(e.x - 16) + 16, y: Math.round(e.y - this.lift(e) - 31) + 16 };
  }

  /** Where the laser starts: the front of the iris. */
  private beamOrigin(e: Enemy) {
    const c = this.eyeCentre(e);
    return { x: c.x + e.aimX * 7, y: c.y + e.aimY * 7 };
  }

  /** How far the laser reaches before it hits a wall. */
  private beamLength(e: Enemy) {
    const o = this.beamOrigin(e);
    const tx = e.aimX > 0 ? (W - 6 - o.x) / e.aimX : e.aimX < 0 ? (6 - o.x) / e.aimX : Infinity;
    const ty = e.aimY > 0 ? (H - 4 - o.y) / e.aimY : e.aimY < 0 ? (30 - o.y) / e.aimY : Infinity;
    return Math.max(0, Math.min(tx, ty));
  }

  private aimAtPlayer(e: Enemy) {
    const p = this.player;
    const o = this.eyeCentre(e);
    const d = Math.hypot(p.x - o.x, p.y - 6 - o.y) || 1;
    e.aimX = (p.x - o.x) / d;
    e.aimY = (p.y - 6 - o.y) / d;
  }

  /**
   * The boss. Drifts around at range, then either charges a laser (a tracking dotted sight that locks
   * and flashes before the beam fires) or cries a ring of tears. Below half HP it gets angry: faster,
   * shorter aim, the beam sweeps after you, and bigger tear rings. Every laser hit pops up an ad.
   */
  private aiEyeball(e: Enemy, dx: number, dy: number, d: number, dt: number): [number, number] {
    const p = this.player;
    const enraged = e.hp < e.maxHp / 2;
    e.face = 1;
    switch (e.state) {
      case 'aim': {
        const before = e.t;
        e.t -= dt;
        if (e.t > EYE.lock) this.aimAtPlayer(e);
        else if (before > EYE.lock) sfx.lock();
        if (e.t <= 0) {
          e.state = 'laser';
          e.t = enraged ? EYE.beamEnraged : EYE.beam;
          this.shake = Math.max(this.shake, 3);
          sfx.laser();
        }
        return [0, 0];
      }
      case 'laser': {
        e.t -= dt;
        if (enraged) {
          // Sweeps after you, a little slower than you can run.
          const cur = Math.atan2(e.aimY, e.aimX);
          const o = this.eyeCentre(e);
          let da = Math.atan2(p.y - 6 - o.y, p.x - o.x) - cur;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          const ang = cur + clamp(da, -0.9 * dt, 0.9 * dt);
          e.aimX = Math.cos(ang);
          e.aimY = Math.sin(ang);
        }
        const o = this.beamOrigin(e);
        const len = this.beamLength(e);
        // Sparks where the beam hits the wall.
        if (Math.random() < 0.8) {
          this.particles.push({ x: o.x + e.aimX * len, y: o.y + e.aimY * len, vx: rand(-50, 50), vy: rand(-60, 10), life: 0.3, color: pick(['#ff004d', '#ffcd75', '#f4f4f4']), size: 1, grav: 200, floor: 999 });
        }
        const qx = p.x - o.x;
        const qy = p.y - 6 - o.y;
        const along = qx * e.aimX + qy * e.aimY;
        const off = Math.abs(qx * e.aimY - qy * e.aimX);
        if (p.invuln <= 0 && this.state === 'playing' && along > 0 && along < len && off < 6) {
          this.hurtPlayer(STATS.eyeball.dmg, e.aimX, e.aimY);
          // The premise, turned up: getting lasered is also sponsored.
          this.texts.push({ x: p.x, y: p.y - 28, text: 'AD BREAK!', t: 1, color: '#ff004d' });
          this.adTimers.push({ t: 0.25, src: 'eyeball' });
        }
        if (e.t <= 0) {
          e.state = 'chase';
          e.atkCd = enraged ? rand(1, 1.6) : rand(1.6, 2.4);
        }
        return [0, 0];
      }
      case 'tears':
        e.t -= dt;
        if (Math.random() < 0.5) {
          const c = this.eyeCentre(e);
          this.particles.push({ x: c.x + rand(-8, 8), y: c.y + 10, vx: 0, vy: 10, life: 0.4, color: '#73eff7', size: 1, grav: 120, floor: e.y });
        }
        if (e.t <= 0) {
          const c = this.eyeCentre(e);
          const n = enraged ? 14 : 10;
          const off = rand(0, Math.PI * 2);
          const speed = 70 + this.wave * 2;
          for (let k = 0; k < n; k++) {
            const a = off + (k * Math.PI * 2) / n;
            this.bullets.push({ x: c.x + Math.cos(a) * 14, y: c.y + Math.sin(a) * 14, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 3, dmg: EYE.tearDmg, life: 4, enemy: true, tear: true });
          }
          sfx.tears();
          e.state = 'chase';
          e.atkCd = enraged ? rand(0.8, 1.3) : rand(1.4, 2);
        }
        return [0, 0];
      default: {
        e.state = 'chase';
        if (e.atkCd <= 0) {
          if (Math.random() < 0.6) {
            e.state = 'aim';
            e.t = enraged ? EYE.aimEnraged : EYE.aim;
            this.aimAtPlayer(e);
            sfx.charge();
          } else {
            e.state = 'tears';
            e.t = STATS.eyeball.windup;
          }
          return [0, 0];
        }
        e.strafeT -= dt;
        if (e.strafeT <= 0) {
          e.strafe *= -1;
          e.strafeT = rand(1.5, 3);
        }
        const m = enraged ? 1.5 : 1;
        if (d < 70) return [(-dx / d) * m, (-dy / d) * m];
        if (d > 120) return [(dx / d) * m, (dy / d) * m];
        return [(-dy / d) * e.strafe * m, (dx / d) * e.strafe * m];
      }
    }
  }

  private castFireball(e: Enemy) {
    const p = this.player;
    const ox = e.x + e.face * 7;
    const oy = e.y - 17;
    const base = Math.atan2(p.y - 6 - oy, p.x - ox);
    const spread = this.wave >= 4 ? [-0.25, 0, 0.25] : [0];
    const speed = 80 + this.wave * 3;
    for (const s of spread) {
      this.bullets.push({ x: ox, y: oy, vx: Math.cos(base + s) * speed, vy: Math.sin(base + s) * speed, r: 3, dmg: STATS.sorcerer.dmg, life: 4, enemy: true });
    }
    sfx.fireball();
  }

  private updateBullets(dt: number) {
    const p = this.player;
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.blob) {
        if (b.life <= 0) this.landBlob(b);
        continue;
      }
      if (b.homing) {
        const t = this.nearestEnemy(b.x, b.y + 6, 160);
        if (t) {
          const cur = Math.atan2(b.vy, b.vx);
          let da = Math.atan2(t.y - STATS[t.type].hy - b.y, t.x - b.x) - cur;
          if (da > Math.PI) da -= Math.PI * 2;
          if (da < -Math.PI) da += Math.PI * 2;
          const ang = cur + clamp(da, -5 * dt, 5 * dt);
          const v = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(ang) * v;
          b.vy = Math.sin(ang) * v;
        }
        if (Math.random() < 0.6) this.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, color: pick(['#ffcd75', '#ef7d57']), size: 1, grav: 0, floor: 999 });
      }
      if (b.bomb) {
        b.vx *= Math.exp(-3 * dt);
        b.vy *= Math.exp(-3 * dt);
        if (b.life <= 0) {
          this.explode(b);
          continue;
        }
      }
      if (b.x < 6 || b.x > W - 6 || b.y < 30 || b.y > H - 4) {
        b.life = 0;
        if (b.bomb) {
          this.explode(b);
          continue;
        }
        if (b.sonic) this.burst(b.x, b.y, 3, ['#f5a3c7', '#8a3f9e'], 30);
        else if (b.sand) this.burst(b.x, b.y, 3, ['#bf9562', '#7a5636'], 30);
        else if (b.shard || b.packet) this.burst(b.x, b.y, 4, ['#ff004d', '#73eff7', '#8a3f9e'], 30);
        else if (!b.flame) this.burst(b.x, b.y, 4, b.tear ? ['#3b5dc9', '#73eff7'] : b.enemy ? ['#ef7d57', '#ffcd75'] : ['#41a6f6', '#73eff7'], 30);
        continue;
      }
      if (b.enemy) {
        if ((b.shard || b.packet) && Math.random() < 0.5) this.particles.push({ x: b.x + rand(-3, 3), y: b.y + rand(-3, 3), vx: 0, vy: 0, life: 0.15, color: pick(['#ff004d', '#73eff7', '#8a3f9e']), size: 1, grav: 0, floor: 999 });
        else if (!b.flame && !b.sonic && !b.sand && !b.shard && !b.packet && Math.random() < 0.5) this.particles.push({ x: b.x, y: b.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.25, color: pick(b.tear ? ['#3b5dc9', '#73eff7', '#29366f'] : ['#ef7d57', '#ffcd75', '#b13e53']), size: 1, grav: 0, floor: 999 });
        if (p.invuln <= 0 && Math.hypot(b.x - p.x, b.y - (p.y - 6)) < b.r + 4) {
          b.life = 0;
          const d = Math.hypot(b.vx, b.vy) || 1;
          if (this.hurtPlayer(b.dmg, b.vx / d, b.vy / d) && b.packet) this.glitchPlayer();
        }
      } else {
        for (const e of this.enemies) {
          if (!this.targetable(e) || b.hits?.has(e)) continue;
          if (Math.hypot(b.x - e.x, b.y - (e.y - STATS[e.type].hy)) < STATS[e.type].r + b.r + 1) {
            if (b.pierce && b.hits) {
              b.pierce--;
              b.hits.add(e);
              const d = Math.hypot(b.vx, b.vy) || 1;
              this.hitEnemy(e, b.dmg, b.vx / d, b.vy / d);
              break;
            }
            b.life = 0;
            if (b.bomb) {
              this.explode(b);
              break;
            }
            const d = Math.hypot(b.vx, b.vy) || 1;
            // Pet dragon flames come in a stream, so each one only nudges.
            this.hitEnemy(e, b.dmg, b.vx / d, b.vy / d, b.flame ? 0.15 : 1);
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private explode(b: Bullet) {
    b.life = 0;
    for (const e of this.enemies) {
      if (!this.targetable(e)) continue;
      const dx = e.x - b.x;
      const dy = e.y - STATS[e.type].hy - b.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < BOMB.radius + STATS[e.type].r) this.hitEnemy(e, b.dmg, dx / d, dy / d, 2);
    }
    this.burst(b.x, b.y, 24, ['#ffcd75', '#ef7d57', '#b13e53', '#f4f4f4'], 110);
    this.shake = Math.max(this.shake, 4);
    sfx.boom();
  }

  /** Phased-out reapers, warping glitches and burrowed sandworms can't be hit. */
  private targetable(e: Enemy) {
    return !e.dead && e.state !== 'phase' && e.state !== 'warp' && !(e.type === 'worm' && e.state !== 'surface');
  }

  private hitEnemy(e: Enemy, dmg: number, dx: number, dy: number, kbMul = 1) {
    e.hp -= dmg;
    e.flash = 0.1;
    const kb = STATS[e.type].kb * kbMul;
    e.kx += dx * kb;
    e.ky += dy * kb;
    this.burst(e.x, e.y - STATS[e.type].hy, 3, ['#f4f4f4', '#ffcd75'], 40);
    sfx.hit();
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    const points = Math.round(STATS[e.type].score * (e.summoned ? 0.5 : 1) * (1 + (this.wave - 1) * 0.1));
    this.score += points;
    this.kills++;
    this.texts.push({ x: e.x, y: e.y - 18, text: `${points}`, t: 0.8, color: '#ffcd75' });
    const [lo, hi] = COINS[e.type];
    const coins = (e.summoned ? Math.ceil(randInt(lo, hi) / 2) : randInt(lo, hi)) + e.loot;
    this.coins += coins;
    this.texts.push({ x: e.x, y: e.y - 28, text: e.loot ? `+${coins} GOT IT BACK` : `+${coins}`, t: 1, color: '#ffcd75', icon: 'coin' });
    sfx.coin();
    // Gems are rare: bosses always drop some, anything else has a 3% chance.
    const gems = GEMS[e.type] ?? (Math.random() < 0.03 ? 1 : 0);
    if (gems) this.addGems(gems, e.x, e.y - 38);
    this.decals.push({ x: e.x, y: e.y, type: e.type, t: 8 });
    const colors: Record<EnemyType, string[]> = {
      skeleton: ['#f4f4f4', '#d8cfb4', '#94b0c2'],
      zombie: ['#38b764', '#257179', '#a7f070', '#8b5a3c'],
      sorcerer: ['#8a3f9e', '#5d275d', '#ffcd75', '#f5a3c7'],
      goblin: ['#a7f070', '#38b764', '#8b5a3c'],
      troll: ['#94b0c2', '#566c86', '#333c57', '#8b5a3c'],
      reaper: ['#333c57', '#1a1c2c', '#f4f4f4', '#ff004d'],
      glitch: ['#ff004d', '#73eff7', '#8a3f9e', '#1a1c2c'],
      dragon: ['#b13e53', '#ef7d57', '#ffcd75', '#8a3f9e'],
      eyeball: ['#f4f4f4', '#b13e53', '#ff004d', '#3b5dc9'],
      bat: ['#5d275d', '#8a3f9e', '#1a1c2c', '#ff004d'],
      bear: ['#8b5a3c', '#5d275d', '#a7f070', '#f4f4f4'],
      worm: ['#ef7d57', '#8b5a3c', '#ffcd75'],
      slime: ['#a7f070', '#38b764', '#257179'],
    };
    const boss = isBoss(e.type);
    if (boss) {
      this.shake = 10;
      this.novaFlash = 0.4;
      this.bullets = this.bullets.filter((b) => !b.enemy);
      sfx.bossDie();
    }
    for (let k = 0; k < (boss ? 70 : 16); k++) {
      this.particles.push({
        x: e.x + (boss ? rand(-14, 14) : rand(-3, 3)),
        y: e.y - rand(2, 12) - (boss ? 12 : 0),
        vx: rand(-60, 60),
        vy: rand(-90, -20),
        life: rand(0.4, 0.9),
        color: pick(colors[e.type]),
        size: e.type === 'skeleton' || e.type === 'troll' ? 2 : 1 + Math.round(Math.random()),
        // Magic folk drift upwards as they go.
        grav: e.type === 'sorcerer' || e.type === 'reaper' ? -40 : 260,
        floor: e.y + rand(-2, 3),
      });
    }
    if (Math.random() < STATS[e.type].drop) this.pickups.push({ x: e.x, y: e.y, t: 10 });
    this.shake = Math.max(this.shake, 2);
    sfx.die();
    // The premise: kills are monetised (a quarter of the time). A short delay lets the kill land first.
    // Bosses always pay out.
    if (boss || Math.random() < 0.25) this.adTimers.push({ t: 0.35, src: e.type });
  }

  private updatePortals(dt: number) {
    for (const pt of this.portals) {
      pt.t -= dt;
      if (pt.t <= 0) {
        this.spawnEnemy(pt.type, pt.x, pt.y, pt.summoned);
        this.burst(pt.x, pt.y - 6, 10, pt.summoned ? ['#8a3f9e', '#f5a3c7'] : ['#b13e53', '#ef7d57'], 50);
      }
    }
    this.portals = this.portals.filter((pt) => pt.t > 0);
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const pd of this.puddles) {
      pd.t -= dt;
      if (Math.hypot(p.x - pd.x, (p.y - pd.y) * 2) < 12 && p.invuln <= 0) {
        if (p.poisonT <= 0) this.texts.push({ x: p.x, y: p.y - 28, text: 'POISONED!', t: 0.8, color: '#a7f070' });
        p.poisonT = Math.max(p.poisonT, 1.5);
        p.poisonName = 'POISON';
      }
    }
    this.puddles = this.puddles.filter((pd) => pd.t > 0);
    for (const k of this.pickups) {
      k.t -= dt;
      if (Math.hypot(k.x - p.x, k.y - p.y) < 10 && p.hp < p.maxHp) {
        k.t = 0;
        const heal = Math.min(20, p.maxHp - p.hp);
        p.hp += heal;
        this.texts.push({ x: p.x, y: p.y - 18, text: `+${heal}`, t: 0.8, color: '#a7f070' });
        sfx.pickup();
      }
    }
    this.pickups = this.pickups.filter((k) => k.t > 0);
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.y > pt.floor && pt.vy > 0) {
        pt.y = pt.floor;
        pt.vy *= -0.35;
        pt.vx *= 0.5;
      }
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const s of this.slashes) s.t -= dt;
    this.slashes = this.slashes.filter((s) => s.t > 0);
    for (const s of this.shocks) s.t -= dt;
    this.shocks = this.shocks.filter((s) => s.t > 0);
    for (const t of this.texts) {
      t.t -= dt;
      t.y -= 15 * dt;
    }
    this.texts = this.texts.filter((t) => t.t > 0);
    for (const d of this.decals) d.t -= dt;
    this.decals = this.decals.filter((d) => d.t > 0);
  }

  private burst(x: number, y: number, n: number, colors: string[], speed: number) {
    for (let k = 0; k < n; k++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(0.3, 1) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.2, 0.45), color: pick(colors), size: 1, grav: 0, floor: 999 });
    }
  }

  // --- Render --------------------------------------------------------------

  render() {
    const g = this.g;
    g.save();
    if (this.shake > 0) g.translate(Math.round(rand(-this.shake, this.shake)), Math.round(rand(-this.shake, this.shake)));
    g.drawImage(this.background, 0, 0);
    this.drawTorches();

    if (this.state === 'title') {
      g.restore();
      this.drawTitle();
      return;
    }
    if (this.state === 'shop') {
      g.restore();
      this.drawShop();
      return;
    }

    for (const d of this.decals) this.drawDecal(d);
    for (const pd of this.puddles) this.drawPuddle(pd);
    for (const pt of this.portals) this.drawPortal(pt);
    for (const e of this.enemies) if (e.type === 'troll' && e.state === 'windup') this.drawSlamWarning(e);
    for (const s of this.shocks) this.drawShock(s);
    for (const k of this.pickups) {
      if (k.t < 2 && Math.floor(k.t * 8) % 2) continue;
      g.drawImage(HEART, Math.round(k.x - 3), Math.round(k.y - 8 + Math.sin(this.time * 5) * 1.5));
    }

    const drawables: { y: number; draw: () => void }[] = this.enemies.map((e) => ({ y: e.y, draw: () => this.drawEnemy(e) }));
    if (this.state === 'playing') for (const pet of this.pets) drawables.push({ y: pet.y, draw: () => this.drawPet(pet) });
    if (this.state === 'playing' || (this.state === 'dying' && Math.floor(this.dyingT * 10) % 2 === 0)) {
      drawables.push({ y: this.player.y, draw: () => this.drawPlayer() });
    }
    drawables.sort((a, b) => a.y - b.y).forEach((d) => d.draw());
    for (const e of this.enemies) if (e.type === 'eyeball' && (e.state === 'aim' || e.state === 'laser')) this.drawLaser(e);

    for (const n of this.novas) this.drawNova(n);
    for (const b of this.bullets) this.drawBullet(b);
    for (const pt of this.particles) {
      g.fillStyle = pt.color;
      g.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
    }
    for (const s of this.slashes) this.drawSlash(s);
    for (const t of this.texts) {
      const x = Math.round(t.x);
      const y = Math.round(t.y);
      this.text(t.text, x, y, t.color, 'center');
      if (t.icon) g.drawImage(ICONS[t.icon], x - t.text.length * 4 - 10, y);
    }
    g.restore();

    if (this.hurtFlash > 0) {
      g.fillStyle = `rgba(255,0,77,${this.hurtFlash})`;
      g.fillRect(0, 0, W, H);
    }
    if (this.novaFlash > 0) {
      g.fillStyle = `rgba(255,205,117,${this.novaFlash})`;
      g.fillRect(0, 0, W, H);
    }
    this.drawHud();
    if (this.state === 'playing') this.drawWeapons();

    if (this.banner.t > 0 && this.state === 'playing') {
      if (this.banner.t > 0.4 || Math.floor(this.banner.t * 10) % 2 === 0) {
        this.text(this.banner.text, W / 2, 72, '#ffcd75', 'center', 16);
        if (this.banner.sub) this.text(this.banner.sub, W / 2, 94, '#f4f4f4', 'center');
      }
    }
    if (this.paused) {
      this.dim(0.6);
      this.text('PAUSED', W / 2, 74, '#ffcd75', 'center', 16);
      this.text('P / ESC TO RESUME', W / 2, 98, '#94b0c2', 'center');
    }
    if (this.state === 'gameover') this.drawGameOver();
  }

  private dim(a: number) {
    this.g.fillStyle = `rgba(10,10,20,${a})`;
    this.g.fillRect(0, 0, W, H);
  }

  private text(s: string, x: number, y: number, color = '#f4f4f4', align: CanvasTextAlign = 'left', size = 8) {
    const g = this.g;
    g.font = `${size}px "Press Start 2P", monospace`;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillStyle = '#1a1c2c';
    g.fillText(s, x + 1, y + 1);
    g.fillStyle = color;
    g.fillText(s, x, y);
  }

  private drawTorches() {
    const g = this.g;
    const [outer, mid, core] = LOOKS[this.biome].flame;
    for (const tx of TORCHES) {
      const f = Math.floor(this.time * 10 + tx) % 3;
      g.fillStyle = outer;
      g.fillRect(tx - 2, 11 - f, 5, 5 + f);
      g.fillStyle = mid;
      g.fillRect(tx - 1, 12 - f, 3, 4 + f);
      g.fillStyle = core;
      g.fillRect(tx, 13 - (f % 2), 1, 2);
    }
  }


  private drawSet(set: SpriteSet, frame: number, face: number, x: number, y: number, white: boolean) {
    const frames = white ? (face < 0 ? set.wl : set.wr) : face < 0 ? set.l : set.r;
    const img = frames[frame];
    this.g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 1));
  }

  private shadow(x: number, y: number, w: number) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
    g.fillRect(Math.round(x - w / 2 + 1), Math.round(y - 1), w - 2, 1);
  }

  /** Draws a 1px line pixel by pixel to keep things crisp. */
  private pixelLine(x0: number, y0: number, x1: number, y1: number, color: string) {
    const g = this.g;
    g.fillStyle = color;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) g.fillRect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1);
  }

  private drawPlayer() {
    const p = this.player;
    if (p.invuln > 0 && p.dashT <= 0 && Math.floor(p.invuln * 15) % 2) return;
    const g = this.g;
    this.shadow(p.x, p.y, 10);
    const frame = p.moving ? Math.floor(p.anim * 8) % 2 : 0;
    // Small hop while casting the nova.
    const hop = p.novaT > 0 ? Math.round(Math.sin((1 - p.novaT / 0.4) * Math.PI) * 6) : 0;
    this.drawSet(HERO_SPRITES[this.hero.id], frame, p.face, p.x, p.y - hop, false);
    if (p.poisonT > 0 && Math.floor(this.time * 8) % 2) {
      // Rabies or poison: a sickly green tinge.
      this.g.fillStyle = 'rgba(167,240,112,0.35)';
      this.g.fillRect(Math.round(p.x - 6), Math.round(p.y - hop - 14), 12, 14);
    }
    if (p.glitchT > 0) {
      // Glitched: torn horizontal slices and red/cyan static.
      const img = (p.face < 0 ? HERO_SPRITES[this.hero.id].l : HERO_SPRITES[this.hero.id].r)[0];
      const x0 = Math.round(p.x - img.width / 2);
      const y0 = Math.round(p.y - hop - img.height + 1);
      const rng = mulberry32(Math.floor(this.time * 15));
      for (let k = 0; k < 3; k++) {
        const sy = Math.floor(rng() * img.height);
        g.drawImage(img, 0, sy, img.width, 2, x0 + Math.round((rng() * 2 - 1) * 4), y0 + sy, img.width, 2);
      }
      g.fillStyle = Math.floor(this.time * 15) % 2 ? 'rgba(255,0,77,0.35)' : 'rgba(115,239,247,0.35)';
      g.fillRect(x0 + 2, y0 + Math.floor(rng() * img.height), img.width - 4, 2);
    }
    const hx = p.x + p.face * 4;
    const hy = p.y - 6 - hop;
    if (p.weapon === 'sword') {
      // Sweeps across the arc while swinging, otherwise points at the cursor.
      let ang = Math.atan2(p.aimY, p.aimX);
      if (p.swingT > 0) ang += SWORD.arc * ((1 - p.swingT / SWORD.swing) * 2 - 1);
      const cx = Math.cos(ang);
      const cy = Math.sin(ang);
      const gx = hx + cx * 2;
      const gy = hy + cy * 2;
      this.pixelLine(gx + cx, gy + cy, hx + cx * 11, hy + cy * 11, p.swingT > 0 ? '#f4f4f4' : '#94b0c2');
      this.pixelLine(gx - cy * 2, gy + cx * 2, gx + cy * 2, gy - cx * 2, '#8b5a3c');
    } else if (p.weapon === 'bomb') {
      // A bomb in hand, fuse fizzing, until it's thrown.
      if (p.shootCd < BOMB.cd * 0.5) {
        const bx = Math.round(hx + p.aimX * 4);
        const by = Math.round(hy + p.aimY * 4);
        this.disc(bx, by, 2, '#333c57');
        g.fillStyle = Math.floor(this.time * 12) % 2 ? '#ffcd75' : '#ef7d57';
        g.fillRect(bx + 1, by - 3, 1, 1);
      }
    } else {
      // Wand with a glowing tip; a crackling yellow tip when the nova is armed. The scatter wand glows pink.
      this.pixelLine(hx, hy, hx + p.aimX * 6, hy + p.aimY * 6, '#8b5a3c');
      const armed = p.weapon === 'nova';
      const flick = Math.floor(this.time * 20) % 2;
      g.fillStyle = armed ? (flick ? '#ffcd75' : '#f4f4f4') : p.shootCd > 0.1 ? '#f4f4f4' : p.weapon === 'scatter' ? '#f5a3c7' : '#73eff7';
      const s = armed ? 2 + flick : 2;
      g.fillRect(Math.round(hx + p.aimX * 7 - s / 2), Math.round(hy + p.aimY * 7 - s / 2), s, s);
    }
    if (p.weapon === 'nova') {
      g.fillStyle = '#ffcd75';
      for (let k = 0; k < 6; k++) {
        const a = this.time * 5 + (k * Math.PI) / 3;
        g.fillRect(Math.round(p.x + Math.cos(a) * 10), Math.round(p.y - 6 - hop + Math.sin(a) * 9), 1, 1);
      }
    }
  }

  private drawPet(pet: Pet) {
    const g = this.g;
    let top = pet.y - 11;
    if (pet.kind === 'dragon') {
      const lift = 6 + Math.round(Math.sin(pet.anim * 5) * 1.5);
      this.shadow(pet.x, pet.y, 8);
      this.drawSet(SPR.petDragon, Math.floor(pet.anim * 12) % 2, pet.face, pet.x, pet.y - lift, false);
      if (pet.breathT > 0) {
        g.fillStyle = Math.floor(this.time * 20) % 2 ? '#f4f4f4' : '#73eff7';
        g.fillRect(Math.round(pet.x + pet.face * 7 - 1), Math.round(pet.y - lift - 9), 3, 3);
      }
      top = pet.y - lift - 16;
    } else if (pet.kind === 'phoenix') {
      const lift = 12 + Math.round(Math.sin(pet.anim * 4) * 2);
      this.shadow(pet.x, pet.y, 8);
      // Once it has used up its revive it flickers, burning low.
      if (!pet.spent || Math.floor(this.time * 6) % 3) this.drawSet(SPR.phoenix, Math.floor(pet.anim * 10) % 2, pet.face, pet.x, pet.y - lift, false);
      top = pet.y - lift - 16;
    } else if (pet.kind === 'wolf') {
      this.shadow(pet.x, pet.y, 12);
      const hop = pet.breathT > 0 ? 4 : 0;
      this.drawSet(SPR.wolf, pet.breathT > 0 ? 1 : Math.floor(pet.anim * 8) % 2, pet.face, pet.x, pet.y - hop, false);
      top = pet.y - hop - 12;
    } else {
      this.shadow(pet.x, pet.y, 10);
      this.drawSet(SPR.spider, Math.floor(pet.anim * 8) % 2, pet.face, pet.x, pet.y, false);
    }
    // A little heart so nobody shoots their own pet by mistake.
    if (Math.floor(this.time * 1.5) % 4 === 0) {
      const hx = Math.round(pet.x);
      const hy = Math.round(top);
      g.fillStyle = '#f5a3c7';
      g.fillRect(hx - 1, hy, 1, 1);
      g.fillRect(hx + 1, hy, 1, 1);
      g.fillRect(hx - 1, hy + 1, 3, 1);
      g.fillRect(hx, hy + 2, 1, 1);
    }
  }

  private drawNova(n: Nova) {
    const g = this.g;
    const rings: [number, string][] = [
      [n.r, '#f4f4f4'],
      [n.r - 3, '#ffcd75'],
      [n.r - 7, '#73eff7'],
    ];
    for (const [r, color] of rings) {
      if (r <= 0) continue;
      g.fillStyle = color;
      for (let a = 0; a < Math.PI * 2; a += 1 / r) {
        g.fillRect(Math.round(n.x + Math.cos(a) * r), Math.round(n.y + Math.sin(a) * r), 1, 1);
      }
    }
  }

  private drawWeaponIcon(w: Weapon, cx: number, cy: number, ready: boolean) {
    const g = this.g;
    if (w === 'wand') {
      this.pixelLine(cx - 4, cy + 4, cx + 1, cy - 1, '#8b5a3c');
      g.fillStyle = '#73eff7';
      g.fillRect(cx + 1, cy - 3, 2, 2);
    } else if (w === 'scatter') {
      this.pixelLine(cx - 4, cy + 4, cx, cy, '#8b5a3c');
      g.fillStyle = '#f5a3c7';
      g.fillRect(cx + 1, cy - 4, 1, 1);
      g.fillRect(cx + 3, cy - 2, 1, 1);
      g.fillRect(cx + 2, cy + 1, 1, 1);
    } else if (w === 'bomb') {
      this.disc(cx, cy + 1, 3, '#333c57');
      g.fillStyle = '#94b0c2';
      g.fillRect(cx - 2, cy - 1, 1, 1);
      g.fillStyle = '#8b5a3c';
      g.fillRect(cx + 1, cy - 3, 1, 1);
      g.fillStyle = ready && Math.floor(this.time * 8) % 2 ? '#ffcd75' : '#ef7d57';
      g.fillRect(cx + 2, cy - 4, 1, 1);
    } else if (w === 'sword') {
      this.pixelLine(cx - 1, cy + 1, cx + 4, cy - 4, '#94b0c2');
      g.fillStyle = '#f4f4f4';
      g.fillRect(cx + 4, cy - 4, 1, 1);
      this.pixelLine(cx - 3, cy - 1, cx + 1, cy + 3, '#8b5a3c');
      this.pixelLine(cx - 2, cy + 2, cx - 4, cy + 4, '#566c86');
    } else {
      const spin = ready ? this.time * 4 : 0;
      g.fillStyle = ready ? '#ffcd75' : '#566c86';
      for (let k = 0; k < 8; k++) {
        const a = spin + (k * Math.PI) / 4;
        g.fillRect(Math.round(cx + Math.cos(a) * 4), Math.round(cy + Math.sin(a) * 4), 1, 1);
      }
      g.fillStyle = ready ? '#f4f4f4' : '#566c86';
      g.fillRect(cx - 1, cy - 1, 2, 2);
    }
  }

  /** Bottom-left weapon bar: three slots, the selected weapon's name and the nova cooldown. */
  private drawWeapons() {
    const g = this.g;
    const p = this.player;
    const y = H - 15;
    const list = this.weapons;
    list.forEach((w, k) => {
      const x = 4 + k * 16;
      const ready = w !== 'nova' || p.specialCd <= 0;
      g.fillStyle = 'rgba(10,10,20,0.8)';
      g.fillRect(x, y, 14, 13);
      this.drawWeaponIcon(w, x + 7, y + 6, ready);
      if (!ready) {
        g.fillStyle = 'rgba(10,10,20,0.6)';
        g.fillRect(x + 1, y + 1, 12, Math.ceil((11 * p.specialCd) / this.novaCd));
      }
      const blink = w === 'nova' && ready && p.weapon !== 'nova' && Math.floor(this.time * 3) % 2;
      g.fillStyle = p.weapon === w ? '#ffcd75' : blink ? '#ef7d57' : '#333c57';
      g.fillRect(x, y, 14, 1);
      g.fillRect(x, y + 12, 14, 1);
      g.fillRect(x, y, 1, 13);
      g.fillRect(x + 13, y, 1, 13);
    });
    const nameX = 6 + list.length * 16;
    this.text(p.weapon.toUpperCase(), nameX, y + 3, '#f4f4f4');
    if (p.specialCd > 0) this.text(`NOVA ${Math.ceil(p.specialCd)}s`, nameX + 62, y + 3, '#566c86');
  }

  private drawEnemy(e: Enemy) {
    if (e.type === 'eyeball') return this.drawEyeball(e);
    if (e.type === 'bat') return this.drawBat(e);
    if (e.type === 'bear') return this.drawBear(e);
    if (e.type === 'worm') return this.drawWorm(e);
    const g = this.g;
    const white = e.flash > 0;
    const lift = this.lift(e);
    // Reapers fade out, then back in somewhere else.
    if (e.state === 'phase') g.globalAlpha = clamp(Math.abs(e.t - PHASE / 2) / (PHASE / 2), 0.1, 1);
    if (e.state === 'warp') g.globalAlpha = Math.floor(this.time * 30) % 2 ? 0.2 : 0.8;
    this.shadow(e.x, e.y, e.type === 'troll' ? 18 : e.type === 'zombie' ? 12 : e.type === 'goblin' ? 8 : 10);
    const frame = Math.floor(e.anim * 6) % 2;
    let ox = 0;
    let oy = 0;
    if (e.state === 'windup' && e.type !== 'dragon') ox = Math.floor(this.time * 30) % 2 ? 1 : -1;
    if (e.type === 'goblin') {
      // Crouches before the stab, then hops forward with the lunge.
      if (e.state === 'windup') oy = 1;
      else oy = -Math.min(4, Math.round(Math.hypot(e.kx, e.ky) / 40));
    }
    if (e.type === 'dragon' && e.state === 'breathe') ox = Math.floor(this.time * 30) % 2 ? -e.face : 0;
    this.drawSet(this.enemySprite(e.type), e.type === 'slime' ? this.slimeFrame(e) : frame, e.face, e.x + ox, e.y - lift + oy, white);
    if (e.type === 'glitch') this.drawGlitchNoise(e, frame, e.state === 'warp' || e.state === 'cast' ? 4 : 1);

    if (e.type === 'skeleton') {
      // Rusty sword: held at the side, raised toward the player when winding up.
      const hx = e.x + e.face * 5;
      const hy = e.y - 7;
      if (e.state === 'windup' || e.state === 'recover') {
        const ex = hx + e.aimX * 9;
        const ey = hy + e.aimY * 9;
        this.pixelLine(hx, hy, ex, ey, e.state === 'windup' ? '#f4f4f4' : '#94b0c2');
      } else {
        this.pixelLine(hx, hy, hx, hy - 8, '#94b0c2');
        g.fillStyle = '#8b5a3c';
        g.fillRect(Math.round(hx - 1), Math.round(hy - 1), 3, 1);
      }
    } else if (e.type === 'sorcerer') {
      const sx = Math.round(e.x + e.face * 7);
      g.fillStyle = '#8b5a3c';
      g.fillRect(sx, Math.round(e.y - 15), 1, 15);
      const charging = e.state === 'cast' || e.state === 'summon';
      const pulse = charging ? 1 + Math.floor(this.time * 20) % 2 : 0;
      g.fillStyle = e.state === 'summon' ? '#f5a3c7' : charging ? '#ffcd75' : '#8a3f9e';
      g.fillRect(sx - 1 - pulse, Math.round(e.y - 18) - pulse, 3 + pulse * 2, 3 + pulse * 2);
      if (e.state === 'summon') {
        g.fillStyle = '#8a3f9e';
        for (let k = 0; k < 8; k++) {
          const a = this.time * 4 + (k * Math.PI) / 4;
          g.fillRect(Math.round(e.x + Math.cos(a) * 12), Math.round(e.y + Math.sin(a) * 5), 1, 1);
        }
      }
    } else if (e.type === 'slime' && e.state === 'windup') {
      // Puffs up a poison blob on its head.
      const k = 1 - e.t / STATS.slime.windup;
      this.disc(Math.round(e.x), Math.round(e.y - 12 - k * 3), 1 + Math.round(k * 2), '#5d275d');
      g.fillStyle = '#a7f070';
      g.fillRect(Math.round(e.x), Math.round(e.y - 13 - k * 3), 1, 1);
    } else if (e.type === 'goblin') {
      this.drawDagger(e, e.x + e.face * 4, e.y - 5 + oy);
      if (e.loot) {
        // A sack of your coins slung over its shoulder.
        const sx = Math.round(e.x - e.face * 5);
        const sy = Math.round(e.y - 12 + oy);
        this.disc(sx, sy, 3, '#8b5a3c');
        g.fillStyle = '#ffcd75';
        g.fillRect(sx - 1, sy - 1, 2, 2);
        g.fillStyle = '#1a1c2c';
        g.fillRect(sx - 1, sy - 4, 2, 1);
      }
    } else if (e.type === 'troll') {
      this.drawClub(e);
    } else if (e.type === 'reaper') {
      this.drawScythe(e, e.x + e.face * 5, e.y - 8 - lift);
    } else if (e.type === 'dragon' && (e.state === 'windup' || e.state === 'breathe')) {
      // Glowing mouth: flickers while breathing in, white-hot while breathing fire.
      const m = this.dragonMouth(e);
      const f = Math.floor(this.time * 20) % 2;
      g.fillStyle = e.state === 'breathe' ? (f ? '#f4f4f4' : '#ffcd75') : f ? '#ef7d57' : '#ffcd75';
      const sz = e.state === 'breathe' ? 3 : 2;
      g.fillRect(Math.round(m.x + ox - sz / 2), Math.round(m.y - sz / 2), sz, sz);
    }
    g.globalAlpha = 1;
    if (e.slowT > 0) {
      // Spider web strands.
      g.fillStyle = 'rgba(244,244,244,0.7)';
      const top = e.y - lift - 12;
      this.pixelLine(e.x - 6, top, e.x + 6, top + 8, 'rgba(244,244,244,0.7)');
      this.pixelLine(e.x + 6, top, e.x - 6, top + 8, 'rgba(244,244,244,0.7)');
      g.fillRect(Math.round(e.x - 5), Math.round(top + 4), 11, 1);
    }

    if (e.hp < e.maxHp && e.state !== 'phase' && e.state !== 'warp') {
      const w = 12;
      const top = Math.round(e.y - lift - SPR[e.type].r[0].height - 4);
      g.fillStyle = '#1a1c2c';
      g.fillRect(Math.round(e.x - w / 2) - 1, top, w + 2, 3);
      g.fillStyle = '#b13e53';
      g.fillRect(Math.round(e.x - w / 2), top + 1, Math.max(1, Math.round((w * e.hp) / e.maxHp)), 1);
    }
  }

  /** Fills a disc row by row, so it stays crisp. */
  /**
   * Corrupts a Glitch: a few horizontal slices of its sprite drawn shifted sideways, plus stray
   * red/cyan pixels. `amount` is how many slices (more while warping or charging).
   */
  private drawGlitchNoise(e: Enemy, frame: number, amount: number) {
    const g = this.g;
    const img = (e.face < 0 ? SPR.glitch.l : SPR.glitch.r)[frame];
    const x0 = Math.round(e.x - img.width / 2);
    const y0 = Math.round(e.y - img.height + 1);
    // Change the corruption pattern about 12 times a second, not every frame.
    const rng = mulberry32(Math.floor(this.time * 12) * 977 + Math.round(e.tx * 31 + e.ty));
    for (let k = 0; k < amount; k++) {
      const sy = Math.floor(rng() * img.height);
      const sh = 1 + Math.floor(rng() * 2);
      const shift = Math.round((rng() * 2 - 1) * 4);
      if (rng() < 0.5 || amount > 1) g.drawImage(img, 0, sy, img.width, sh, x0 + shift, y0 + sy, img.width, sh);
    }
    for (let k = 0; k < amount + 1; k++) {
      g.fillStyle = rng() < 0.5 ? '#ff004d' : '#73eff7';
      g.fillRect(x0 + Math.floor(rng() * (img.width + 4)) - 2, y0 + Math.floor(rng() * img.height), 1 + Math.floor(rng() * 3), 1);
    }
  }

  private disc(cx: number, cy: number, r: number, color: string) {
    const g = this.g;
    g.fillStyle = color;
    for (let dy = -r; dy < r; dy++) {
      const half = Math.round(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5)));
      g.fillRect(cx - half, cy + dy, half * 2, 1);
    }
  }

  private drawEyeball(e: Enemy) {
    const g = this.g;
    const p = this.player;
    const enraged = e.hp < e.maxHp / 2;
    const lift = this.lift(e);
    const c = this.eyeCentre(e);
    this.shadow(e.x, e.y, 24);
    // Dangling optic nerve.
    for (let k = 0; k < 9; k++) {
      const wx = Math.round(Math.sin(this.time * 4 + k * 0.7) * (k / 3));
      g.fillStyle = k % 3 ? '#b13e53' : '#f5a3c7';
      g.fillRect(c.x - 1 + wx, c.y + 15 + k, 3 - Math.floor(k / 4), 1);
    }
    this.drawSet(this.enemySprite('eyeball'), Math.floor(e.anim * (enraged ? 8 : 3)) % 2, 1, e.x, e.y - lift, e.flash > 0);

    // The iris follows you, or the laser's aim while it's charging or firing.
    let lx = p.x - c.x;
    let ly = p.y - 6 - c.y;
    if (e.state === 'aim' || e.state === 'laser') {
      lx = e.aimX;
      ly = e.aimY;
    }
    const ll = Math.hypot(lx, ly) || 1;
    const ix = c.x + Math.round((lx / ll) * 5);
    const iy = c.y + Math.round((ly / ll) * 5);
    const flick = Math.floor(this.time * 20) % 2;
    this.disc(ix, iy, 7, enraged ? '#b13e53' : '#3b5dc9');
    this.disc(ix, iy, 5, enraged ? '#ff004d' : '#41a6f6');
    // The pupil narrows while aiming and glows red once the laser is locked or firing.
    const locked = (e.state === 'aim' && e.t <= EYE.lock) || e.state === 'laser';
    const pupil = e.state === 'aim' ? 2 : e.state === 'tears' ? 4 : 3;
    this.disc(ix, iy, pupil, locked ? (flick ? '#ff004d' : '#f4f4f4') : '#1a1c2c');
    g.fillStyle = '#f4f4f4';
    g.fillRect(ix - 3, iy - 4, 2, 2);

    // Eyelid: a quick blink every few seconds, and a squint while it wells up with tears.
    const blink = e.state === 'chase' && e.anim % 3.2 < 0.12;
    const lid = blink ? 1 : e.state === 'tears' ? 0.4 : 0;
    if (lid > 0) {
      const top = c.y - 16;
      const rows = Math.round(32 * lid);
      for (let y = 0; y < rows; y++) {
        const dy = top + y + 0.5 - c.y;
        const half = Math.round(Math.sqrt(Math.max(0, 15.5 * 15.5 - dy * dy)));
        g.fillStyle = y === rows - 1 ? '#1a1c2c' : '#5d275d';
        g.fillRect(c.x - half, top + y, half * 2, 1);
      }
    }
  }

  private drawBat(e: Enemy) {
    const g = this.g;
    const lift = this.lift(e);
    this.shadow(e.x, e.y, e.state === 'swoop' ? 18 : 12);
    let ox = 0;
    if (e.state === 'windup' || e.state === 'screech') ox = Math.floor(this.time * 30) % 2 ? 1 : -1;
    this.drawSet(this.enemySprite('bat'), Math.floor(e.anim * 8) % 2, e.face, e.x + ox, e.y - lift, e.flash > 0);
    const top = Math.round(e.y - lift - 15);
    if (e.state === 'windup') {
      // Eyes flare red and a dotted line shows where it's about to dive.
      g.fillStyle = Math.floor(this.time * 20) % 2 ? '#ff004d' : '#f4f4f4';
      g.fillRect(Math.round(e.x) - 3, top + 7, 2, 1);
      g.fillRect(Math.round(e.x) + 2, top + 7, 2, 1);
      if (e.t <= 0.3) {
        g.fillStyle = '#ff004d';
        for (let k = 8; k < BAT.swoopSpeed * BAT.swoop; k += 5) g.fillRect(Math.round(e.x + e.aimX * k), Math.round(e.y + e.aimY * k), 1, 1);
      }
    }
    if (e.state === 'screech') {
      // Sound rings pulsing out of its mouth.
      const r = 4 + ((this.time * 40) % 10);
      g.fillStyle = '#f5a3c7';
      for (let a = 0; a < Math.PI * 2; a += 0.5) g.fillRect(Math.round(e.x + Math.cos(a) * r), Math.round(top + 10 + Math.sin(a) * r * 0.6), 1, 1);
    }
  }

  private drawBear(e: Enemy) {
    const g = this.g;
    this.shadow(e.x, e.y, 22);
    let ox = 0;
    if (e.state === 'windup') ox = Math.floor(this.time * 30) % 2 ? 1 : -1;
    const frame = e.state === 'stun' ? 0 : Math.floor(e.anim * (e.state === 'charge' ? 14 : 6)) % 2;
    this.drawSet(this.enemySprite('bear'), frame, e.face, e.x + ox, e.y, e.flash > 0);
    if (e.state === 'windup' && e.t <= 0.25) {
      // Locked on: the charge line flashes.
      g.fillStyle = Math.floor(this.time * 20) % 2 ? '#ff004d' : '#f4f4f4';
      for (let k = 12; k < 120; k += 4) g.fillRect(Math.round(e.x + e.aimX * k), Math.round(e.y - 4 + e.aimY * k), 1, 1);
    }
    if (e.state === 'stun') {
      g.fillStyle = '#ffcd75';
      for (let k = 0; k < 3; k++) {
        const a = this.time * 6 + (k * Math.PI * 2) / 3;
        g.fillRect(Math.round(e.x + Math.cos(a) * 8), Math.round(e.y - 21 + Math.sin(a) * 2), 2, 2);
      }
    }
  }

  private drawPuddle(pd: Puddle) {
    if (pd.t < 1 && Math.floor(pd.t * 8) % 2) return;
    const g = this.g;
    const x = Math.round(pd.x);
    const y = Math.round(pd.y);
    // Poison is purple, so it stands out from the harmless slime on the floor.
    g.fillStyle = '#5d275d';
    g.fillRect(x - 12, y - 2, 24, 5);
    g.fillRect(x - 9, y - 4, 18, 9);
    g.fillStyle = '#8a3f9e';
    g.fillRect(x - 10, y - 2, 20, 4);
    g.fillRect(x - 7, y - 3, 14, 6);
    // Bubbles.
    g.fillStyle = '#a7f070';
    const f = Math.floor(this.time * 3 + pd.x) % 3;
    g.fillRect(x - 5 + f * 4, y - 1, 1, 1);
    g.fillRect(x + 4 - f * 3, y + 1, 1, 1);
  }

  private drawWorm(e: Enemy) {
    const g = this.g;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    if (e.state !== 'surface') {
      // Underground: a mound of sand moving along; it shudders while it lines up a strike.
      const j = e.state === 'windup' ? (Math.floor(this.time * 30) % 2 ? 1 : -1) : 0;
      g.fillStyle = '#7a5636';
      g.fillRect(x - 6 + j, y - 1, 12, 2);
      g.fillRect(x - 4 + j, y - 3, 8, 2);
      g.fillStyle = '#c29a66';
      g.fillRect(x - 3 + j, y - 3, 4, 1);
      if (e.state === 'windup') {
        // Cracks spreading where it's about to burst out.
        const k = 1 - e.t / STATS.worm.windup;
        g.fillStyle = Math.floor(this.time * 12) % 2 ? '#ff004d' : '#7a5636';
        for (let a = 0; a < Math.PI * 2; a += 0.35) {
          const r = 6 + k * 8;
          g.fillRect(Math.round(e.tx + Math.cos(a) * r), Math.round(e.ty + Math.sin(a) * r * 0.5), 1, 1);
        }
      }
      return;
    }
    // Above ground: rises out of a hole, then sinks back into it.
    const since = WORM.up - e.t;
    const out = Math.min(1, since / WORM.rise, e.t / WORM.sink);
    const set = SPR.worm;
    const h = set.r[0].height;
    g.fillStyle = '#1a1c2c';
    g.fillRect(x - 7, y - 1, 14, 3);
    g.fillStyle = '#7a5636';
    g.fillRect(x - 8, y + 1, 16, 1);
    g.save();
    g.beginPath();
    g.rect(x - 12, y - h - 4, 24, h + 5);
    g.clip();
    const sway = Math.round(Math.sin(this.time * 6) * 1);
    const frame = since < 0.5 || Math.floor(this.time * 4) % 2 ? 0 : 1;
    this.drawSet(set, frame, e.face, e.x + sway, e.y + Math.round(h * (1 - out)), e.flash > 0);
    g.restore();
  }

  private drawLaser(e: Enemy) {
    const g = this.g;
    const o = this.beamOrigin(e);
    const len = this.beamLength(e);
    const flick = Math.floor(this.time * 20) % 2;
    if (e.state === 'aim') {
      // A dotted sight that crawls along the aim; solid and flashing once it has locked on.
      const locked = e.t <= EYE.lock;
      g.fillStyle = locked ? (flick ? '#f4f4f4' : '#ff004d') : '#b13e53';
      const step = locked ? 1 : 4;
      for (let k = locked ? 0 : Math.floor(this.time * 40) % 4; k < len; k += step) {
        g.fillRect(Math.round(o.x + e.aimX * k), Math.round(o.y + e.aimY * k), 1, 1);
      }
      return;
    }
    const layers: [number, string][] = [
      [flick ? 7 : 6, '#b13e53'],
      [4, '#ff004d'],
      [2, '#f4f4f4'],
    ];
    for (const [w, color] of layers) {
      g.fillStyle = color;
      for (let k = 0; k < len; k++) {
        g.fillRect(Math.round(o.x + e.aimX * k - w / 2), Math.round(o.y + e.aimY * k - w / 2), w, w);
      }
    }
    this.disc(Math.round(o.x), Math.round(o.y), flick ? 5 : 4, '#ff004d');
    this.disc(Math.round(o.x), Math.round(o.y), 2, '#f4f4f4');
  }

  /** Goblin dagger: held low, pulled back while crouching, jabbed out during the lunge. */
  private drawDagger(e: Enemy, hx: number, hy: number) {
    const g = this.g;
    if (e.state === 'windup') {
      const bx = hx - e.aimX * 4;
      const by = hy - e.aimY * 4;
      this.pixelLine(bx, by, bx + e.aimX * 4, by + e.aimY * 4, Math.floor(this.time * 20) % 2 ? '#f4f4f4' : '#94b0c2');
    } else if (Math.hypot(e.kx, e.ky) > 60) {
      this.pixelLine(hx, hy, hx + e.aimX * 7, hy + e.aimY * 7, '#f4f4f4');
    } else {
      this.pixelLine(hx, hy, hx + e.face * 3, hy + 2, '#94b0c2');
    }
    g.fillStyle = '#8b5a3c';
    g.fillRect(Math.round(hx), Math.round(hy), 1, 1);
  }

  /** Troll club: dragged at its side, hauled up overhead during the windup, then smashed into the ground. */
  private drawClub(e: Enemy) {
    const g = this.g;
    const hx = e.x + e.face * 8;
    const hy = e.y - 10;
    let tipX: number;
    let tipY: number;
    if (e.state === 'recover') {
      tipX = e.tx;
      tipY = e.ty - 2;
    } else {
      const rest = e.face > 0 ? 1.1 : Math.PI - 1.1;
      const raised = -Math.PI / 2 - e.face * 0.7;
      const k = e.state === 'windup' ? Math.min(1, (1 - e.t / STATS.troll.windup) * 1.6) : 0;
      const ang = rest + (raised - rest) * k;
      tipX = hx + Math.cos(ang) * 12;
      tipY = hy + Math.sin(ang) * 12;
    }
    this.pixelLine(hx, hy, tipX, tipY, '#8b5a3c');
    this.pixelLine(hx + 1, hy, tipX + 1, tipY, '#5d275d');
    g.fillStyle = '#566c86';
    g.fillRect(Math.round(tipX - 2), Math.round(tipY - 2), 4, 4);
    g.fillStyle = '#94b0c2';
    g.fillRect(Math.round(tipX - 2), Math.round(tipY - 2), 2, 1);
  }

  /** Reaper scythe: upright while drifting, tilted back to wind up, then swept over the top towards you. */
  private drawScythe(e: Enemy, hx: number, hy: number) {
    const g = this.g;
    const back = -Math.PI / 2 - e.face * 0.9;
    let ang = -Math.PI / 2;
    if (e.state === 'windup') ang = -Math.PI / 2 + (back + Math.PI / 2) * Math.min(1, 1 - e.t / STATS.reaper.windup);
    if (e.state === 'recover') {
      const k = clamp((STATS.reaper.recover - e.t) / 0.15, 0, 1);
      let da = Math.atan2(e.aimY, e.aimX) - back;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      ang = back + da * k;
    }
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    this.pixelLine(hx - dx * 5, hy - dy * 5, hx + dx * 12, hy + dy * 12, '#8b5a3c');
    // The blade curls off the top of the staff towards the reaper's front.
    const tx = hx + dx * 12;
    const ty = hy + dy * 12;
    const px = -dy * e.face;
    const py = dx * e.face;
    const flash = e.state === 'windup' && Math.floor(this.time * 20) % 2;
    for (let k = 1; k <= 7; k++) {
      g.fillStyle = flash || k > 5 ? '#f4f4f4' : '#94b0c2';
      g.fillRect(Math.round(tx + px * k - dx * ((k * k) / 14)), Math.round(ty + py * k - dy * ((k * k) / 14)), 1, 1);
    }
  }

  private drawSlamWarning(e: Enemy) {
    const g = this.g;
    const k = 1 - e.t / STATS.troll.windup;
    const blink = Math.floor(this.time * 12) % 2;
    // Outer ring: the full danger zone. Inner ring: grows to meet it as the club comes down.
    for (const [r, color] of [[SLAM_R, blink ? '#ff004d' : '#b13e53'], [SLAM_R * k, '#ef7d57']] as [number, string][]) {
      if (r < 1) continue;
      g.fillStyle = color;
      for (let a = 0; a < Math.PI * 2; a += 2 / r) g.fillRect(Math.round(e.tx + Math.cos(a) * r), Math.round(e.ty + Math.sin(a) * r * 0.6), 1, 1);
    }
  }

  private drawShock(s: Shock) {
    const g = this.g;
    const r = SLAM_R * (1 - s.t / 0.35) + 4;
    g.fillStyle = s.t > 0.2 ? '#94b0c2' : '#566c86';
    for (let a = 0; a < Math.PI * 2; a += 1.5 / r) {
      g.fillRect(Math.round(s.x + Math.cos(a) * r), Math.round(s.y + Math.sin(a) * r * 0.6), 2, 1);
    }
  }

  private drawBullet(b: Bullet) {
    const g = this.g;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.blob) {
      // Arcs through the air; the shadow shows where it'll land.
      const k = 1 - b.life / BLOB.flight;
      const z = Math.round(Math.sin(k * Math.PI) * 26);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 2, y, 5, 2);
      this.disc(x, y - z - 4, 3, '#5d275d');
      this.disc(x, y - z - 4, 2, '#8a3f9e');
      g.fillStyle = '#a7f070';
      g.fillRect(x - 1, y - z - 6, 1, 1);
    } else if (b.packet) {
      // A flickering missing-texture block.
      const f = Math.floor(this.time * 20) % 2;
      g.fillStyle = '#1a1c2c';
      g.fillRect(x - 4, y - 4, 8, 8);
      g.fillStyle = f ? '#8a3f9e' : '#ff004d';
      g.fillRect(x - 3, y - 3, 3, 3);
      g.fillRect(x, y, 3, 3);
      g.fillStyle = '#73eff7';
      g.fillRect(x + (f ? 4 : -6), y - 1, 2, 1);
      g.fillRect(x + (f ? -5 : 4), y + 2, 1, 1);
    } else if (b.shard) {
      const f = Math.floor(this.time * 30 + b.x) % 2;
      g.fillStyle = f ? '#ff004d' : '#73eff7';
      g.fillRect(Math.round(x - b.vx * 0.02) - 1, Math.round(y - b.vy * 0.02), 2, 1);
      g.fillStyle = f ? '#73eff7' : '#f4f4f4';
      g.fillRect(x - 1, y - 1, 2, 2);
    } else if (b.sand) {
      g.fillStyle = '#7a5636';
      g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = '#d8cfb4';
      g.fillRect(x - 1, y - 1, 2, 2);
    } else if (b.sonic) {
      // A ")" shaped sound wave, facing the way it's travelling.
      const ang = Math.atan2(b.vy, b.vx);
      const f = Math.floor(this.time * 20) % 2;
      for (let a = -0.9; a <= 0.9; a += 0.3) {
        g.fillStyle = f ? '#f5a3c7' : '#8a3f9e';
        g.fillRect(Math.round(b.x - Math.cos(ang) * 4 + Math.cos(ang + a) * 5), Math.round(b.y - Math.sin(ang) * 4 + Math.sin(ang + a) * 5), 1, 1);
        g.fillStyle = '#5d275d';
        g.fillRect(Math.round(b.x - Math.cos(ang) * 6 + Math.cos(ang + a) * 5), Math.round(b.y - Math.sin(ang) * 6 + Math.sin(ang + a) * 5), 1, 1);
      }
    } else if (b.homing) {
      g.fillStyle = '#ef7d57';
      g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = Math.floor(this.time * 20) % 2 ? '#ffcd75' : '#f4f4f4';
      g.fillRect(x - 1, y - 1, 2, 2);
    } else if (b.pierce !== undefined) {
      g.fillStyle = '#5d275d';
      g.fillRect(Math.round(x - b.vx * 0.015) - 1, Math.round(y - b.vy * 0.015) - 1, 2, 2);
      g.fillStyle = '#8a3f9e';
      g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = '#f5a3c7';
      g.fillRect(x, y, 1, 1);
    } else if (b.bomb) {
      this.disc(x, y, 3, '#1a1c2c');
      this.disc(x, y, 2, '#333c57');
      g.fillStyle = '#94b0c2';
      g.fillRect(x - 1, y - 2, 1, 1);
      g.fillStyle = Math.floor(this.time * 16) % 2 ? '#ffcd75' : '#ff004d';
      g.fillRect(x + 1, y - 4, 1, 1);
    } else if (b.flame) {
      // Starts white-hot, cools to orange then red as it burns out. The pet dragon's fire is blue.
      const f = Math.floor(this.time * 30 + b.x) % 2;
      const pal = b.enemy ? ['#f4f4f4', '#ffcd75', '#ef7d57', '#b13e53'] : ['#f4f4f4', '#73eff7', '#41a6f6', '#3b5dc9'];
      g.fillStyle = b.life > 0.3 ? (f ? pal[0] : pal[1]) : b.life > 0.15 ? pal[2] : pal[3];
      const sz = b.life > 0.3 ? 2 : b.life > 0.15 ? 3 : 2;
      g.fillRect(x - Math.floor(sz / 2), y - Math.floor(sz / 2), sz, sz);
    } else if (b.tear) {
      const f = Math.floor(this.time * 20) % 2;
      g.fillStyle = '#29366f';
      g.fillRect(x - 3, y - 2, 6, 4);
      g.fillRect(x - 2, y - 3, 4, 6);
      g.fillStyle = '#3b5dc9';
      g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = f ? '#73eff7' : '#f4f4f4';
      g.fillRect(x - 1, y - 2, 2, 2);
    } else if (b.enemy) {
      const f = Math.floor(this.time * 20) % 2;
      g.fillStyle = '#b13e53';
      g.fillRect(x - 3, y - 2, 6, 4);
      g.fillRect(x - 2, y - 3, 4, 6);
      g.fillStyle = '#ef7d57';
      g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = f ? '#ffcd75' : '#f4f4f4';
      g.fillRect(x - 1, y - 1, 2, 2);
    } else {
      g.fillStyle = '#3b5dc9';
      g.fillRect(Math.round(x - b.vx * 0.015) - 1, Math.round(y - b.vy * 0.015) - 1, 2, 2);
      g.fillStyle = '#41a6f6';
      g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = '#73eff7';
      g.fillRect(x, y, 1, 1);
    }
  }

  private drawSlash(s: Slash) {
    const g = this.g;
    g.fillStyle = s.color;
    const r = s.r;
    const back = r / 2;
    for (let a = -1; a <= 1; a += 1.6 / r) {
      const ang = s.ang + a;
      g.fillRect(Math.round(s.x + Math.cos(ang) * r - Math.cos(s.ang) * back), Math.round(s.y + Math.sin(ang) * r - Math.sin(s.ang) * back), 2, 1);
    }
  }

  private drawPortal(pt: Portal) {
    const g = this.g;
    const grow = (1 - pt.t / 0.9) * (isBoss(pt.type) ? 2.2 : 1);
    const rx = 3 + grow * 8;
    const ry = 1 + grow * 3;
    const cols = pt.summoned ? ['#8a3f9e', '#f5a3c7'] : ['#b13e53', '#ef7d57'];
    g.fillStyle = '#0e0e1a';
    g.fillRect(Math.round(pt.x - rx + 2), Math.round(pt.y - ry + 1), Math.round(rx * 2 - 4), Math.round(ry * 2 - 1));
    for (let k = 0; k < 12; k++) {
      const a = this.time * 6 + (k * Math.PI) / 6;
      g.fillStyle = cols[k % 2];
      g.fillRect(Math.round(pt.x + Math.cos(a) * rx), Math.round(pt.y + Math.sin(a) * ry), 1, 1);
    }
  }

  private drawDecal(d: Decal) {
    if (d.t < 1.5 && Math.floor(d.t * 8) % 2) return;
    const g = this.g;
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    if (d.type === 'skeleton') {
      g.fillStyle = '#d8cfb4';
      g.fillRect(x - 4, y - 1, 4, 1);
      g.fillRect(x + 1, y, 3, 1);
      g.fillStyle = '#f4f4f4';
      g.fillRect(x - 1, y - 3, 3, 2);
      g.fillStyle = '#1a1c2c';
      g.fillRect(x, y - 2, 1, 1);
    } else if (d.type === 'zombie') {
      g.fillStyle = '#1f4a34';
      g.fillRect(x - 5, y - 1, 10, 2);
      g.fillRect(x - 3, y - 2, 6, 4);
      g.fillStyle = '#38b764';
      g.fillRect(x - 2, y - 1, 2, 1);
    } else if (d.type === 'sorcerer') {
      g.fillStyle = '#5d275d';
      g.fillRect(x - 3, y - 1, 7, 2);
      g.fillRect(x - 1, y - 3, 3, 2);
      g.fillRect(x, y - 4, 1, 1);
      g.fillStyle = '#ffcd75';
      g.fillRect(x - 1, y - 2, 1, 1);
    } else if (d.type === 'goblin') {
      // Green splat and a dropped dagger.
      g.fillStyle = '#257179';
      g.fillRect(x - 3, y - 1, 6, 2);
      g.fillStyle = '#94b0c2';
      g.fillRect(x + 1, y - 3, 4, 1);
      g.fillStyle = '#8b5a3c';
      g.fillRect(x, y - 3, 1, 1);
    } else if (d.type === 'troll') {
      // Trolls turn to rubble.
      g.fillStyle = '#333c57';
      g.fillRect(x - 7, y - 1, 14, 2);
      g.fillStyle = '#566c86';
      g.fillRect(x - 6, y - 3, 4, 3);
      g.fillRect(x + 1, y - 4, 5, 4);
      g.fillStyle = '#94b0c2';
      g.fillRect(x - 6, y - 3, 2, 1);
      g.fillRect(x + 1, y - 4, 2, 1);
      g.fillRect(x - 1, y - 1, 2, 1);
    } else if (d.type === 'reaper') {
      // An empty robe and its scythe.
      g.fillStyle = '#333c57';
      g.fillRect(x - 4, y - 1, 8, 2);
      g.fillStyle = '#8b5a3c';
      g.fillRect(x - 6, y - 3, 11, 1);
      g.fillStyle = '#94b0c2';
      g.fillRect(x + 5, y - 4, 1, 3);
    } else if (d.type === 'glitch') {
      // A dead pixel patch: missing-texture checker and some static.
      g.fillStyle = '#1a1c2c';
      g.fillRect(x - 5, y - 2, 10, 3);
      g.fillStyle = '#8a3f9e';
      g.fillRect(x - 4, y - 2, 2, 1);
      g.fillRect(x, y - 2, 2, 1);
      g.fillRect(x - 2, y - 1, 2, 1);
      g.fillRect(x + 2, y - 1, 2, 1);
      g.fillStyle = Math.floor(this.time * 6) % 2 ? '#73eff7' : '#ff004d';
      g.fillRect(x + 6, y - 1, 2, 1);
    } else if (d.type === 'worm') {
      g.fillStyle = '#1a1c2c';
      g.fillRect(x - 6, y - 1, 12, 3);
      g.fillStyle = '#7a5636';
      g.fillRect(x - 8, y + 1, 16, 1);
      g.fillStyle = '#ef7d57';
      g.fillRect(x - 2, y - 2, 4, 2);
    } else if (d.type === 'slime') {
      g.fillStyle = '#257179';
      g.fillRect(x - 6, y - 1, 12, 3);
      g.fillStyle = '#38b764';
      g.fillRect(x - 4, y - 1, 8, 2);
      g.fillStyle = '#a7f070';
      g.fillRect(x - 2, y - 1, 1, 1);
    } else if (d.type === 'bat') {
      g.fillStyle = '#5d275d';
      g.fillRect(x - 10, y - 1, 20, 2);
      g.fillRect(x - 3, y - 3, 6, 4);
      g.fillStyle = '#1a1c2c';
      g.fillRect(x - 9, y - 2, 5, 1);
      g.fillRect(x + 4, y - 2, 5, 1);
    } else if (d.type === 'bear') {
      g.fillStyle = '#5d275d';
      g.fillRect(x - 12, y - 1, 24, 3);
      g.fillStyle = '#8b5a3c';
      g.fillRect(x - 9, y - 4, 18, 4);
      g.fillStyle = '#a7f070';
      g.fillRect(x + 7, y - 1, 3, 1);
      g.fillStyle = '#f4f4f4';
      g.fillRect(x + 9, y - 2, 2, 1);
    } else if (d.type === 'eyeball') {
      // A big gooey puddle with the pupil still staring up at you.
      g.fillStyle = '#5d275d';
      g.fillRect(x - 12, y - 2, 24, 4);
      g.fillRect(x - 8, y - 4, 16, 8);
      g.fillStyle = '#b13e53';
      g.fillRect(x - 6, y - 2, 12, 4);
      g.fillStyle = '#f4f4f4';
      g.fillRect(x - 3, y - 3, 6, 4);
      g.fillStyle = '#3b5dc9';
      g.fillRect(x - 1, y - 2, 3, 2);
      g.fillStyle = '#1a1c2c';
      g.fillRect(x, y - 2, 1, 1);
    } else {
      // Scorch mark and a couple of scales.
      g.fillStyle = '#1a1c2c';
      g.fillRect(x - 4, y - 1, 8, 2);
      g.fillRect(x - 2, y - 2, 4, 4);
      g.fillStyle = '#b13e53';
      g.fillRect(x - 3, y - 1, 1, 1);
      g.fillRect(x + 2, y, 1, 1);
      g.fillStyle = '#ef7d57';
      g.fillRect(x, y - 1, 1, 1);
    }
  }

  private drawHud() {
    const g = this.g;
    const p = this.player;
    g.fillStyle = 'rgba(10,10,20,0.8)';
    g.fillRect(0, 0, W, 11);
    this.text('HP', 3, 2, '#f4f4f4');
    g.fillStyle = '#1a1c2c';
    g.fillRect(20, 2, 50, 7);
    g.fillStyle = '#333c57';
    g.fillRect(21, 3, 48, 5);
    const frac = p.hp / p.maxHp;
    g.fillStyle = frac > 0.5 ? '#38b764' : frac > 0.25 ? '#ffcd75' : '#ff004d';
    g.fillRect(21, 3, Math.round(48 * frac), 5);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(21, 3, Math.round(48 * frac), 1);
    this.text(String(this.score).padStart(6, '0'), 76, 2, '#ffcd75');
    this.text(`WAVE ${Math.max(1, this.wave)}`, 130, 2, '#94b0c2');
    this.text(`ADS ${this.ads.watched}`, 190, 2, '#ff004d');
    g.drawImage(ICONS.coin, 242, 2);
    this.text(String(this.coins), 251, 2, '#ffcd75');
    g.drawImage(ICONS.gem, 283, 2);
    this.text(String(this.gems), 292, 2, '#73eff7');
    if (sfx.muted) this.text('MUTE', W - 3, 14, '#566c86', 'right');
    const bosses = this.enemies.filter((e) => isBoss(e.type));
    if (bosses.length && this.bossMax > 0) {
      const hp = bosses.reduce((sum, e) => sum + Math.max(0, e.hp), 0);
      this.text(BOSS_NAMES[bosses[0].type]!, W / 2, 14, '#ff004d', 'center');
      g.fillStyle = '#1a1c2c';
      g.fillRect(80, 24, 160, 5);
      g.fillStyle = '#333c57';
      g.fillRect(81, 25, 158, 3);
      g.fillStyle = hp < this.bossMax / 2 ? '#ff004d' : '#b13e53';
      g.fillRect(81, 25, Math.max(1, Math.round((158 * hp) / this.bossMax)), 3);
    }
    this.perks.forEach((k, n) => {
      const perk = PERKS[k.id];
      if (k.t < 2 && Math.floor(k.t * 8) % 2) return;
      this.text(`${perk.hud} ${Math.ceil(k.t)}s`, 3, 14 + n * 10, perk.good ? '#a7f070' : '#ff004d');
    });
    let row = this.perks.length;
    if (p.poisonT > 0) this.text(`${p.poisonName} ${Math.ceil(p.poisonT)}s`, 3, 14 + row++ * 10, '#a7f070');
    if (p.glitchT > 0) this.text(`GL1TCHED ${Math.ceil(p.glitchT)}s`, 3, 14 + row * 10, Math.floor(this.time * 8) % 2 ? '#73eff7' : '#ff004d');
  }

  private drawTitle() {
    const g = this.g;
    this.dim(0.55);
    const hue = Math.floor(this.time * 4) % 3;
    const titleCols = ['#ff004d', '#ffcd75', '#73eff7'];
    this.text('AD NAUSEAM', W / 2, 16, titleCols[hue], 'center', 16);
    this.text('every kill is sponsored', W / 2, 38, '#94b0c2', 'center');

    const cast: [EnemyType, string, string, string][] = [
      ['skeleton', 'SKELETON', 'FRAIL', 'HITS HARD'],
      ['zombie', 'ZOMBIE', 'TOUGH', 'SLOW'],
      ['sorcerer', 'SORCERER', 'RANGED', 'SUMMONS'],
      ['goblin', 'GOBLIN', 'SPEEDY', 'STAB & RUN'],
      ['troll', 'TROLL', 'HUGE', 'GROUND SLAM'],
      ['dragon', 'BABY DRAGON', 'FLIES', 'FIRE BREATH'],
      ['reaper', 'REAPER', 'TELEPORTS', 'SCYTHE'],
      ['glitch', 'THE GLITCH', 'RARE', 'FREEZES YOU'],
      ['worm', 'SANDWORM', 'DESERT', 'BURROWS'],
      ['slime', 'SLIME', 'SLIME LAND', 'POISON'],
    ];
    // Three at a time, rotating through the whole cast.
    const first = Math.floor(this.time / 2.5) * 3;
    [0, 1, 2].forEach((idx) => {
      const [type, name, a, b] = cast[(first + idx) % cast.length];
      const cx = 60 + idx * 100;
      const frame = Math.floor(this.time * 3 + idx) % 2;
      const img = SPR[type].r[frame];
      g.drawImage(img, cx - img.width, 86 - img.height * 2, img.width * 2, img.height * 2);
      this.text(name, cx, 92, '#f4f4f4', 'center');
      this.text(a, cx, 104, '#ffcd75', 'center');
      this.text(b, cx, 114, '#ffcd75', 'center');
    });

    this.text('WASD MOVE  MOUSE ATTACK  P PAUSE', W / 2, 128, '#94b0c2', 'center');
    this.text('1 WAND  2 SWORD  Q/WHEEL SWAP', W / 2, 138, '#94b0c2', 'center');
    this.text('3/E/RMB NOVA  SPACE DASH  M MUTE', W / 2, 148, '#94b0c2', 'center');
    if (Math.floor(this.time * 2) % 2 === 0) this.text('CLICK OR ENTER TO START', W / 2, 161, '#f4f4f4', 'center');
    this.text(`S SHOP & HEROES   HERO: ${this.hero.name}`, W / 2, 171, '#566c86', 'center');
    if (this.best) this.text(`BEST ${this.best}`, W - 4, 2, '#566c86', 'right');
    g.drawImage(ICONS.coin, 4, 2);
    this.text(String(this.save.coins), 14, 2, '#ffcd75');
    g.drawImage(ICONS.gem, 4, 12);
    this.text(String(this.save.gems), 14, 12, '#73eff7');
    if (this.threat) this.text(`THREAT +${this.threat * 5}%`, 4, 22, '#ff004d');
  }

  private drawGameOver() {
    this.dim(0.7);
    this.text('YOU DIED', W / 2, 26, '#ff004d', 'center', 16);
    const rows: [string, string][] = [
      ['SCORE', String(this.score)],
      ['BEST', this.newBest ? `${this.best} NEW!` : String(this.best)],
      ['WAVE', String(this.wave)],
      ['KILLS', String(this.kills)],
      ['ADS WATCHED', String(this.ads.watched)],
      ['LIFE LOST TO ADS', `${Math.round(this.ads.seconds)}s`],
      ['COINS BANKED', `+${this.coins}`],
      ['GEMS FOUND', `+${this.gems}`],
    ];
    rows.forEach(([k, v], idx) => {
      this.text(k, 64, 48 + idx * 12, '#94b0c2');
      this.text(v, W - 64, 48 + idx * 12, idx === 5 ? '#ff004d' : idx === 7 ? '#73eff7' : '#ffcd75', 'right');
    });
    if (!this.ads.blocking && Math.floor(this.time * 2) % 2 === 0) this.text('CLICK OR ENTER FOR THE SHOP', W / 2, 158, '#f4f4f4', 'center');
  }

  private drawShop() {
    const g = this.g;
    this.dim(0.8);
    this.text('SHOP', W / 2, 3, '#ffcd75', 'center', 16);
    g.drawImage(ICONS.gem, 8, 5);
    this.text(String(this.save.gems), 18, 5, '#73eff7');
    g.drawImage(ICONS.coin, W - 12 - String(this.save.coins).length * 8 - 10, 5);
    this.text(String(this.save.coins), W - 12, 5, '#ffcd75', 'right');
    SHOP_TABS.forEach((name, idx) => {
      const cx = W / 4 + (idx * W) / 2;
      const on = idx === this.shopTab;
      this.text(name, cx, 21, on ? '#ffcd75' : '#566c86', 'center');
      if (on) {
        g.fillStyle = '#ffcd75';
        g.fillRect(cx - name.length * 4, 30, name.length * 8, 1);
      }
    });
    const row = (idx: number, name: string, right: string, rightColor: string, icon?: 'coin' | 'gem') => {
      const y = SHOP_Y + idx * SHOP_ROW;
      const sel = idx === this.shopSel;
      if (sel) {
        g.fillStyle = 'rgba(255,205,117,0.15)';
        g.fillRect(8, y - 2, W - 16, SHOP_ROW - 1);
        this.text('>', 10, y, '#ffcd75');
      }
      this.text(name, 20, y, sel ? '#f4f4f4' : '#94b0c2');
      this.text(right, W - 12, y, rightColor, 'right');
      if (icon) g.drawImage(ICONS[icon], W - 12 - right.length * 8 - 10, y);
    };
    let desc: string;
    if (this.shopTab === 0) {
      UPGRADES.forEach((u, idx) => {
        const cost = nextCost(this.save, u);
        if (cost === null) row(idx, u.name, u.costs.length > 1 ? 'MAX' : 'OWNED', '#a7f070');
        else row(idx, u.name, String(cost), cost <= this.save.coins ? '#ffcd75' : '#b13e53', 'coin');
        // One pip per level for multi-level upgrades.
        if (u.costs.length > 1) {
          for (let k = 0; k < u.costs.length; k++) {
            g.fillStyle = k < this.save[u.id] ? '#a7f070' : '#333c57';
            g.fillRect(180 + k * 6, SHOP_Y + idx * SHOP_ROW + 1, 4, 6);
          }
        }
      });
      desc = UPGRADES[this.shopSel].desc;
    } else {
      HEROES.forEach((h, idx) => {
        if (idx === this.save.hero) row(idx, h.name, 'PLAYING', '#a7f070');
        else if (heroOwned(this.save, h)) row(idx, h.name, 'OWNED', '#94b0c2');
        else row(idx, h.name, String(h.gems), h.gems <= this.save.gems ? '#73eff7' : '#b13e53', 'gem');
      });
      const h = HEROES[this.shopSel];
      desc = h.desc;
      // A big preview of the highlighted hero, with their stats.
      const img = HERO_SPRITES[h.id].r[Math.floor(this.time * 3) % 2];
      g.drawImage(img, 120, 82, img.width * 3, img.height * 3);
      this.text(`HP ${h.hp}`, 180, 88, '#f4f4f4');
      this.text(`SPEED ${h.speed}`, 180, 99, '#f4f4f4');
      this.text(`DAMAGE x${h.dmg}`, 180, 110, '#f4f4f4');
    }
    const msg = this.shopMsg.t > 0 ? this.shopMsg : { text: desc, color: '#94b0c2' };
    this.text(msg.text, W / 2, 136, msg.color, 'center');
    g.fillStyle = this.overPlay() ? '#38b764' : '#257179';
    g.fillRect(SHOP_PLAY.x, SHOP_PLAY.y, SHOP_PLAY.w, SHOP_PLAY.h);
    this.text('PLAY', W / 2, SHOP_PLAY.y + 3, '#f4f4f4', 'center');
    if (this.threat) this.text(`THREAT +${this.threat * 5}%: ENEMIES GROW TOO`, W / 2, 166, '#ff004d', 'center');
    else this.text('A/D TAB  W/S PICK  SPACE BUY', W / 2, 166, '#566c86', 'center');
  }
}
