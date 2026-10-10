// The between-runs shop: coins banked from every run buy permanent upgrades, weapons and pets;
// gems unlock new heroes.

export interface Save {
  coins: number;
  gems: number;
  dmg: number;
  hp: number;
  nova: number;
  scatter: number;
  bomb: number;
  spider: number;
  wolf: number;
  dragon: number;
  phoenix: number;
  /** Heroes unlocked with gems (the adventurer is always unlocked). */
  mage: number;
  knight: number;
  achilles: number;
  /** Index into HEROES of the hero you play as. */
  hero: number;
}

export type UpgradeId = 'dmg' | 'hp' | 'nova' | 'scatter' | 'bomb' | 'spider' | 'wolf' | 'dragon' | 'phoenix';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: string;
  /** One entry per level; the upgrade is maxed out when they run out. */
  costs: number[];
}

export const UPGRADES: Upgrade[] = [
  { id: 'dmg', name: 'DAMAGE', desc: '+20% damage with everything', costs: [25, 50, 90, 140, 200] },
  { id: 'hp', name: 'MAX HP', desc: '+15 max HP', costs: [20, 40, 70, 110, 160] },
  { id: 'nova', name: 'NOVA RECHARGE', desc: 'nova recharges 5s faster', costs: [60, 120, 200] },
  { id: 'scatter', name: 'SCATTER WAND', desc: 'weapon (4): fires 3 bolts at once', costs: [80] },
  { id: 'bomb', name: 'BOMBS', desc: 'weapon (5): lobbed bombs that explode', costs: [150] },
  { id: 'spider', name: 'ADOPT A SPIDER', desc: 'pet: bites enemies and webs them', costs: [250] },
  { id: 'wolf', name: 'ADOPT A WOLF', desc: 'pet: fast, pounces on enemies', costs: [300] },
  { id: 'dragon', name: 'ADOPT A DRAGON', desc: 'pet: breathes fire at enemies', costs: [400] },
  { id: 'phoenix', name: 'ADOPT A PHOENIX', desc: 'pet: homing fire + revives you once', costs: [600] },
];

export type HeroId = 'adventurer' | 'mage' | 'knight' | 'achilles';

export interface Hero {
  id: HeroId;
  name: string;
  desc: string;
  /** Gem cost to unlock. */
  gems: number;
  hp: number;
  speed: number;
  dmg: number;
}

export const HEROES: Hero[] = [
  { id: 'adventurer', name: 'ADVENTURER', desc: 'the classic. no tricks', gems: 0, hp: 120, speed: 78, dmg: 1 },
  { id: 'mage', name: 'MAGE', desc: 'piercing magic, blink dash, fast nova', gems: 30, hp: 100, speed: 80, dmg: 1.2 },
  { id: 'knight', name: 'KNIGHT', desc: '200 HP, 1.5x damage, but slow', gems: 50, hp: 200, speed: 60, dmg: 1.5 },
  { id: 'achilles', name: 'ACHILLES', desc: 'immune to hits... except his heel', gems: 200, hp: 100, speed: 84, dmg: 1.3 },
];

const KEY = 'ad-nauseam-save';
const EMPTY: Save = {
  coins: 0,
  gems: 0,
  dmg: 0,
  hp: 0,
  nova: 0,
  scatter: 0,
  bomb: 0,
  spider: 0,
  wolf: 0,
  dragon: 0,
  phoenix: 0,
  mage: 0,
  knight: 0,
  achilles: 0,
  hero: 0,
};

export function loadSave(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Save>;
    const s = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as (keyof Save)[]) {
      if (typeof raw[k] === 'number' && raw[k] >= 0) s[k] = Math.floor(raw[k]);
    }
    if (!HEROES[s.hero] || !heroOwned(s, HEROES[s.hero])) s.hero = 0;
    return s;
  } catch {
    return { ...EMPTY };
  }
}

export function storeSave(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — progress just won't persist */
  }
}

/** Cost of the next level, or null when maxed out. */
export function nextCost(s: Save, u: Upgrade): number | null {
  return u.costs[s[u.id]] ?? null;
}

export function heroOwned(s: Save, h: Hero) {
  return h.id === 'adventurer' || s[h.id] > 0;
}
