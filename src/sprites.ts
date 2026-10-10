// Pixel-art sprites defined as character grids and baked into tiny canvases.

export const PAL: Record<string, string> = {
  k: '#1a1c2c', // outline
  w: '#f4f4f4',
  b: '#d8cfb4', // bone shade
  g: '#94b0c2',
  G: '#566c86',
  d: '#333c57',
  r: '#b13e53',
  R: '#ff004d',
  o: '#ef7d57',
  y: '#ffcd75',
  l: '#a7f070',
  e: '#38b764',
  E: '#257179',
  n: '#29366f',
  u: '#3b5dc9',
  c: '#41a6f6',
  C: '#73eff7',
  p: '#5d275d',
  P: '#8a3f9e',
  m: '#8b5a3c',
  f: '#e8b796',
  i: '#f5a3c7',
};

function build(rows: string[]): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = PAL[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

function flip(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

function whiten(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

const hdCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/**
 * A double-size copy of a sprite (or any canvas), smoothed with Scale2x: staircase edges are rounded
 * off, but no new colours are invented, so it stays pixel art. The game draws these on its 2x canvas;
 * the original 1x canvases keep defining sizes. Cached per source canvas.
 */
export function hd(src: HTMLCanvasElement): HTMLCanvasElement {
  let out = hdCache.get(src);
  if (out) return out;
  const w = src.width;
  const h = src.height;
  const px = new Uint32Array(src.getContext('2d')!.getImageData(0, 0, w, h).data.buffer);
  out = document.createElement('canvas');
  out.width = w * 2;
  out.height = h * 2;
  const g = out.getContext('2d')!;
  const img = g.createImageData(w * 2, h * 2);
  const o = new Uint32Array(img.data.buffer);
  // Off the edge counts as transparent, so outlines get rounded corners too.
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : px[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = px[y * w + x];
      const a = at(x, y - 1);
      const b = at(x + 1, y);
      const c = at(x - 1, y);
      const d = at(x, y + 1);
      const i = y * 2 * w * 2 + x * 2;
      o[i] = c === a && c !== d && a !== b ? a : p;
      o[i + 1] = a === b && a !== c && b !== d ? b : p;
      o[i + w * 2] = d === c && d !== b && c !== a ? c : p;
      o[i + w * 2 + 1] = b === d && b !== a && d !== c ? d : p;
    }
  }
  g.putImageData(img, 0, 0);
  hdCache.set(src, out);
  return out;
}

/** Facing-right frames, mirrored frames and white "hit flash" versions of both. */
export interface SpriteSet {
  r: HTMLCanvasElement[];
  l: HTMLCanvasElement[];
  wr: HTMLCanvasElement[];
  wl: HTMLCanvasElement[];
}

/**
 * Repaints a sprite set's colours (palette key → palette key), for the per-map enemy looks. Works on
 * the baked canvases, then rebuilds the mirrored and white hit-flash frames.
 */
export function recolorSet(set: SpriteSet, map: Record<string, string>): SpriteSet {
  const swap = new Map(Object.entries(map).map(([from, to]) => [hexToInt(PAL[from]), hexToRgb(PAL[to])]));
  const r = set.r.map((src) => {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const to = d[i + 3] ? swap.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) : undefined;
      if (to) [d[i], d[i + 1], d[i + 2]] = to;
    }
    g.putImageData(img, 0, 0);
    return c;
  });
  const l = r.map(flip);
  return { r, l, wr: r.map(whiten), wl: l.map(whiten) };
}

function hexToInt(hex: string) {
  return parseInt(hex.slice(1), 16);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = hexToInt(hex);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function spriteSet(body: string[], legs: string[][]): SpriteSet {
  const r = legs.map((l) => build([...body, ...l]));
  const l = r.map(flip);
  return { r, l, wr: r.map(whiten), wl: l.map(whiten) };
}

const PLAYER_BODY = [
  '......kkkkk.....',
  '.....kmmmmmk....',
  '....kmmmmmmmk...',
  '..rrkrrrrrrrk...',
  '...rkmffkfkfk...',
  '....kmffffffk...',
  '.....kkkkkkk....',
  '...kgguuuuuggk..',
  '..rkfkuuuumkfk..',
  '..rkfkuumuukfk..',
  '..rkfkmuuuukfk..',
  '..rrkmmymmmk....',
  '...rkuukkuuk....',
];

const MAGE_BODY = [
  '......kk........',
  '.....kuuk.......',
  '....kuuyuk......',
  '...kuuuuuuk.....',
  '.kkkkkkkkkkkk...',
  '....kffkffkk....',
  '....kwffffwk....',
  '.....kwwwwk.....',
  '...kuukwwkuuk...',
  '..kfkuuwwuukfk..',
  '..kfkuuuuuukfk..',
  '...kkuuyyuukk...',
  '....kuuuuuuk....',
];

const KNIGHT_BODY = [
  '.....kkkkkk.....',
  '....kgggggGk....',
  '...kgwggggGGk...',
  '...kgkkkkkkGk...',
  '...kggggggGGk...',
  '....kgggggGk....',
  '.....kkkkkk.....',
  '..kkgggggggGkk..',
  '.kGgkgwggggkgGk.',
  '.kGgkggggGGkgGk.',
  '..kkkgggggGkkk..',
  '....kuuuuuuk....',
  '....kgGkkgGk....',
];

const ACHILLES_BODY = [
  '..RRRRRR........',
  '.RRRRRRRR.......',
  '....kyyyyyk.....',
  '...kyyyyyyok....',
  '...kyykffkok....',
  '...kyfkffkfk....',
  '....kyfffyk.....',
  '..rrkkoookkk....',
  '.rrkfkyyyykfk...',
  '.rrkfkyoyyykfk..',
  '.rrkfkyyyyokfk..',
  '..rrkmmmmmmk....',
  '...rkmkmmkmk....',
];

const SKELETON_BODY = [
  '......kkkk......',
  '.....kwwwwk.....',
  '....kwwwwwbk....',
  '....kwRwwRbk....',
  '....kwwwwwbk....',
  '.....kwkkwk.....',
  '......kwwk......',
  '.....kkwwkk.....',
  '....kwkwwkwk....',
  '...kwkwkkwkwk...',
  '...kk.kwwk.kk...',
  '......kwwk......',
  '.....kwkkwk.....',
];

const ZOMBIE_BODY = [
  '......kkkk......',
  '.....keeeek.....',
  '....keeeeeEk....',
  '....keyeeyEk....',
  '....keeeeeEk....',
  '....kekrrkek....',
  '.....keeeek.....',
  '..kkkmmmmmmkkk..',
  '.keeekmmmmkeeek.',
  '.kkkkmmmmmmkkkk.',
  '....kmmmmmmk....',
  '....knnnnnnk....',
  '....knnkknnk....',
];

const SORCERER_BODY = [
  '.......kk.......',
  '......kPPk......',
  '.....kPPPk......',
  '.....kPPPPk.....',
  '....kPyPPPPk....',
  '..kkkkkkkkkkkk..',
  '.....kfffffk....',
  '.....kfkfkfk....',
  '.....kwwwwwk....',
  '....kPkwwwkPk...',
  '...kPPPkwkPPPk..',
  '...kPPPPkPPPPk..',
  '...kPPPPPPPPPk..',
];

const GOBLIN_BODY = [
  '................',
  '................',
  '................',
  '.....kkkkk......',
  '.kk.klllllk.kk..',
  '.kekllllllllek..',
  '..kklyklllykkk..',
  '....klllllllk...',
  '.....kwkkkwk....',
  '....kmmmmmmk....',
  '...klkmmmmklk...',
  '...kk.kmmmk.kk..',
  '......kmymk.....',
];

/** Trolls are bigger than everyone else: 20x20. */
const TROLL_BODY = [
  '.......kkkkkk.......',
  '......kGggggGk......',
  '.....kGggggggGk.....',
  '.....kgyggggygk.....',
  '.....kggggggggk.....',
  '.....kgwkkkkwgk.....',
  '..kkkkkGggggGkkkkk..',
  '.kGgggkkkkkkkkgggGk.',
  'kGgggggggggggggggggk',
  'kgggkggggggggggkgggk',
  'kggk.kggggggggk.kggk',
  'kggk.kggggggggk.kggk',
  'kGGk.kmmmmmmmmk.kGGk',
  '.kk..kmmmmmmmmk..kk.',
  '.....kmmmyymmmk.....',
  '.....kmmmmmmmmk.....',
  '.....kggkkkkggk.....',
];

const REAPER_BODY = [
  '......kkkk......',
  '.....kddddk.....',
  '....kddddddk....',
  '....kdkwwwkdk...',
  '....kdwRwRwdk...',
  '....kdkwwwkdk...',
  '...kddkwkwkddk..',
  '...kdddkkkdddk..',
  '..kdddddddddddk.',
  '..kwkdddddddkwk.',
  '..kkkdddddddkkk.',
  '...kdddddddddk..',
  '...kdddddddddk..',
];

// The Glitch: a blue-screen-of-death figure with a missing-texture head and stray pixels where its arm should be.
const GLITCH_BODY = [
  '....kkkkkkkk....',
  '....kPkPkPkk....',
  '....kkPkPkPk....',
  '....kPCkPCkk....',
  '....kkPkPkPk....',
  '....kPkPkPkk....',
  '.....kkkkkk.....',
  '...kkuuuCuukk...',
  '..kukuuuuuukuk..',
  '..kukuRuuuCkuk.C',
  '..kCkuuuuuuk.kuk',
  '...kkuuuuuRk..kk',
  '....kuuuuuuk....',
];

// The baby dragon has no legs to animate; its two frames are wings up and wings down.
const DRAGON_WINGS_UP = [
  '................',
  '....kk..........',
  '...kPPk.........',
  '...kPPPk..kkkk..',
  '....kPPPkkrrrrk.',
  '.....kPPkrrrkyk.',
  '......kkrrrrrrrk',
  '.....krrrrrrrrk.',
  '..kk.krrooorrk..',
  '.krk.krroooork..',
  '.kRrkkrroooork..',
  '..kRrrrrooorrk..',
  '...kkrrrrrrrk...',
  '.....krk..krk...',
  '.....krk..krk...',
  '....kkk..kkk....',
];

const DRAGON_WINGS_DOWN = [
  '................',
  '................',
  '................',
  '..........kkkk..',
  '.........krrrrk.',
  '........krrrkyk.',
  '..kkkkkkkrrrrrrk',
  '.kPPPPPPkrrrrrk.',
  '..kPPPPkrooorrk.',
  '.k.kkPkrroooork.',
  '.krkkkkrroooork.',
  '..kRrrrrooorrk..',
  '...kkrrrrrrrk...',
  '.....krk..krk...',
  '.....krk..krk...',
  '....kkk..kkk....',
];

/**
 * The boss: a 32x32 bloodshot eyeball, generated rather than hand-drawn. In game the iris is drawn in
 * code so it can follow you around; `iris` bakes one in for the ad icon.
 */
function eyeball(frame: number, iris = false): string[] {
  const n = 32;
  const c = 15.5;
  const r = 15.5;
  const px = Array.from({ length: n }, (_, y) =>
    Array.from({ length: n }, (_, x): string => {
      const d = Math.hypot(x - c, y - c);
      if (d > r) return '.';
      if (d > r - 1) return 'k';
      // Shade the lower-right edge for a bit of roundness.
      if (d > r - 3 && x + y > n + 6) return 'g';
      return 'w';
    }),
  );
  // Veins creep in from the rim; on the second frame they reach a little further, so they pulse.
  [0.3, 1.2, 2.0, 2.9, 3.7, 4.6, 5.5].forEach((a, idx) => {
    const len = 5 + (idx % 3) + frame * 2;
    for (let s = 0; s < len; s++) {
      const rr = r - 2 - s;
      const w = Math.sin(s * 1.7 + a * 3) * 0.9;
      const x = Math.round(c + Math.cos(a) * rr - Math.sin(a) * w);
      const y = Math.round(c + Math.sin(a) * rr + Math.cos(a) * w);
      if (px[y]?.[x] === 'w' || px[y]?.[x] === 'g') px[y][x] = s > len - 3 ? 'i' : 'r';
    }
  });
  if (iris) {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - c - 3, y - c);
        if (d < 3) px[y][x] = 'k';
        else if (d < 5) px[y][x] = 'c';
        else if (d < 7) px[y][x] = 'u';
      }
    }
    px[12][17] = 'w';
    px[12][18] = 'w';
  }
  return px.map((row) => row.join(''));
}

/** Swaps palette keys, e.g. to turn the red baby dragon into the player's blue pet. */
function recolor(rows: string[], map: Record<string, string>): string[] {
  return rows.map((row) => [...row].map((ch) => map[ch] ?? ch).join(''));
}

const PET_DRAGON_COLOURS = { r: 'u', R: 'c', o: 'C', P: 'e' };

const SPIDER_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '..k.kPPPPPPk.k..',
  '.k.kPPPPPPPPk.k.',
  '.k.kPPPPPRPRk.k.',
  'k.k.kPPPPPPk.k.k',
  'k.k..kkkkkk..k.k',
  '.k............k.',
];

const SPIDER_B = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '.k..kPPPPPPk..k.',
  'k.kkPPPPPPPPkk.k',
  'k..kPPPPPRPRk..k',
  '.k.kkPPPPPPkk.k.',
  '..k..kkkkkk..k..',
  '..k..........k..',
];

const WOLF_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '............kk..',
  '...........kGk..',
  '.k........kggkk.',
  'kgk......kggygk.',
  '.kgkkkkkkkgggggk',
  '..kgggggggggkkk.',
  '..kggggggggGk...',
  '..kGgggggggGk...',
  '...kGkkkkkGk....',
  '...kgk..kgk.....',
  '..kk...kk.......',
];

const WOLF_B = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '............kk..',
  '...........kGk..',
  '..........kggkk.',
  '.k.......kggygk.',
  'kgkkkkkkkkgggggk',
  '.kgggggggggkkkk.',
  '..kggggggggGk...',
  '..kGgggggggGk...',
  '..kGkkkkkkkGk...',
  '.kgk......kgk...',
  '.kk.......kk....',
];

const PHOENIX_A = [
  '................',
  '.y...........y..',
  '.oy.........yo..',
  '.Roy.......yoR..',
  '..Royy.kk.yyoR..',
  '...Rooykykooo...',
  '....RooyyooR....',
  '.....kooook.....',
  '.....kyooyk.....',
  '......kook......',
  '.....RoyyoR.....',
  '....R.oRRo.R....',
  '.......yo.......',
  '......y..y......',
  '................',
  '................',
];

const PHOENIX_B = [
  '................',
  '................',
  '................',
  '................',
  '.......kk.......',
  '......kyok......',
  '..RoooykyoooR...',
  '.RooyyoooyyooR..',
  '..Ry.kyooyk.yR..',
  '.y...kooook..y..',
  '......kook......',
  '.....RoyyoR.....',
  '....R.oRRo.R....',
  '.......yo.......',
  '......y..y......',
  '................',
];

/** Boss: one of the two giant bats (24x16). */
const BAT_UP = [
  'kk....................kk',
  'kPk..................kPk',
  'kPPk.....k....k.....kPPk',
  'kpPPk....kk..kk....kPPpk',
  '.kpPPk...kpkkpk...kPPpk.',
  '.kppPPk.kppppppk.kPPppk.',
  '..kppPPkpRppppRpkPPppk..',
  '..kpppPkppppppppkPpppk..',
  '...kpppkpwpkkpwpkpppk...',
  '...kkpkkkppppppkkkpkk...',
  '.....k..kppppppk..k.....',
  '.........kppppk.........',
  '..........kppk..........',
  '...........kk...........',
  '........................',
  '........................',
];

const BAT_DOWN = [
  '........................',
  '........................',
  '........................',
  '.........k....k.........',
  '.........kk..kk.........',
  '........kpkkkkpk........',
  '.......kpRppppRpk.......',
  '..kkkkkpppppppppkkkkk...',
  '.kPPPPkpwpkkpwpkPPPPPk..',
  'kPPPpkkppppppppkkpPPPPk.',
  'kPpkk..kppppppk..kkpPPk.',
  'kPk.....kppppk.....kkPk.',
  'kk.......kppk........kk.',
  '..........kk............',
  '........................',
  '........................',
];

/** Boss: the rabid bear (24x17), foaming at the mouth. */
const BEAR_BODY = [
  '................kk.kk...',
  '...............kmmkmmk..',
  '..............kmmmmmmmk.',
  '.............kmmmmRmmmk.',
  '.............kmmmmmmmffk',
  '..kkkkkkkkkkkkmmmmmmmkkk',
  '.kmmmmmmmmmmmmmmmmkwlwk.',
  'kmmmmmmmmmmmmmmmmmmkwk..',
  'kmmmmmmmmmmmmmmmmmmmk...',
  'kmmmmmmmmmmmmmmmmmmmk...',
  'kmmmmmmmmmmmmmmmmmmmk...',
  'kmmmmmbbbbbbbmmmmmmk....',
  '.kmmmmmmmmmmmmmmmmmk....',
  '.kmmmmkkkkkkkkmmmmk.....',
];

/** Desert sandworm (16x20): bursts out of the ground mouth-first. */
const WORM_LOWER = [
  '...kooooooyk....',
  '...kmmmmmmmk....',
  '...kooooooyk....',
  '...kooooooyk....',
  '...kmmmmmmmk....',
  '...kooooooyk....',
  '...kooooooyk....',
  '...kmmmmmmmk....',
  '...kooooooyk....',
  '...kooooooyk....',
  '..kkooooooykk...',
  '.kmmkkkkkkkmmk..',
];
const WORM_OPEN = [
  '....kkkkkkk.....',
  '...kwkwkwkwk....',
  '..kwRRRRRRRwk...',
  '..kRRkkkkkRRk...',
  '..kwRRRRRRRwk...',
  '...kwkwkwkwk....',
  '...koooooook....',
  '...kmmmmmmmk....',
  ...WORM_LOWER,
];
const WORM_SHUT = [
  '................',
  '................',
  '.....kkkkk......',
  '....kooooyk.....',
  '...kowkwkwyk....',
  '...kkkkkkkkk....',
  '...koooooook....',
  '...kmmmmmmmk....',
  ...WORM_LOWER,
];

/** Slime land slime: a wobbly blob; the second frame is squashed mid-hop. */
const SLIME_A = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '......kkkk......',
  '....kkllllkk....',
  '...kllwwlllek...',
  '..kllwwllllllk..',
  '..klllkllkllek..',
  '..kllllllllleek.',
  '.kllllllllleeek.',
  '.keeeeeeeeeeeek.',
  '..kkkkkkkkkkkk..',
  '................',
];
const SLIME_B = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkllwwllkk...',
  '.kklllkllklllkk.',
  'klllllllllllleek',
  'kllllllllllleeek',
  'keeeeeeeeeeeeeek',
  '.kkkkkkkkkkkkkk.',
  '................',
];

/** Enemy wolf: the pet's sprite, darker and with a red eye, trimmed to its height (16x11). */
const WOLF_FOE = { g: 'G', G: 'd', y: 'R' };

/** Imp (wave 4+): a little winged devil; the two frames are wings up and wings down. */
const IMP_LOWER = [
  '...krkrRRrkrk...',
  '...kk.krrk.kk...',
  '.kk...krrk......',
  '.krk.kr..rk.....',
  '..kk.kk..kk.....',
];
const IMP_UP = [
  '.....b....b.....',
  '.kk..kb..bk..kk.',
  'kppk.krrrrk.kppk',
  'kpppkrykrykkpppk',
  '.kppkrrrrrkkppk.',
  '..kpkrrwwrkkpk..',
  '...kkkrrrrkkk...',
  '....krrrrrrk....',
  ...IMP_LOWER,
];
const IMP_DOWN = [
  '.....b....b.....',
  '.....kb..bk.....',
  '.....krrrrk.....',
  '....krykrykk....',
  '.kkkkrrrrrkkkkk.',
  'kpppkrrwwrkpppk.',
  'kppk.krrrrk.kppk',
  '.kk.krrrrrrk.kk.',
  ...IMP_LOWER,
];

/** Thunder rat (wave 3+): small, yellow, with a lightning-bolt tail. */
const RAT_BODY = [
  '.kk.............',
  'kyyk......k.k...',
  '.kyyk....kokok..',
  '..kyk..kkkyyyyk.',
  '.kyk..kyyyyykyRk',
  '.kyykkyoyoyyyyik',
  '..kkyyoyoyyyyk..',
  '....kyyyyyyyk...',
];

export const SPR = {
  player: spriteSet(PLAYER_BODY, [
    ['....kmk..kmk....', '....kmk..kmk....', '...kkkk..kkkk...'],
    ['....kmk..kmk....', '...kmk....kmk...', '...kkk....kkk...'],
  ]),
  skeleton: spriteSet(SKELETON_BODY, [
    ['.....kw..wk.....', '.....kw..wk.....', '....kkk..kkk....'],
    ['.....kw..wk.....', '....kw....wk....', '....kk....kk....'],
  ]),
  zombie: spriteSet(ZOMBIE_BODY, [
    ['....knk..knk....', '....kek..kek....', '...kkkk..kkkk...'],
    ['....knk..knk....', '...kek....kek...', '...kkk....kkk...'],
  ]),
  sorcerer: spriteSet(SORCERER_BODY, [
    ['...kPPPPPPPPPk..', '..kPPPPPPPPPPPk.', '..kkkkkkkkkkkkk.'],
    ['...kPPPPPPPPPk..', '...kPPPPPPPPPPk.', '...kkkkkkkkkkk..'],
  ]),
  goblin: spriteSet(GOBLIN_BODY, [
    ['.....kl..lk.....', '.....kl..lk.....', '....kkk..kkk....'],
    ['.....kl..lk.....', '....kl....lk....', '....kk....kk....'],
  ]),
  troll: spriteSet(TROLL_BODY, [
    ['.....kggk..kggk.....', '.....kggk..kggk.....', '....kkkkk..kkkkk....'],
    ['.....kggk..kggk.....', '....kggk....kggk....', '....kkkk....kkkk....'],
  ]),
  reaper: spriteSet(REAPER_BODY, [
    ['...kdddddddddk..', '...kdkddkddkdk..', '...k.k..k..k.k..'],
    ['...kdddddddddk..', '..kdkddkddkdk...', '..k.k..k..k.k...'],
  ]),
  glitch: spriteSet(GLITCH_BODY, [
    ['.....ku..uk.....', '.....ku..uk.....', '....kkk..kkk....'],
    ['.....ku..uk.....', '....ku....uk....', '....kk....kk....'],
  ]),
  dragon: spriteSet([], [DRAGON_WINGS_UP, DRAGON_WINGS_DOWN]),
  eyeball: spriteSet([], [eyeball(0), eyeball(1)]),
  petDragon: spriteSet([], [recolor(DRAGON_WINGS_UP, PET_DRAGON_COLOURS), recolor(DRAGON_WINGS_DOWN, PET_DRAGON_COLOURS)]),
  spider: spriteSet([], [SPIDER_A, SPIDER_B]),
  petWolf: spriteSet([], [WOLF_A, WOLF_B]),
  wolf: spriteSet([], [recolor(WOLF_A.slice(5), WOLF_FOE), recolor(WOLF_B.slice(5), WOLF_FOE)]),
  imp: spriteSet([], [IMP_UP, IMP_DOWN]),
  rat: spriteSet(RAT_BODY, [['.....kk...kk....'], ['....kk.....kk...']]),
  phoenix: spriteSet([], [PHOENIX_A, PHOENIX_B]),
  mage: spriteSet(MAGE_BODY, [
    ['....kuuuuuuk....', '...kuuuuuuuuk...', '...kkkkkkkkkk...'],
    ['....kuuuuuuk....', '....kuuuuuuuuk..', '....kkkkkkkkkk..'],
  ]),
  knight: spriteSet(KNIGHT_BODY, [
    ['....kgk..kGk....', '....kgk..kGk....', '...kkkk..kkkk...'],
    ['....kgk..kGk....', '...kgk....kGk...', '...kkk....kkk...'],
  ]),
  achilles: spriteSet(ACHILLES_BODY, [
    ['....kfk..kfk....', '....kmk..kmk....', '...kkkk..kkkk...'],
    ['....kfk..kfk....', '...kmk....kmk...', '...kkk....kkk...'],
  ]),
  bat: spriteSet([], [BAT_UP, BAT_DOWN]),
  worm: spriteSet([], [WORM_OPEN, WORM_SHUT]),
  slime: spriteSet([], [SLIME_A, SLIME_B]),
  bear: spriteSet(BEAR_BODY, [
    ['.kmmk.kmmk...kmmk.kmmk..', '.kmmk.kmmk...kmmk.kmmk..', '.kkkk.kkkk...kkkk.kkkk..'],
    ['..kmmk.kmmk.kmmk.kmmk...', '.kmmk...kmmkkmmk...kmmk.', '.kkkk...kkkkkkkk...kkkk.'],
  ]),
};

export const HEART = build([
  '.kk.kk.',
  'krwkrrk',
  'krrrrrk',
  'krrrrrk',
  '.krrrk.',
  '..krk..',
  '...k...',
]);

export const ICONS = {
  player: SPR.player.r[0],
  skeleton: SPR.skeleton.r[0],
  zombie: SPR.zombie.r[0],
  sorcerer: SPR.sorcerer.r[0],
  goblin: SPR.goblin.r[0],
  troll: SPR.troll.r[0],
  reaper: SPR.reaper.r[0],
  glitch: SPR.glitch.r[0],
  dragon: SPR.dragon.r[0],
  eyeball: build(eyeball(0, true)),
  bat: SPR.bat.r[0],
  bear: SPR.bear.r[0],
  worm: SPR.worm.r[0],
  slime: SPR.slime.r[0],
  wolf: SPR.wolf.r[0],
  imp: SPR.imp.r[0],
  rat: SPR.rat.r[0],
  gem: build([
    '..kkkk..',
    '.kCwcck.',
    'kCwCccuk',
    'kcCcccuk',
    '.kcccuk.',
    '..kcuk..',
    '...kk...',
  ]),
  heart: HEART,
  potion: build([
    '...kk...',
    '...gg...',
    '..kggk..',
    '.krrrrk.',
    'krrwrrrk',
    'krrrrrrk',
    'krrrrrrk',
    '.kkkkkk.',
  ]),
  brain: build([
    '.kkkkkk.',
    'kiiwiiik',
    'kiikiiik',
    'kiiikiik',
    '.kiiiik.',
    '..kkkk..',
  ]),
  coin: build([
    '..kkkk..',
    '.kyyyyk.',
    'kyywyyyk',
    'kyyoyyyk',
    'kyyoyyyk',
    'kyyyyyyk',
    '.kyyyyk.',
    '..kkkk..',
  ]),
  cookie: build([
    '..kkkk..',
    '.kmomomk',
    'kmkmmmmk',
    'kmmmmkmk',
    'kmmkmmmk',
    'kommmmok',
    '.kmmkmk.',
    '..kkkk..',
  ]),
};

export type IconName = keyof typeof ICONS;
