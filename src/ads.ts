// The whole point of the game: every kill earns you an ad, and every ad fights back.

import { ICONS, hd, type IconName } from './sprites';
import { sfx } from './audio';

export type AdSource =
  | 'skeleton'
  | 'zombie'
  | 'sorcerer'
  | 'goblin'
  | 'troll'
  | 'reaper'
  | 'glitch'
  | 'dragon'
  | 'eyeball'
  | 'bat'
  | 'bear'
  | 'worm'
  | 'slime'
  | 'wolf'
  | 'madman'
  | 'imp'
  | 'rat'
  | 'premium'
  | 'death'
  | 'bonus';

type Kind =
  | 'countdown'
  | 'runaway'
  | 'tiny'
  | 'confirm'
  | 'survey'
  | 'cookie'
  | 'loading'
  | 'multix'
  | 'double'
  | 'storm'
  | 'minigame'
  | 'hide'
  | 'captcha'
  | 'terms'
  | 'slider';

interface Creative {
  tags: AdSource[];
  headline: string;
  body: string;
  cta: string;
  icon: IconName;
  fine: string;
}

const ANY: AdSource[] = ['skeleton', 'zombie', 'sorcerer', 'goblin', 'troll', 'reaper', 'glitch', 'dragon', 'eyeball', 'bat', 'bear', 'worm', 'slime', 'wolf', 'madman', 'imp', 'rat', 'bonus'];

const CREATIVES: Creative[] = [
  { tags: ['skeleton'], headline: 'HOT SKELETONS IN YOUR AREA', body: "They're 2 metres away and ready to RATTLE.", cta: 'MEET THEM', icon: 'skeleton', fine: '*Skeletons may be armed. And dangerous. Mostly armed.' },
  { tags: ['skeleton'], headline: 'BONE DENSITY+', body: '9 out of 10 skeletons recommend it. The 10th fell apart.', cta: 'BUY 3 GET 0 FREE', icon: 'potion', fine: 'Not evaluated by the Royal Guild of Apothecaries.' },
  { tags: ['skeleton'], headline: 'YOU KILLED A SKELETON!', body: 'Now try our new game SKELETON KILLER 2: Bone Again.', cta: 'INSTALL', icon: 'skeleton', fine: 'Contains in-app purchases. And in-app skeletons.' },
  { tags: ['zombie'], headline: 'ZOMBIES HATE HIM!', body: 'Local hero discovers one weird trick to keep his brain.', cta: 'LEARN TRICK', icon: 'player', fine: 'The trick is running. The trick is always running.' },
  { tags: ['zombie'], headline: 'BRAINZ', body: 'The dating app for the undead. Find someone who loves you for your brain.', cta: 'SWIPE RIGHT', icon: 'brain', fine: 'Matches may attempt to eat you on the first date.' },
  { tags: ['zombie'], headline: 'SLOW? TIRED? DEAD?', body: 'Try ZOMBIE ENERGY. Now with 40% more moaning.', cta: 'ORDER NOW', icon: 'zombie', fine: 'Side effects include decay, shuffling and a craving for grey matter.' },
  { tags: ['sorcerer'], headline: 'BECOME A SORCERER FROM HOME', body: 'Earn 5,000 gold a week! Necromancers HATE this.', cta: 'START NOW', icon: 'sorcerer', fine: 'Earnings not typical. Neither is having a soul afterwards.' },
  { tags: ['sorcerer'], headline: 'ROBES -90% OFF', body: 'Only 3 left in stock! Offer ends when you blink.', cta: 'BUY NOW', icon: 'sorcerer', fine: 'Hat sold separately. Pointy hat sold very separately.' },
  { tags: ['sorcerer'], headline: 'SUMMONING SALE!', body: 'Summon 2 skeletons, get a zombie absolutely FREE.', cta: 'CLAIM DEAL', icon: 'skeleton', fine: 'Summoned minions are non-refundable.' },
  { tags: ['goblin'], headline: 'GOBLIN-MART', body: 'Everything 1 gold! (Prices may be stabbed.)', cta: 'SHOP NOW', icon: 'goblin', fine: 'All sales final. All daggers pointy.' },
  { tags: ['goblin'], headline: 'GET RICH QUICK', body: 'This goblin made 9,000 gold in a week by running away a lot.', cta: 'LEARN HOW', icon: 'coin', fine: 'Mostly by robbing you, specifically.' },
  { tags: ['goblin'], headline: 'CARDIO FOR GOBLINS', body: 'Stab. Run. Repeat. Join 10,000 goblins getting fit!', cta: 'JOIN FREE', icon: 'goblin', fine: 'Membership auto-renews into a lifetime of goblinhood.' },
  { tags: ['troll'], headline: 'TOO BIG FOR YOUR BRIDGE?', body: 'Troll-sized bridges, now in stone, extra-stone and stone.', cta: 'BOOK A VIEWING', icon: 'troll', fine: 'Tolls may apply. Trolls definitely apply.' },
  { tags: ['troll'], headline: 'READ THE COMMENTS', body: 'You will NOT believe what this troll said about your build.', cta: 'SEE COMMENTS', icon: 'troll', fine: 'Do not feed.' },
  { tags: ['troll'], headline: 'CLUB MEMBERSHIP', body: 'The only gym where you can bring your own club.', cta: 'SIGN UP', icon: 'troll', fine: 'Ground damage is billed separately.' },
  { tags: ['reaper'], headline: 'LIFE INSURANCE', body: 'Get a quote before your quote gets you.', cta: 'GET COVERED', icon: 'reaper', fine: 'Policy expires on death.' },
  { tags: ['reaper'], headline: 'YOUR TIME IS ALMOST UP!', body: '...on this limited offer. What did you think we meant?', cta: 'CLAIM NOW', icon: 'reaper', fine: 'Both meanings apply.' },
  { tags: ['reaper'], headline: 'SCYTHE SHARPENING', body: 'Same-day service. Ask for Grim.', cta: 'BOOK NOW', icon: 'reaper', fine: 'Turnaround time: eternal.' },
  { tags: ['dragon'], headline: 'ADOPT A BABY DRAGON', body: 'So cute! Only slightly flammable!', cta: 'ADOPT NOW', icon: 'dragon', fine: 'Home insurance not included. Home not included afterwards.' },
  { tags: ['dragon'], headline: 'HOT SINGLES', body: 'No, really. They are on fire. Please send water.', cta: 'SEND WATER', icon: 'dragon', fine: 'Water will be converted to steam.' },
  { tags: ['dragon'], headline: 'BREATH MINTS', body: 'Rated #1 by baby dragons and their victims.', cta: 'BUY NOW', icon: 'dragon', fine: 'Mints may ignite.' },
  { tags: ['eyeball'], headline: 'LASER EYE SURGERY', body: 'You just had some! That will be 400 gold.', cta: 'PAY NOW', icon: 'eyeball', fine: 'Results may include holes in you.' },
  { tags: ['eyeball'], headline: 'WE SAW YOU LOOKING', body: 'Based on your recent interest in being lasered, you may also like: MORE LASERS.', cta: 'SEE MORE', icon: 'eyeball', fine: 'We are always watching. It is in the terms.' },
  { tags: ['eyeball'], headline: 'EYE DROPS', body: 'For tired, dry, gigantic floating eyes.', cta: 'BUY 1000', icon: 'eyeball', fine: 'Do not apply while it is firing.' },
  { tags: ['eyeball'], headline: 'SPONSORED BEAM', body: 'This laser was brought to you by our sponsors. And so is this ad.', cta: 'THANK THEM', icon: 'eyeball', fine: 'Every hit is monetised. You agreed to this.' },
  { tags: ['bat'], headline: 'VAMPIRE SPEED DATING', body: 'Meet singles who are DYING to meet you. Literally.', cta: 'BITE NOW', icon: 'bat', fine: 'Daytime dates not available.' },
  { tags: ['bat'], headline: 'NIGHT VISION GOGGLES', body: 'See like a bat! (Bats cannot actually see. Sorry.)', cta: 'BUY BLIND', icon: 'bat', fine: 'Echolocation sold separately.' },
  { tags: ['bat'], headline: 'GUANO GOLD', body: 'Premium bat fertiliser. Our product really is the bomb.', cta: 'SMELL IT', icon: 'bat', fine: 'Please do not smell it.' },
  { tags: ['bear'], headline: 'RABIES SHOTS', body: 'You probably need one. Book in the next 10 seconds!', cta: 'BOOK NOW', icon: 'bear', fine: 'Foaming at the mouth is NOT a free consultation.' },
  { tags: ['bear'], headline: 'BEAR HUGS DELIVERED', body: 'Same-day delivery, straight to your face.', cta: 'ORDER HUG', icon: 'bear', fine: 'Hugs are non-consensual and non-refundable.' },
  { tags: ['bear'], headline: 'HONEY SUBSCRIPTION', body: 'This bear tried it and went absolutely FERAL.', cta: 'SUBSCRIBE', icon: 'bear', fine: 'Bear not responsible for its own actions.' },
  { tags: ['glitch'], headline: 'YOUR PC HAS 1 VIRUS', body: 'It just tried to stab you. Scan now with GLITCHGUARD PRO.', cta: 'SCAN NOW', icon: 'glitch', fine: 'GlitchGuard Pro may itself be a virus.' },
  { tags: ['glitch'], headline: 'ERR0R 0x0000AD', body: 'Th1s ad could n0t be l0aded. Here is an ad ab0ut that.', cta: 'RETRY', icon: 'glitch', fine: 'Retrying will load another ad. Always.' },
  { tags: ['glitch'], headline: 'LAG? FROZEN? STUCK?', body: 'Upgrade to UNLIMITED FRAMES. Movement sold separately.', cta: 'UPGRADE', icon: 'glitch', fine: 'Frames per second not included.' },
  { tags: ['worm'], headline: 'DESERT REAL ESTATE', body: 'Beachfront property with NO sea and LOTS of worm.', cta: 'BUY LAND', icon: 'worm', fine: 'Ground may open up and eat you. Not a defect.' },
  { tags: ['worm'], headline: 'WORM FACIAL', body: 'Exfoliate with 100% organic sandblasting.', cta: 'BOOK SPA', icon: 'worm', fine: 'Face not guaranteed to remain attached.' },
  { tags: ['worm'], headline: 'TIRED OF THE GROUND?', body: 'Upgrade to FLOOR+. Now with 90% fewer worms.', cta: 'UPGRADE', icon: 'worm', fine: '10% worm content is industry standard.' },
  { tags: ['slime'], headline: 'SLIME SKINCARE', body: 'Glowing skin in 3 days! (It is the slime glowing.)', cta: 'GET GLOWING', icon: 'slime', fine: 'Do not apply to open wounds. Or closed ones.' },
  { tags: ['slime'], headline: 'STUCK? WE CAN HELP', body: 'Our lawyers specialise in slime-related accidents.', cta: 'CALL NOW', icon: 'slime', fine: 'No win, no fee. Mostly no win.' },
  { tags: ['slime'], headline: 'ADOPT A SLIME', body: 'Low maintenance! Eats anything! Including you!', cta: 'ADOPT', icon: 'slime', fine: 'Slime will not fit in a normal home. Or a normal anything.' },
  { tags: ['wolf'], headline: 'LONELY? JOIN A PACK', body: 'Wolves near you are looking for a new member. Bring snacks. Be snacks.', cta: 'JOIN PACK', icon: 'wolf', fine: 'Pack dues payable in limbs.' },
  { tags: ['wolf'], headline: 'HOWL-O-GRAM', body: 'Send a singing wolf to someone you love! They will never forget it.', cta: 'SEND ONE', icon: 'wolf', fine: 'They will also never stop running.' },
  { tags: ['wolf'], headline: 'KIBBLE RECALL', body: 'Our Big Bad Kibble may contain traces of grandma.', cta: 'CHECK BATCH', icon: 'wolf', fine: 'Red hoods sold separately.' },
  { tags: ['madman'], headline: 'HE WATCHED 10,000 ADS', body: 'Now he lives in a dungeon and throws phones. Watch ad 10,001 to find out why!', cta: 'WATCH NEXT', icon: 'madman', fine: 'This could be you. Keep watching.' },
  { tags: ['madman'], headline: 'TINFOIL HATS 2 FOR 1', body: 'Blocks 100% of ads*. Doctors are BAFFLED.', cta: 'BUY 2', icon: 'madman', fine: '*Does not block ads.' },
  { tags: ['madman'], headline: 'ARE YOU STILL WATCHING?', body: 'He is. He has been since 2009. Please help him.', cta: 'YES', icon: 'madman', fine: 'Pressing YES plays another ad.' },
  { tags: ['imp'], headline: 'IMP-ROVE YOUR LIFE', body: 'Small, red and full of bad ideas: the life coach for you.', cta: 'GET COACHED', icon: 'imp', fine: 'Sessions held in a lake of fire.' },
  { tags: ['imp'], headline: 'MISCHIEF INSURANCE', body: 'Imps broke your stuff? Of course they did. They broke ours too.', cta: 'CLAIM', icon: 'imp', fine: 'All claims are processed by imps.' },
  { tags: ['imp'], headline: 'SPICY WINGS', body: 'Fresh from the underworld. 100% real imp.', cta: 'ORDER', icon: 'imp', fine: 'Allergens: brimstone, sulfur, malice.' },
  { tags: ['rat'], headline: 'GOTTA ZAP EM ALL', body: 'Collect all 1 thunder rats! Booster packs out now.', cta: 'BUY PACKS', icon: 'rat', fine: 'Packs contain no rats. Rats contain thunder.' },
  { tags: ['rat'], headline: 'FREE ELECTRICITY', body: 'Power your whole home with ONE angry rat. Energy firms hate it.', cta: 'GO GREEN', icon: 'rat', fine: 'Rat may object. Rat will object.' },
  { tags: ['rat'], headline: 'PEST CONTROL', body: 'Thunder rats? We will be right there. From a safe distance.', cta: 'CALL NOW', icon: 'rat', fine: 'Technician is wearing rubber everything.' },
  { tags: ANY, headline: 'DOWNLOAD MORE HP', body: '100% legit. No viruses. Probably.', cta: 'DOWNLOAD', icon: 'heart', fine: 'May contain viruses.' },
  { tags: ANY, headline: 'CONGRATULATIONS!!!', body: 'You are the 1,000,000th hero! Claim your FREE sword now!', cta: 'CLAIM PRIZE', icon: 'coin', fine: 'You are also the 999,999th and 1,000,001st hero.' },
  { tags: ANY, headline: 'YOUR PC HAS (3) CURSES', body: "Scan now with HexDefender PRO before it's too late.", cta: 'SCAN NOW', icon: 'sorcerer', fine: 'HexDefender PRO is the curse.' },
  { tags: ANY, headline: 'ONLY 1% CAN BEAT LEVEL 2', body: 'Are YOU smart enough? Gameplay not representative.', cta: 'PLAY FREE', icon: 'player', fine: 'Actual game is a slot machine.' },
  { tags: ANY, headline: 'COFFIN INSURANCE', body: "Because, let's be honest, you'll probably be back.", cta: 'GET A QUOTE', icon: 'zombie', fine: 'Does not cover resurrection-related damages.' },
  { tags: ANY, headline: 'POTION SUBSCRIPTION', body: 'One potion a month for just 12 easy payments of 99 gold.', cta: 'SUBSCRIBE', icon: 'potion', fine: 'Cancel any time by visiting our office in the Underworld.' },
  { tags: ['premium'], headline: 'PAYMENT DECLINED', body: 'The Bank of Bones refused your card. Please enjoy this ad instead.', cta: 'TRY AGAIN', icon: 'coin', fine: 'Ad-free tier temporarily unavailable. Forever.' },
  { tags: ['death'], headline: 'YOU DIED!', body: 'Revive now for just $4.99! (Revival not included.)', cta: 'REVIVE', icon: 'heart', fine: 'Death is a premium feature.' },
  { tags: ['bonus'], headline: 'THANKS FOR CLICKING!', body: 'You liked that ad so much, here is ANOTHER one!', cta: 'MORE ADS', icon: 'coin', fine: 'Your engagement has been noted and sold.' },
];

const THEMES = ['t-hot', 't-toxic', 't-royal', 't-gold', 't-cool', 't-system'];
const TITLES = ['SPONSORED', 'ADVERTISEMENT', 'PROMOTED', 'A WORD FROM OUR SPONSORS', 'RECOMMENDED FOR YOU'];
const QUIPS = ['NOPE!', 'TOO SLOW', 'ALMOST!', 'LOL', 'NICE TRY', 'SO CLOSE', 'MISSED ME'];
const TERMS = [
  'By looking at this ad you agree to look at more ads.',
  'Your soul is licensed, not sold. We may revoke it at any time.',
  'Skeletons are independent contractors and not our employees.',
  'Any loot you find belongs to us. Any damage you take belongs to you.',
  'You waive the right to complain about goblins.',
  'We may share your data with sorcerers, necromancers and their cats.',
  'Clicking X does not constitute closing the ad.',
  'This agreement is governed by the laws of the Underworld.',
  'Refunds are available in the form of more ads.',
  'You agree that you have read this, even though nobody has.',
  'Dying does not cancel your subscription.',
  'We reserve the right to add more terms at any time. Like now.',
];
const COOKIE_TOGGLES = ['Legitimate interest', 'Soul tracking', 'Bone analytics', 'Necromancy partners', 'Selling data to sorcerers'];

/** [kind, weight, ad level it unlocks at]. The level is the wave number, so ads get nastier as you go. */
const WEIGHTS: [Kind, number, number][] = [
  ['countdown', 3, 1],
  ['confirm', 2, 1],
  ['tiny', 2, 1],
  ['runaway', 3, 2],
  ['survey', 2, 3],
  ['multix', 2, 3],
  ['cookie', 1.5, 4],
  ['loading', 1.5, 4],
  ['double', 1, 5],
  ['storm', 1, 6],
  ['minigame', 2, 2],
  ['slider', 2, 2],
  ['hide', 2, 3],
  ['captcha', 1.5, 3],
  ['terms', 1.5, 4],
];

export type PerkId = 'rapid' | 'power' | 'swift' | 'heal' | 'nova' | 'slow' | 'weak' | 'jam' | 'drain' | 'reverse';

/** Some ads secretly reward you for sitting through them; others secretly downgrade you. */
export const PERKS: Record<PerkId, { good: boolean; desc: string; hud: string; secs: number }> = {
  rapid: { good: true, desc: '2x FIRE RATE FOR 20s', hud: 'RAPID FIRE', secs: 20 },
  power: { good: true, desc: '2x DAMAGE FOR 20s', hud: '2x DAMAGE', secs: 20 },
  swift: { good: true, desc: '+40% SPEED FOR 20s', hud: 'SPEED UP', secs: 20 },
  heal: { good: true, desc: '+30 HP', hud: '', secs: 0 },
  nova: { good: true, desc: 'INSTANT NOVA RECHARGE', hud: '', secs: 0 },
  slow: { good: false, desc: '-35% SPEED FOR 15s', hud: 'SLOWED', secs: 15 },
  weak: { good: false, desc: 'HALF DAMAGE FOR 15s', hud: 'WEAKENED', secs: 15 },
  jam: { good: false, desc: 'HALF FIRE RATE FOR 15s', hud: 'JAMMED', secs: 15 },
  drain: { good: false, desc: '-20 HP', hud: '', secs: 0 },
  reverse: { good: false, desc: 'REVERSED CONTROLS FOR 8s', hud: 'REVERSED', secs: 8 },
};
const PERK_IDS = Object.keys(PERKS) as PerkId[];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  if (el instanceof HTMLButtonElement) el.type = 'button';
  return el;
}

function icon(name: IconName, cls: string): HTMLCanvasElement {
  // The overlay is 2x, so the smoothed double-size icon fits it exactly.
  const src = hd(ICONS[name]);
  const c = h('canvas', cls);
  c.width = src.width;
  c.height = src.height;
  c.getContext('2d')!.drawImage(src, 0, 0);
  return c;
}

interface Win {
  win: HTMLDivElement;
  title: HTMLSpanElement;
  x: HTMLButtonElement;
  body: HTMLDivElement;
  foot: HTMLDivElement;
}

export class AdManager {
  private queue: AdSource[] = [];
  private root: HTMLDivElement | null = null;
  private timers: number[] = [];
  private pendingNext = false;
  private openedAt = 0;
  private lastKind: Kind | null = null;
  private perk: PerkId | null = null;
  watched = 0;
  seconds = 0;
  /** Set by the game to the current wave: unlocks harder ad kinds and makes them last longer. */
  level = 1;
  onClose?: () => void;
  /** Called with the ad's perk (if it had one) when it closes. */
  onPerk?: (perk: PerkId) => void;

  constructor(private layer: HTMLElement) {}

  /** True while an ad is on screen or one is about to be. */
  get blocking() {
    return this.root !== null || this.queue.length > 0 || this.pendingNext;
  }

  push(src: AdSource) {
    this.queue.push(src);
    if (!this.root && !this.pendingNext) this.next();
  }

  reset() {
    this.queue = [];
    this.clearTimers();
    this.root?.remove();
    this.root = null;
    this.pendingNext = false;
    this.perk = null;
    this.watched = 0;
    this.seconds = 0;
    this.level = 1;
  }

  /** A random int in [base + level/2, base + level/2 + 1], capped at max. */
  private scaled(base: number, max: number) {
    return Math.min(max, base + Math.floor(this.level / 2) + Math.floor(Math.random() * 2));
  }

  private next() {
    const src = this.queue.shift();
    if (src) this.open(src);
  }

  private clearTimers() {
    this.timers.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    this.timers = [];
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  /** Calls fn every ms until it returns false. */
  private every(ms: number, fn: () => boolean) {
    const id = window.setInterval(() => {
      if (!fn()) clearInterval(id);
    }, ms);
    this.timers.push(id);
  }

  private finish(extraWatched = 0) {
    if (!this.root) return;
    this.clearTimers();
    this.root.remove();
    this.root = null;
    this.watched += 1 + extraWatched;
    this.seconds += (performance.now() - this.openedAt) / 1000;
    sfx.click();
    const perk = this.perk;
    this.perk = null;
    if (perk) this.onPerk?.(perk);
    this.onClose?.();
    if (this.queue.length) {
      this.pendingNext = true;
      window.setTimeout(() => {
        this.pendingNext = false;
        this.next();
      }, 220);
    }
  }

  /** Clicking an ad's call-to-action only ever gets you more ads. */
  private bonus() {
    this.queue.unshift('bonus');
    this.finish();
  }

  private chooseKind(src: AdSource): Kind {
    if (src === 'premium') return 'loading';
    if (src === 'death') return 'countdown';
    const pool = WEIGHTS.filter(([k, , lvl]) => k !== this.lastKind && lvl <= this.level);
    let roll = Math.random() * pool.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of pool) {
      roll -= w;
      if (roll <= 0) return k;
    }
    return 'countdown';
  }

  /** Early on, ads mostly hand out upgrades; later, they mostly take things away. */
  private rollPerk(src: AdSource): PerkId | null {
    if (src === 'premium' || src === 'death') return null;
    const good = Math.max(0.12, 0.4 - (this.level - 1) * 0.04);
    const bad = Math.min(0.45, 0.1 + (this.level - 1) * 0.05);
    const roll = Math.random();
    if (roll < good) return pick(PERK_IDS.filter((id) => PERKS[id].good));
    if (roll < good + bad) return pick(PERK_IDS.filter((id) => !PERKS[id].good));
    return null;
  }

  private creative(src: AdSource): Creative {
    const themed = CREATIVES.filter((c) => c.tags.includes(src));
    const special = src === 'premium' || src === 'death' || src === 'bonus';
    if (special || Math.random() < 0.6) return pick(themed);
    return pick(CREATIVES.filter((c) => c.tags === ANY));
  }

  private open(src: AdSource) {
    const root = h('div', 'nag-backdrop');
    this.root = root;
    this.layer.appendChild(root);
    this.openedAt = performance.now();
    sfx.adJingle();

    const kind = this.chooseKind(src);
    this.lastKind = kind;
    const c = this.creative(src);
    // Not shown on the ad: you only find out what you got once it closes.
    this.perk = this.rollPerk(src);

    if (kind === 'cookie') return this.cookie();
    if (kind === 'storm') return this.storm(src);

    const w = this.makeWin(c);
    root.appendChild(w.win);
    switch (kind) {
      case 'countdown':
        return this.countdown(w, src === 'death' ? 3 : this.scaled(1, 6));
      case 'runaway':
        return this.runaway(w);
      case 'tiny':
        return this.tiny(w);
      case 'confirm':
        return this.confirm(w);
      case 'survey':
        return this.survey(w);
      case 'loading':
        return this.loading(w, c);
      case 'multix':
        return this.multix(w);
      case 'double':
        return this.double(w, src);
      case 'minigame':
        return this.minigame(w);
      case 'hide':
        return this.hideSeek(w);
      case 'captcha':
        return this.captcha(w);
      case 'terms':
        return this.terms(w);
      case 'slider':
        return this.slider(w);
    }
  }

  private makeWin(c: Creative, small = false): Win {
    const win = h('div', `nag-win ${pick(THEMES)}${small ? ' small' : ''}`);
    const bar = h('div', 'nag-bar');
    const title = h('span', 'nag-title', small ? 'AD' : pick(TITLES));
    const x = h('button', 'nag-x', 'X');
    bar.append(title, x);
    const body = h('div', 'nag-body');
    const foot = h('div', 'nag-foot');
    win.append(bar, body, foot);
    win.style.setProperty('--dx', `${Math.round(rand(-60, 60))}px`);
    win.style.setProperty('--dy', `${Math.round(rand(-24, 24))}px`);
    const w = { win, title, x, body, foot };
    this.fill(w, c, small);
    return w;
  }

  private fill(w: Win, c: Creative, small = false) {
    const text = h('div', 'nag-text');
    const cta = h('button', 'nag-cta', c.cta);
    cta.onclick = () => this.bonus();
    text.append(h('h3', '', c.headline));
    if (!small) text.append(h('p', '', c.body));
    text.append(cta);
    if (!small) text.append(h('small', 'nag-fine', c.fine));
    w.body.replaceChildren(icon(c.icon, 'nag-art'), text);
  }

  private shake(el: HTMLElement) {
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  // --- Ad behaviours -------------------------------------------------------

  private countdown(w: Win, secs: number, onDone: () => void = () => this.finish()) {
    w.x.style.display = 'none';
    const skip = h('button', 'nag-skip');
    w.foot.replaceChildren(skip);
    let left = secs;
    const update = () => {
      skip.textContent = left > 0 ? `SKIP AD IN ${left}` : 'SKIP AD >>';
      skip.disabled = left > 0;
    };
    update();
    this.every(1000, () => {
      left--;
      update();
      return left > 0;
    });
    skip.onclick = onDone;
  }

  private runaway(w: Win) {
    let dodges = this.scaled(1, 7);
    w.x.classList.add('runaway');
    const dodge = () => {
      w.x.style.left = `${Math.round(rand(4, w.win.offsetWidth - 26))}px`;
      w.x.style.top = `${Math.round(rand(4, w.win.offsetHeight - 24))}px`;
      w.x.style.right = 'auto';
      w.title.textContent = pick(QUIPS);
      dodges--;
      sfx.boing();
      if (dodges === 0) {
        w.x.classList.add('tired');
        w.title.textContent = 'FINE. CLOSE IT.';
      }
    };
    w.win.addEventListener('pointermove', (e) => {
      if (dodges <= 0) return;
      const r = w.win.getBoundingClientRect();
      const s = r.width / w.win.offsetWidth;
      const px = (e.clientX - r.left) / s;
      const py = (e.clientY - r.top) / s;
      const bx = w.x.offsetLeft + w.x.offsetWidth / 2;
      const by = w.x.offsetTop + w.x.offsetHeight / 2;
      if (Math.hypot(px - bx, py - by) < 30) dodge();
    });
    w.x.addEventListener('pointerdown', (e) => {
      if (dodges > 0) {
        e.preventDefault();
        dodge();
      }
    });
    w.x.onclick = () => {
      if (dodges <= 0) this.finish();
    };
  }

  private tiny(w: Win) {
    w.x.classList.add('tiny');
    w.x.textContent = 'x';
    const corner = Math.floor(Math.random() * 4);
    w.x.style.top = corner < 2 ? '24px' : 'auto';
    w.x.style.bottom = corner < 2 ? 'auto' : '3px';
    w.x.style.left = corner % 2 ? '3px' : 'auto';
    w.x.style.right = corner % 2 ? 'auto' : '3px';
    w.body.querySelector('.nag-cta')?.classList.add('huge');
    w.x.onclick = () => this.finish();
  }

  private confirm(w: Win) {
    w.x.onclick = () => {
      sfx.buzz();
      w.x.style.display = 'none';
      w.title.textContent = 'ARE YOU SURE?';
      const yes = h('button', 'nag-meh', 'yes, i hate saving money');
      const no = h('button', 'nag-cta huge', 'NO! SHOW ME MORE!');
      yes.onclick = () => this.finish();
      no.onclick = () => this.bonus();
      const row = h('div', 'nag-choices');
      row.append(...(Math.random() < 0.5 ? [yes, no] : [no, yes]));
      const text = h('div', 'nag-text');
      text.append(h('h3', '', 'WAIT!!!'), h('p', '', 'If you close this ad you will miss this INCREDIBLE offer FOREVER.'), row);
      w.body.replaceChildren(icon('coin', 'nag-art'), text);
      this.shake(w.win);
    };
  }

  private survey(w: Win) {
    w.x.onclick = () => {
      w.x.style.display = 'none';
      w.title.textContent = 'QUICK SURVEY';
      const stars = Array.from({ length: 5 }, () => h('button', 'star'));
      const row = h('div', 'stars');
      row.append(...stars);
      const msg = h('p', '', 'Rate this ad before you go! Your feedback helps us show you MORE ads.');
      const submit = h('button', 'nag-cta', 'SUBMIT 5 STARS');
      submit.style.visibility = 'hidden';
      submit.onclick = () => this.finish();
      let locked = false;
      const light = (n: number) => stars.forEach((s, i) => s.classList.toggle('on', i < n));
      stars.forEach((s, i) => {
        s.onmouseenter = () => !locked && light(i + 1);
        s.onclick = () => {
          if (locked) return;
          locked = true;
          light(i + 1);
          if (i === 4) {
            msg.textContent = 'WOW! We knew you loved it.';
            submit.style.visibility = 'visible';
            return;
          }
          msg.textContent = `${i + 1} STARS? We think you meant 5.`;
          sfx.buzz();
          let n = i + 1;
          this.later(600, () =>
            this.every(150, () => {
              light(++n);
              sfx.click();
              if (n >= 5) submit.style.visibility = 'visible';
              return n < 5;
            }),
          );
        };
      });
      const text = h('div', 'nag-text');
      text.append(h('h3', '', 'HOW WAS THIS AD?'), msg, row, submit);
      w.body.replaceChildren(icon('heart', 'nag-art'), text);
    };
  }

  private cookie() {
    const root = this.root!;
    root.classList.add('cookie-mode');
    const banner = h('div', 'cookie');
    root.appendChild(banner);

    const accept = h('button', 'nag-cta huge', 'ACCEPT ALL');
    accept.onclick = () => this.finish();

    const showIntro = () => {
      const manage = h('button', 'nag-link', 'manage options');
      manage.onclick = showManage;
      const text = h('div', 'nag-text');
      text.append(
        h('h3', '', 'WE VALUE YOUR PRIVACY'),
        h('p', '', 'We and our 1,337 partners use cookies to measure your bone density, track your kills and sell your soul to the highest bidder.'),
      );
      const row = h('div', 'nag-choices');
      row.append(accept, manage);
      text.append(row);
      banner.replaceChildren(icon('cookie', 'nag-art'), text);
    };

    const showManage = () => {
      const save = h('button', 'nag-meh', 'save & close');
      save.disabled = true;
      save.onclick = () => this.finish();
      const list = h('div', 'toggles');
      const toggles = COOKIE_TOGGLES.map((label) => {
        const t = h('button', 'toggle on', 'ON');
        let relapsed = false;
        t.onclick = () => {
          const on = !t.classList.contains('on');
          t.classList.toggle('on', on);
          t.textContent = on ? 'ON' : 'OFF';
          // "Legitimate interest" has a habit of switching itself back on.
          if (!on && !relapsed && Math.random() < Math.min(0.8, 0.2 + this.level * 0.05)) {
            relapsed = true;
            this.later(500, () => {
              t.classList.add('on');
              t.textContent = 'ON';
              sfx.buzz();
              check();
            });
          }
          check();
        };
        const row = h('div', 'toggle-row');
        row.append(h('span', '', label), t);
        list.append(row);
        return t;
      });
      const check = () => (save.disabled = toggles.some((t) => t.classList.contains('on')));
      const text = h('div', 'nag-text');
      const row = h('div', 'nag-choices');
      row.append(accept, save);
      text.append(h('h3', '', 'YOUR CHOICES (ALL ON)'), list, row);
      banner.replaceChildren(icon('cookie', 'nag-art'), text);
    };

    showIntro();
  }

  private loading(w: Win, c: Creative) {
    w.x.style.display = 'none';
    const bar = h('div', 'progress');
    const fillEl = h('div', 'progress-fill');
    bar.append(fillEl);
    const label = h('p', '', 'LOADING AD... 0%');
    const text = h('div', 'nag-text');
    text.append(h('h3', '', 'PLEASE WAIT'), label, bar, h('small', 'nag-fine', 'Your ad is important to us.'));
    w.body.replaceChildren(icon('coin', 'nag-art spin'), text);
    let pct = 0;
    this.every(60, () => {
      pct = Math.min(99, pct + Math.ceil(rand(2, 9)));
      fillEl.style.width = `${pct}%`;
      label.textContent = `LOADING AD... ${pct}%`;
      if (pct < 99) return true;
      label.textContent = 'LOADING AD... 99% (buffering)';
      this.later(1400, () => {
        this.fill(w, c);
        this.countdown(w, 2);
      });
      return false;
    });
  }

  private multix(w: Win) {
    w.x.style.display = 'none';
    const n = this.scaled(2, 8);
    const real = Math.floor(Math.random() * n);
    for (let i = 0; i < n; i++) {
      const x = h('button', 'nag-x scattered', 'X');
      x.style.left = `${Math.round(rand(3, 92))}%`;
      x.style.top = `${Math.round(rand(10, 88))}%`;
      x.style.right = 'auto';
      x.onclick = () => {
        if (i === real) return this.finish();
        x.textContent = 'NOPE';
        x.disabled = true;
        x.classList.add('fake');
        sfx.buzz();
        this.shake(w.win);
      };
      w.win.append(x);
    }
    w.title.textContent = 'CLOSE THE REAL X';
  }

  private double(w: Win, src: AdSource) {
    w.title.textContent = 'AD 1 OF 2';
    this.countdown(w, 2, () => {
      this.fill(w, this.creative(src));
      w.title.textContent = 'AD 2 OF 2';
      sfx.adJingle();
      this.countdown(w, 2, () => this.finish(1));
    });
  }

  private storm(src: AdSource) {
    const root = this.root!;
    const n = this.scaled(1, 7);
    let left = n;
    for (let i = 0; i < n; i++) {
      const w = this.makeWin(this.creative(src), true);
      w.win.classList.add('free');
      w.win.style.left = `${Math.round(rand(8, 640 - 248))}px`;
      w.win.style.top = `${Math.round(rand(8, 360 - 150))}px`;
      w.win.style.animationDelay = `${i * 120}ms`;
      w.x.onclick = () => {
        w.win.remove();
        sfx.click();
        if (--left === 0) this.finish(n - 1);
      };
      root.append(w.win);
    }
  }

  /** A "playable ad": whack enough goblins and you earn the close button. */
  private minigame(w: Win) {
    w.x.style.display = 'none';
    w.title.textContent = 'PLAYABLE AD';
    const goal = this.scaled(3, 7);
    let score = 0;
    let up = -1;
    const label = h('p', '', `WHACK ${goal} GOBLINS TO CLOSE THIS AD!`);
    const grid = h('div', 'whack');
    const holes = Array.from({ length: 9 }, () => grid.appendChild(h('div', 'hole')));
    const pop = () => {
      if (score >= goal) return false;
      if (up >= 0) holes[up].replaceChildren();
      let next = up;
      while (next === up) next = Math.floor(Math.random() * holes.length);
      up = next;
      holes[up].append(icon('goblin', 'mole'));
      return true;
    };
    holes.forEach((hole, i) => {
      hole.onpointerdown = () => {
        if (score >= goal) return;
        if (i !== up) {
          sfx.buzz();
          label.textContent = `MISSED! ${score}/${goal}`;
          return;
        }
        score++;
        hole.replaceChildren();
        up = -1;
        sfx.hit();
        label.textContent = `BONK! ${score}/${goal}`;
        if (score >= goal) {
          label.textContent = 'YOU WIN! Install the full game for 900 more levels!';
          const install = h('button', 'nag-cta', 'INSTALL FULL GAME');
          install.onclick = () => this.bonus();
          text.append(install);
          w.x.style.display = '';
          w.x.onclick = () => this.finish();
          sfx.pickup();
        }
      };
    });
    const text = h('div', 'nag-text');
    text.append(h('h3', '', 'WHACK-A-GOBLIN'), label, grid);
    w.body.replaceChildren(text);
    pop();
    this.every(Math.max(450, 850 - this.level * 40), pop);
  }

  /** The close button hides under one of the tiles, and sneaks off to another if you guess wrong. */
  private hideSeek(w: Win) {
    w.x.style.display = 'none';
    w.title.textContent = "WHERE'S THE X?";
    const tiles = Array.from({ length: 6 }, () => h('div', 'tile'));
    let at = Math.floor(Math.random() * tiles.length);
    let sneaks = this.scaled(0, 4);
    const msg = h('p', '', 'The close button is hiding under one of these. Find it!');
    const shut = () => tiles.map((t, i) => (t.classList.contains('open') ? -1 : i)).filter((i) => i >= 0);
    tiles.forEach((tile, i) => {
      tile.append(icon(pick<IconName>(['coin', 'heart', 'potion', 'cookie', 'brain', 'gem']), 'tile-art'));
      tile.onclick = () => {
        if (tile.classList.contains('open')) return;
        tile.classList.add('open');
        if (i === at) {
          const x = h('button', 'nag-x found', 'X');
          x.onclick = () => this.finish();
          tile.replaceChildren(x);
          msg.textContent = 'FOUND IT. FINE.';
          sfx.pickup();
          return;
        }
        tile.replaceChildren(h('span', 'tile-nope', pick(['NOPE', 'NOT HERE', 'LOL', 'COLD'])));
        sfx.buzz();
        const others = shut().filter((k) => k !== at);
        if (sneaks > 0 && others.length && Math.random() < 0.6) {
          sneaks--;
          at = pick(others);
          msg.textContent = 'You hear something sneaking away... IT MOVED!';
          this.shake(w.win);
        }
      };
    });
    // Every so often the X peeks out, so it's findable if you're watching.
    this.every(1700, () => {
      const t = tiles[at];
      if (t.classList.contains('open')) return false;
      t.classList.remove('peek');
      void t.offsetWidth;
      t.classList.add('peek');
      return true;
    });
    const grid = h('div', 'tiles');
    grid.append(...tiles);
    const text = h('div', 'nag-text');
    text.append(h('h3', '', 'HIDE AND SEEK'), msg, grid);
    w.body.replaceChildren(text);
  }

  /** "Prove you're human" before you're allowed to close an ad. It might not believe you the first time. */
  private captcha(w: Win) {
    w.x.style.display = 'none';
    w.title.textContent = 'ARE YOU A ROBOT?';
    const [target, label] = pick<[IconName, string]>([
      ['skeleton', 'SKELETONS'],
      ['zombie', 'ZOMBIES'],
      ['goblin', 'GOBLINS'],
      ['rat', 'RATS'],
      ['coin', 'COINS'],
      ['heart', 'HEARTS'],
    ]);
    const others: IconName[] = (['skeleton', 'zombie', 'goblin', 'sorcerer', 'coin', 'heart', 'potion', 'cookie', 'brain', 'gem', 'bat', 'slime', 'rat', 'imp', 'wolf'] as IconName[]).filter((n) => n !== target);
    let fakeFails = Math.random() < Math.min(0.9, 0.4 + this.level * 0.06) ? 1 : 0;
    const msg = h('p', '', `Select all squares with ${label}.`);
    const grid = h('div', 'captcha');
    const verify = h('button', 'nag-cta', 'VERIFY');
    let answer = new Set<number>();
    let picked = new Set<number>();
    const build = () => {
      const count = 2 + Math.floor(Math.random() * 3);
      answer = new Set();
      while (answer.size < count) answer.add(Math.floor(Math.random() * 9));
      picked = new Set();
      grid.replaceChildren(
        ...Array.from({ length: 9 }, (_, i) => {
          const cell = h('div', 'cell');
          cell.append(icon(answer.has(i) ? target : pick(others), 'cell-art'));
          cell.onclick = () => {
            if (picked.has(i)) picked.delete(i);
            else picked.add(i);
            cell.classList.toggle('sel', picked.has(i));
            sfx.click();
          };
          return cell;
        }),
      );
    };
    verify.onclick = () => {
      const right = picked.size === answer.size && [...picked].every((i) => answer.has(i));
      if (right && fakeFails === 0) return this.finish();
      if (right) fakeFails--;
      msg.textContent = right ? 'Verification failed. Are you SURE you are human? Try again.' : `Wrong! Select all squares with ${label}.`;
      sfx.buzz();
      this.shake(w.win);
      build();
    };
    build();
    const text = h('div', 'nag-text');
    text.append(h('h3', '', 'VERIFY TO CLOSE'), msg, grid, verify);
    w.body.replaceChildren(text);
  }

  /** You must read (well, scroll) to the bottom of the terms to agree. They keep getting longer. */
  private terms(w: Win) {
    w.x.style.display = 'none';
    w.title.textContent = 'TERMS OF SERVICE';
    const box = h('div', 'terms');
    let clause = 0;
    const addClauses = (n: number) => {
      for (let k = 0; k < n; k++) {
        box.append(h('p', '', `${++clause}. ${TERMS[(clause - 1) % TERMS.length]}`));
      }
    };
    addClauses(10);
    let amendments = this.scaled(0, 3);
    const agree = h('button', 'nag-cta', 'I AGREE');
    agree.disabled = true;
    agree.onclick = () => this.finish();
    const msg = h('p', '', 'Scroll to the bottom to agree.');
    box.onscroll = () => {
      if (!agree.disabled || box.scrollTop + box.clientHeight < box.scrollHeight - 4) return;
      if (amendments > 0) {
        amendments--;
        addClauses(3);
        msg.textContent = 'NEW TERMS HAVE BEEN ADDED. Keep scrolling.';
        sfx.buzz();
        return;
      }
      agree.disabled = false;
      msg.textContent = 'Thank you for reading every word.';
    };
    const text = h('div', 'nag-text');
    text.append(h('h3', '', 'PLEASE READ CAREFULLY'), msg, box, agree);
    w.body.replaceChildren(text);
  }

  /** Slide to skip. Let go and it springs back; slide too fast and it slips. */
  private slider(w: Win) {
    w.x.style.display = 'none';
    w.title.textContent = 'SLIDE TO SKIP';
    const track = h('div', 'slider');
    const knob = h('div', 'knob', '>>');
    track.append(knob, h('span', 'slider-label', 'SLIDE TO SKIP AD'));
    const msg = h('p', '', 'Slide all the way to skip. Gently.');
    // Overlay pixels per millisecond. Gets stricter in later waves.
    const limit = Math.max(0.35, 0.95 - this.level * 0.06);
    let x = 0;
    let dragging = false;
    let lastX = 0;
    let lastT = 0;
    const max = () => track.offsetWidth - knob.offsetWidth - 4;
    const place = (animate: boolean) => {
      knob.classList.toggle('spring', animate);
      knob.style.left = `${Math.round(x) + 2}px`;
    };
    const release = (text: string) => {
      dragging = false;
      x = 0;
      place(true);
      msg.textContent = text;
      sfx.buzz();
    };
    knob.onpointerdown = (e) => {
      dragging = true;
      knob.setPointerCapture(e.pointerId);
      lastX = e.clientX;
      lastT = performance.now();
    };
    knob.onpointermove = (e) => {
      if (!dragging) return;
      const scale = track.getBoundingClientRect().width / track.offsetWidth;
      const dx = (e.clientX - lastX) / scale;
      const now = performance.now();
      const speed = dx / Math.max(16, now - lastT);
      lastX = e.clientX;
      lastT = now;
      if (speed > limit) return release('TOO FAST! Please slide responsibly.');
      x = Math.max(0, Math.min(max(), x + dx));
      place(false);
      if (x >= max()) {
        dragging = false;
        this.finish();
      }
    };
    knob.onpointerup = () => {
      if (dragging) release('You let go! Back to the start.');
    };
    const text = h('div', 'nag-text');
    text.append(h('h3', '', 'ALMOST THERE!'), msg, track);
    w.body.replaceChildren(icon('coin', 'nag-art'), text);
  }
}
