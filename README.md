# AD NAUSEAM

A retro pixel-art arena shooter where **every kill is sponsored**: each enemy you slay triggers an
obnoxious pop-up ad that pauses the game until you get rid of it.

Built with TypeScript + Vite, rendered on a 320×180 canvas scaled up with crisp pixels. All sprites
are hand-defined pixel grids and all sound is synthesised with WebAudio — no asset files.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build in dist/
```

## Deploy

The game is live at **https://ad-nauseam.euans.space**. Every push to `main` builds and deploys
`dist/` to GitHub Pages (`.github/workflows/deploy.yml`).

One-off setup:

1. In the repo's **Settings → Pages**, set *Source* to **GitHub Actions** and *Custom domain* to
   `ad-nauseam.euans.space`, then tick **Enforce HTTPS** once the certificate is issued.
2. In the `euans.space` DNS, add a `CNAME` record for `ad-nauseam` pointing at
   `<github-username>.github.io`.

The site URL used for the canonical and social-preview tags is set in `.env.production`; change it
there if the domain changes.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse / arrow keys | Aim and attack with the current weapon |
| 1 / 2 / 3 | Select wand / sword / nova |
| 4 / 5 | Select scatter wand / bombs (once bought in the shop) |
| 6 | Select your hero's own weapon |
| Q | Swap between wand and sword |
| Mouse wheel | Cycle weapons (skips the nova while it's recharging) |
| E / right-click | Unleash the nova |
| Space / Shift | Dash (brief invulnerability) |
| P / Esc | Pause |
| M | Mute |

## Attacks

- **Wand**: rapid long-range magic bolts. Safe, but weak.
- **Sword**: a short-range arc that hits everything in front of you for 3× a bolt's damage, knocks
  enemies back, and swats fireballs out of the air.
- **Nova** (special): a huge shockwave that blasts every enemy in range and wipes out fireballs,
  with a moment of invulnerability. 30 second cooldown. Select it with 3 / the wheel and attack,
  or fire it straight away with E / right-click. Yes, killing a whole room at once queues a whole
  room's worth of ads.
- **Hero weapons** (6): every hero has one of their own.
  - Adventurer: **boomerang**. Hits everything on the way out and again on the way back. One at a time.
  - Mage: **skeletons**. Each cast raises a skeleton where you aim that marches off and fights for you
    (up to 4; they crumble after 14 seconds, and the oldest goes if you raise a fifth).
  - Knight: **warhammer**. Slams the ground just in front of you, hitting everything in a ring.
  - Achilles: **spear**. A thrown spear that goes through everything, armour included.

## Enemies

- **Skeleton**: fragile (1 HP), quick, lunges with a rusty sword for heavy damage.
- **Zombie**: tanky (6 HP) and slow, its claw swipes do less damage than a skeleton's sword.
- **Sorcerer**: keeps its distance and lobs fireballs (3-way from wave 4), and summons skeletons
  and zombies through portals. Summoned minions also earn you ads.
- **Goblin** (wave 2+): the fastest thing in the dungeon. Crouches, hops in with a quick dagger
  stab, then runs off and comes back for another go. **If the stab lands it steals some of your
  coins** and sprints away with a sack: kill it within 3 seconds to get them back, or they're gone.
- **Troll** (wave 3+): huge, slow and barely flinches. Raises its club overhead while a red ring
  marks where it'll land, then slams the ground for massive damage. Get out of the circle.
- **Baby dragon** (wave 4+): flutters around at mid range. Its mouth glows as it breathes in, then
  it breathes a stream of fire that slowly turns to follow you. Run around it; the sword swats flames.
- **Reaper** (wave 5+): fades out (untouchable while it does), reappears right behind you, raises its
  scythe and sweeps a wide arc.
- **The Glitch** (wave 2+, rare): still the rarest enemy. There's a growing chance of one each wave
  (35% at wave 2, up to 75%), and from wave 7 sometimes a second. A blue-screen figure with a missing-texture head that keeps warping around the room
  (can't be hit while it flickers). It slashes if it warps in next to you, fires bursts of pixel shards
  from range, and lobs a slow chequered packet: **get hit and you're glitched, unable to move or dash
  for 3 seconds** (you can still aim and attack).
- **Thunder rat** (wave 3+): small and quick, scurries about in bursts. It crackles with static,
  then a flashing dotted line shows where the bolt will go: get off the line before it fires.
- **Imp** (wave 4+): comes in swarms of three. Tiny flying devils that flit about erratically and
  throw small fireballs. One hit kills them; hitting them is the hard part.
- **Wolf** (wave 5+): hunts in packs. Wolves circle you, crouch, then pounce. Watch for the crouch.
- **Giant spider** (wave 3+): skitters around spitting webs. A web slows you right down, and while
  you're stuck it crouches and rushes in to bite. It'll also bite if you get too close.
- **Living armour** (wave 4+): an empty suit of armour with a big sword. Bolts and fireballs glance
  off it for half damage, so use the sword, hammer, bombs, nova or a spear. Knock its helmet off
  (half HP) and it gets faster.
- **Mimic** (wave 7+): a treasure chest sitting quietly on the floor. Walk up to it (or shoot it)
  and it wakes up, all teeth, and hops after you to chomp. Pays out a lot of coins, though.
- **Ghost** (wave 8+): see-through and floaty. Every few seconds it fades out almost completely
  (you can't hit it then), glides through to your other side and pops back up with a BOO!

Later waves don't keep growing forever: a wave tops out at 22 enemies (they're tougher by then),
and no more than 12 are on screen at once. The rest wait their turn.

### The endless arena

There are no walls: the floor goes on forever and the camera follows you. Enemies that fall too far
behind come back in from just off screen, so you can't simply outrun a wave, and red markers at the
edge of the screen show where off-screen enemies are. Bosses stay on screen (the rabid bear stuns
itself charging into the edge of it).

### Maps

Every boss you kill moves you on to the next map: **dungeon → desert → slime land → dungeon …**
Each map has its own floor and braziers, and repaints every enemy (sun-bleached and sandy in
the desert, dripping green in slime land). Each also has its own native enemy:

- **Sandworm** (desert): tunnels towards you as a moving mound of sand that can't be hit. When it gets
  close, the ground cracks and rumbles where you're standing; move! It bursts out, spits sand, then
  dives back underground. You can only hit it while it's up.
- **Slime** (slime land): hops about and lobs arcing poison blobs (watch the shadow for where they'll
  land). They leave purple poison puddles: step in one and you're poisoned (3 HP a second). The whole
  floor is sticky too, so you move 30% slower.

### Bosses

Every sixth wave (so straight after wave 5) is a boss fight, and which boss you get is random.
Bosses always drop gems, and **every time a boss's signature attack hits you, an ad pops up.**

**The All-Seeing Eye**: a giant bloodshot eyeball whose iris follows you around. It either:

- **Fires a laser**: a dotted red sight tracks you, then locks on and flashes. Get out of the line
  before the beam fires. **Every time the laser hits you, an ad pops up.**
- **Cries**: it squints, then fires a ring of tears.

Below half health it gets angry: a red iris, faster movement, quicker aim, a beam that sweeps after
you, and bigger rings of tears. Killing it always pops an ad.

**The Bat Twins**: two giant bats that flutter around you erratically. Each one either swoops (its
eyes flare, a dotted line shows the dive, then it dives straight through) or screeches a fan of
sound waves. Kill one and the other gets angry.

**Rabid Bear**: lumbers after you foaming at the mouth. Up close it mauls you with three quick
swipes; from range it paws the ground, locks on and charges, stunning itself if it hits a wall (your
chance to punish it). Every hit gives you **rabies**: you lose 3 HP a second for 4 seconds.

## Coins, gems and the shop

**Everything you buy makes the enemies tougher too.** Each upgrade level, weapon, pet and stronger
hero adds to your **threat** (shown on the title screen and in the shop): +5% enemy HP, +2% enemy damage
and +1% enemy speed per point.

Every kill drops 1–10 coins (tougher enemies pay more; summoned minions pay half; bosses pay more).
**Gems** are rarer: a 3% chance per kill, +1 for every wave you clear, and 5–10 from bosses. When you
die, the coins and gems from that run are banked and the game-over screen takes you to the **shop**
(you can also press S on the title screen). Everything is saved in your browser between runs.

The **UPGRADES** tab spends coins:

| Item | What it does |
| --- | --- |
| Damage (5 levels) | +20% damage with everything per level |
| Max HP (5 levels) | +15 max HP per level (you start with 120) |
| Nova recharge (3 levels) | Nova cooldown 5s shorter per level |
| Scatter wand | New weapon (4): fires three bolts in a fan |
| Bombs | New weapon (5): a lobbed bomb that explodes, hitting everything nearby |
| Adopt a spider (250) | A pet that scuttles over and bites enemies, webbing them to half speed |
| Adopt a wolf (300) | A fast pet that runs enemies down and pounces on them |
| Adopt a dragon (400) | A blue baby dragon that follows you and breathes fire at enemies |
| Adopt a phoenix (600) | Circles you shooting homing fireballs, and **revives you once per run** |

The **HEROES** tab spends gems on new characters (pick the one you play as there too):

| Hero | Gems | |
| --- | --- | --- |
| Adventurer | free | 120 HP, the classic |
| Mage | 30 | 100 HP. Magic bolts pierce through enemies, Space blinks (teleports) instead of dashing, nova recharges 40% faster |
| Knight | 50 | 200 HP and 1.5× damage, barely knocked back, but slow |
| Achilles | 200 | Immune to every hit... except there's a 10% chance it finds his heel, which takes **half his max HP** |

Shop controls: A/D to switch tabs, W/S or the mouse to pick, Space or click to buy (or pick a hero),
Enter or PLAY to start.

## The ads

Each kill has a 25% chance to pop up an ad. Ads are themed on whatever you just killed, start off
mild and get nastier every wave (longer countdowns, more dodging, new ad types unlocking), and each
one fights back in a different way:

- **Countdown**: "Skip ad in 3…"
- **Runaway X**: the close button dodges your cursor a few times
- **Tiny X**: a near-invisible close button and a huge call-to-action
- **Are you sure?**: a confirm-shaming dialog with the buttons in random order
- **Survey**: rate the ad, and anything under 5 stars gets "corrected"
- **Cookie banner**: Accept All, or untick toggles that switch themselves back on
- **Loading**: stalls at 99% before the ad even starts
- **Find the real X**: several close buttons, only one of which works
- **Ad 1 of 2**: two back-to-back ads
- **Pop-up storm**: several windows at once
- **Playable ad**: whack-a-goblin; whack enough of them to earn the close button
- **Slide to skip**: let go and it springs back; slide too fast and it slips
- **Hide and seek**: the close button hides under one of six tiles, and sneaks off when you guess wrong
- **Captcha**: "select all squares with SKELETONS", and it may not believe you're human the first time
- **Terms of service**: scroll to the bottom to agree, but they keep adding more terms
- **Watch the whole ad**: it only plays while your cursor is on it, and rewinds if you look away
- **Spin to close**: a rigged slot machine; line up three Xs (after a few near misses)
- **Unsubscribe**: type UNSUBSCRIBE to close it, and it may "autocorrect" you to SUBSCRIBE
- **Hydra**: close it and two more grow back in its place
- **Personality quiz**: "which enemy are you?" Every answer is right. The result is an ad.
- **Setup wizard**: an installer with "optional" extras already ticked. Leave any ticked and you get
  another ad
- **Sticky video**: doesn't pause the game. It bounces around the screen like an old DVD logo,
  covering the fight, until it times out or you find its tiny X

You never know which you're getting until you close it: some ads secretly come with a
**sponsor reward** (2× fire rate, 2× damage, speed boost,
+30 HP, instant nova recharge); others make you accept a **downgrade** (slowed, half damage, jammed
wand, −20 HP, reversed controls). Early waves are mostly rewards; later waves are mostly downgrades.

Clicking any call-to-action just gets you another ad. The "REMOVE ADS $49.99/mo" button
gets you an ad too. Game over shows how many seconds of your life the ads took.
