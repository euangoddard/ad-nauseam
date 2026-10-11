# CLAUDE.md — AD NAUSEAM

A retro pixel-art arena shooter (TypeScript + Vite, browser only). The premise: **every enemy kill
pops up an annoying ad** that pauses the game until it's dismissed. Player-facing description,
controls and the list of ad types live in `README.md`; this file covers how the code works.

## Commands

```sh
npm run dev        # Vite dev server (default http://localhost:5173)
npm run build      # tsc (typecheck) && vite build → dist/
npm run typecheck  # tsc only
npm run preview    # serve dist/
```

There are no tests or linter. `npm run build` passing is the bar for any change.

## Stack

- **Vite 8**, **TypeScript 7** (the native `tsc`), strict mode with `noUnusedLocals`/`noUnusedParameters`.
- `vite.config.ts` sets `base: './'` so `dist/` works from any path or `file://`-style host.
- Only runtime dependency: `@fontsource/press-start-2p` (pixel font, bundled locally, imported in `main.ts`).
- No images or audio files: sprites are character grids and sound is WebAudio synthesis.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | `#stage` containing `<canvas id="game">` (640x360, see Rendering model) and `#overlay` (DOM layer for ads). Inline SVG favicon, SEO/Open Graph/Twitter meta. |
| `public/og-image.png` | 2400×1260 social preview: a real in-game screenshot (headless Chrome, DPR 2, game at 3.5×) with the title added. |
| `.env` / `.env.production` | `VITE_SITE_URL` (no trailing slash) for the absolute canonical/`og:` URLs in `index.html` (`%VITE_SITE_URL%`): localhost in dev, `https://ad-nauseam.euans.space` for `vite build`. Must stay absolute: Vite tries to bundle root-relative `og:image` paths and fails. |
| `.github/workflows/deploy.yml` | On push to `main`: `npm ci`, `npm run build`, deploy `dist/` to GitHub Pages, served on the custom domain `ad-nauseam.euans.space` (set in the repo's Pages settings; no `CNAME` file needed for Actions deploys). |
| `src/main.ts` | Bootstrap: wires `Input`, `AdManager`, `Game`; integer-scale resize; the "REMOVE ADS" button; the rAF loop; dev-only debug globals. |
| `src/game.ts` | Everything in the arena: state machine, player, enemies + AI, bullets, portals, pickups, particles, waves, HUD, title/game-over screens, procedural background. |
| `src/ads.ts` | `AdManager`: ad queue, creatives, the 10 ad behaviours ("kinds"). Pure DOM. |
| `src/sprites.ts` | Palette, pixel-grid sprite definitions, baked canvases (normal / mirrored / white hit-flash), ad icons. |
| `src/shop.ts` | Persistent save (`ad-nauseam-save`: banked coins/gems, upgrade levels, unlocked heroes, chosen hero), `UPGRADES`, `HEROES`. |
| `src/audio.ts` | `sfx` singleton: WebAudio oscillator/noise effects, mute toggle. |
| `src/input.ts` | Keyboard (by `KeyboardEvent.code`) + mouse in game coordinates; per-frame `hit()` edge detection. |
| `src/style.css` | Page layout, CRT scanlines, all ad styling/themes, stepped animations. |

## Rendering model

- The game works in **320×180 game pixels** (`W`, `H` in `game.ts`): all logic, layout and input use
  them. The canvas itself is `RES` (2) times that, **640×360**, and `render()` starts with
  `setTransform(RES, …)`. The canvas is upscaled via CSS with `image-rendering: pixelated`.
  `resize()` in `main.ts` uses the largest **integer** multiple of 320×180 that fits (fractional only
  if the window is smaller than that).
- **Never call `drawImage` directly.** Use `blit()` (or `blitRows()` for slices): it draws the
  sprite's `hd()` copy, a Scale2x-smoothed double-size version (`sprites.ts`, cached per canvas), at
  the 1x sprite's size in game pixels. Sprite canvases stay 1x, so `img.width`/`height` are still
  game-pixel sizes. Ad icons also use `hd()`.
- Positions snap to half game pixels with `half()` (sprites in `drawSet()`, particles, `pixelLine()`),
  which is one canvas pixel. Other effects draw at rounded integer game pixels. `pixelLine()` draws
  1-game-pixel-thick lines in half-pixel steps instead of using `stroke()`.
- Canvas text uses Press Start 2P at **8px** (crisp size) or 16px for big titles, via `Game.text()`
  (draws a 1px dark drop shadow). Text is ~8px per character, so a full-width line holds ~40 chars.
- Entities are drawn feet-anchored: `drawSet()` draws a sprite at `(x-w/2, y-h+1)` (so a 16×16 sprite
  is at `(x-8, y-15)`), so `y` is the feet. Flyers are drawn raised by `lift()`. Enemy hit circles are
  centred on `(x, y-STATS.hy)`; the player's is `(x, y-6)`. Draw order is y-sorted.
- **The world is endless.** Entities live in world coordinates; `cam` is the view's top-left and
  `updateCamera()` (after `updatePlayer()`, snapped in `start()`) eases it to keep the player centred.
  `render()` translates by `-half(cam)` for the world layers; HUD, banner, weapon bar and
  `drawOffscreen()` (edge markers for enemies off screen) draw in screen space afterwards. Mouse aim adds
  `cam` to `input.mouse`. There are no walls and the player isn't clamped.
- `AR` and `SCR` are **mutable, view-relative** bounds updated by `updateCamera()`: `AR` is the walkable
  part of the view (feet; spawns, portals, teleports, pets, slam points and bosses are clamped to it,
  which is also the bear's "wall"), `SCR` is the view ±40px (bullets expire, bombs explode, beams/zaps
  end there). Ordinary enemies aren't clamped; past `LEASH` (300px) from the player they're moved
  back to just off screen. Boss spawn points and the eyeball/bat clamps are offset by `cam`.
- Screen layout: y 0–11 HUD strip over the floor. The floor is `makeBackground()`'s `BG` (384px)
  tileable texture repeated by `drawFloor()`, plus braziers (`drawBrazier()`, the old torches) placed per
  `BRAZIER_CELL` by a hashed `mulberry32`, so the world looks the same every load.

### The DOM overlay (important)

`#overlay` is laid out at **640×360 (2× game resolution)** and scaled with
`transform: scale(scale / OVERLAY_SCALE)`. All ad CSS sizes are in these overlay pixels. This is
deliberate: laying it out at 1× would need sub-6px fonts, which browsers may clamp or render badly.
The overlay has `pointer-events: none`; only `.nag-backdrop` and `.premium` re-enable them.

## Game loop and state

- `main.ts` loop: `dt = min(0.033, elapsed)` → `game.update(dt)` → `game.render()` → `input.endFrame()`.
- `Game.state`: `'title' | 'playing' | 'dying' | 'gameover' | 'shop'`, plus a `paused` flag.
  Game over → (Enter/click once ads are closed) → `shop` → `start()`. `updateShop()`/`drawShop()`.
- **While `ads.blocking` is true, `update()` returns early**, so the whole simulation freezes but
  still renders under the ad backdrop. This freeze is what "annoying" means here.
- Kill → ad flow: `killEnemy()` has a **25% chance** to push `{ t: 0.35, src: type }` onto `adTimers`
  (a short delay so the kill lands visually). When a timer expires, `ads.push(src)` runs. Timers only tick while unpaused,
  so rapid kills queue up ads one after another.
- `dying` lasts 1.4s (player blinks), then `gameover`, saves best score, and pushes a `'death'` ad.
  Restarting from game over is only allowed once `!ads.blocking`.
- **Threat**: `Game.threat` counts upgrade levels, weapons, pets (×2/×3) and hero tier. Enemy HP
  ×(1 + 5%·threat) in `spawnEnemy()`, damage ×(1 + 2%·threat) in `hurtPlayer()`, speed ×(1 + 1%·threat)
  in `updateEnemies()`.
- **Maps** (`Biome`, `BIOMES`, `LOOKS`, `TINTS`, `BIOME_INTRO`): a boss wave clear sets `nextBiome`;
  `startWave()` applies it via `setBiome()`. Backgrounds are built once per map by
  `makeBackground(biome)` (cached in `bgs`); braziers use `LOOKS[biome].flame` and its wall/brick colours. `enemySprite(type)` returns
  `recolorSet()`-repainted sprites for the map (cached in `tinted`); worms/slimes keep their colours.
  Draw enemies through `enemySprite()`, not `SPR[type]`. `start()` resets to the dungeon.
- **Sandworm** (`aiWorm()`, `drawWorm()`): `burrow` (untargetable, chases) → `windup` (locks
  `tx`/`ty` on the player, slides there, cracks drawn) → `surface` (erupts for `STATS.worm.dmg`,
  spits one `sand` bullet, hittable) → `burrow`. `targetable()` excludes non-surfaced worms, and the
  player-separation push skips untargetable enemies.
- **Slime** (`aiSlime()`): hops (moves only in the first half of each 0.8s `anim` cycle, `lift()`
  bounce, `slimeFrame()`), `windup` then lobs a `blob` bullet (ground-plane x/y, arc drawn from
  `life`, no mid-air collisions) that `landBlob()`s into a `Puddle` (`puddles`, `drawPuddle()`).
  Puddles set `player.poisonT` (shared with bear rabies via `poisonName`). In slime land the player
  moves ×0.7.
- **Glitched** (`player.glitchT`, `GLITCH.freeze` 3s): `updatePlayer()` zeroes movement input and blocks
  dash/blink; aiming and attacking still work. Knockback still applies. Cleared by a phoenix revive.
  `drawGlitchNoise()` (enemy) and `drawPlayer()` draw shifted sprite slices seeded per ~1/12s.
- **Heroes** (`HEROES` in `shop.ts`, `Game.hero`): `hp`/`speed`/`dmg` feed `newPlayer()`, movement and
  `dmgMul`; sprites via `HERO_SPRITES`. Mage: `bolt()` makes piercing bolts (`pierce`/`hits`), the dash
  is a blink, `novaCd` ×0.6. Knight: less knockback taken. Achilles: `hurtPlayer()` blocks 90% of hits
  and the rest deal `ceil(maxHp/2)`. `hurtPlayer()` returns whether the hit landed.
- Gems: `GEMS` (boss drops) or a 3% chance per kill, +1 per wave clear, via `addGems()`; banked with
  coins when the dying state ends.
- `playerDown()` handles HP reaching 0 (from hits or rabies): an unspent phoenix pet revives at half HP.
- Coins: `killEnemy()` adds `COINS[type]` (1–10, boss 50, halved for summons) to `Game.coins` (this
  run). They're added to `save.coins` and stored when the dying state ends. Goblins steal from
  `Game.coins` on a stab hit (`e.loot`), flee for 3s, then escape (removed without `killEnemy()`, so
  no ad); killing a looting goblin returns `e.loot`.
- Shop effects are read from `Game.save` at runtime: `dmgMul` (+20%/level), `newPlayer()` max HP
  (120 + 15/level), `novaCd` (−5s/level), `owned()`/`weapons` for scatter and bomb, and pets created in
  `start()`.
- Best score is stored in `localStorage['ad-nauseam-best']`, with every access wrapped in try/catch.

## Waves

`startWave(n)`: `2+ceil(0.8n)` skeletons, `ceil(0.6n)` zombies, sorcerers and goblins from wave 2,
trolls, thunder rats and giant spiders from 3, baby dragons, imps (swarms of 3) and living armour from 4, and reapers and wolves (packs) from 5, and from wave 2 a 35–75% chance of a glitch (plus a 30% chance of a second from wave 7; still the rarest enemy), one or two of each at first (see `counts`), shuffled and spawned one by one through red portals every 0.5–1.1s ÷ difficulty (0.9s telegraph, at least 80px from the
player). Wolves and imps are kept together in the shuffled queue, and each one after the first comes
through a portal next to the previous one 0.2s later, so packs arrive as a group. A wave clears when the spawn queue, portals, enemies and pending ad timers are all empty;
then there's a 3s break and the player heals up to 15 HP. Mimics join from wave 7 and ghosts from 8.
**Wave size is capped** (`WAVE_CAP`): `counts` is trimmed (one at a time from the most numerous type, so
every type that joined still appears) to `base + n` up to `max` (22), and `updateWaves()` holds the next
portal while enemies + portals ≥ `alive` (12; bosses ignore it). `difficulty = 1 + (wave-1)*0.04` scales
enemy speed and spawn rate; enemy HP scales by `+6%/wave`; the score multiplier is `+10%/wave`.

## Enemies (`STATS` in `game.ts`)

| | HP | Speed | Damage | Notes |
| --- | --- | --- | --- | --- |
| skeleton | 1 | 50 | 24 | Melee. Lunges (knockback impulse) on strike; long reach. Weak but hits hardest. |
| zombie | 6 | 19 | 11 | Melee. Low knockback taken. Strong and slow; softer hits than a skeleton. |
| sorcerer | 4 | 32 | 14 | Ranged. Kites to 85–140px and strafes. Fireball after a 0.6s windup (3-way spread from wave 4). Summons 1–2 minions via purple portals every 7–10s (first at 3.5–6s); goblins join the pool from wave 3. |
| goblin | 2 | 74 | 9 | Melee. Fastest. 0.18s crouch, hop-lunge stab, then `flee` for 0.5–0.8s and come back. |
| troll | 16 | 15 | 30 | Melee, 20×20 sprite. `startWindup()` picks a slam point (`tx`/`ty`) 14px ahead; 0.85s club raise with a warning ellipse, then `SLAM_R` area damage (ellipse test, 0.6 y-squash to match the drawing). Tiny knockback taken. |
| reaper | 5 | 38 | 20 | `aiReaper()`: drifts in, then `phase` (`PHASE` 0.5s, untargetable via `targetable()`), teleports ~18px behind the player's aim, scythe windup, wide sweep. 1.8–3s between attacks. |
| glitch | 7 | 42 | 16 | `aiGlitch()`: rare. Strafes at 50–110px; every 1.8–3s `warp`s (`GLITCH.warp`, untargetable via `targetable()`), 40% of the time landing beside the player to slash (generic melee states). `cast` fires 3 `shard` bullets or a slow `packet` (`e.combo`); a landed packet calls `glitchPlayer()`. `summonCd` is the warp timer. Keeps its own colours (not tinted). |
| dragon | 4 | 56 | 8 | `aiDragon()`: flies (`lift()`), keeps 40–70px and strafes. Inhale windup, then `breathe` for `BREATH` 0.8s emitting `flame` bullets that turn towards the player at 1.3 rad/s. |
| rat | 2 | 72 | 13 | Thunder rat. `aiRat()`: scurries in bursts, `windup` tracks then locks `RAT.lock` before firing; `ratZap()` damages anything near the segment at once and pushes a `Zap` (drawn by `drawZap()`, sight by `drawZapSight()`). Keeps its own colours. |
| imp | 1 | 66 | 7 | `aiImp()`: flies (`lift()`), wobbles at 40–80px, `cast`s a `small` fireball. Swarms of 3. |
| wolf | 3 | 60 | 13 | `aiWolf()`: circles at 35–55px, `windup` crouch, `charge` = pounce (`WOLF`, hop via `lift()`), `recover` backs off. Packs. The enemy sprite is the pet's, recoloured; the pet uses `SPR.petWolf`. |
| spider | 5 | 58 | 12 | Giant spider. `aiSpider()`: skitters in bursts at 50–90px; `cast` spits a `web` bullet that sets `player.webT` (movement ×`SPIDER.webSlow`). When you're webbed or within 30px: `windup` crouch → `charge` (locked-direction rush, bites on contact) → `recover` backs off. The pet spider's sprite is `SPR.petSpider`. |
| mimic | 8 | 64 | 20 | Spawns in `lurk` (a shut chest, frame 0, can't be knocked back). `aiMimic()` wakes it when you're within `MIMIC.wake`, it's hit, or `MIMIC.nap` runs out; then generic melee AI, hopping via `lift()`, mouth open on windup. 10–20 coins. Keeps its own colours. |
| ghost | 4 | 30 | 15 | `aiGhost()`: wobbles towards you; when `summonCd` runs out (and soon after each attack) it goes `phase` (untargetable, alpha ~0.06) and glides at ×`GHOST.glide` to `tx`/`ty` just past the player, then reappears and winds up a BOO (generic melee windup/recover). Drawn at 0.75 alpha. Keeps its own colours. |
| armor | 12 | 24 | 22 | Living armour. Generic melee AI, drawn with `drawGreatsword()`. `armorDmg()` halves bullet damage (not spear or bomb). Below half HP `hitEnemy()` sets `e.combo = 1`: helmet off, `SPR.armorHeadless`, speed ×`ARMOR.headless`. Keeps its own colours (not tinted). |

- **Bosses** (`isBoss()`, `BOSS_NAMES`): `isBossWave(n)` (every 6th wave) makes `startWave()` pick one at
  random (`eyeball`, two `bat`s, or `bear`) and queue just that; they spawn on the far side from the
  player. `bossMax` is the total boss HP at spawn so the bats share one HP bar. `bossHitAd()` pushes an
  ad when a bat swoop or bear hit lands. `aiBat()`: `chase → windup → swoop → recover` or `screech`
  (fan of `sonic` bullets); the last bat alive is enraged. `aiBear()`: `maul` (3 swipes, `combo`) up
  close, or `windup → charge`, which `stun`s on hitting a wall; hits set `player.rabiesT` (3 HP/s).
- **Eyeball**: `aiEyeball()` cycles `chase → aim → laser` or `chase → tears`;
  `EYE` holds the timings. The laser is a ray from `beamOrigin()` to the wall (`beamLength()`); a hit
  calls `hurtPlayer()` **and pushes an `'eyeball'` ad timer** (the 0.8s invulnerability stops one beam
  hitting twice at normal speed). Below half HP it's enraged. The sclera sprite is generated by
  `eyeball()` in `sprites.ts`; the iris, eyelid and optic nerve are drawn in `drawEyeball()`, the beam in
  `drawLaser()` (a separate pass after the y-sorted entities so it's on top), and the HP bar in `drawHud()`.
  The boss's feet are clamped to `y ≥ 76` so the eye never covers the HUD. Killing it always pushes an ad.
- Per-type tuning lives in `STATS`: `kb` (knockback taken), `hy` (hit-circle height above the feet; use
  it instead of a hard-coded `y-6`), `drop` (heart chance).
- Melee AI states: `chase → windup → meleeStrike() → recover (or flee for goblins) → chase`. The strike checks distance at the
  moment of the swing, so the windup is the player's dodge window.
- Sorcerer states: `chase` / `cast` / `summon`. Summoning is capped at 20 total enemies + portals.
- Summoned enemies (`summoned: true`) give half score but **still trigger ads**.
- Enemies get pushed apart from each other and from the player with O(n²) circle separation (fine at this scale).
- Pickups: hearts (+20 HP) drop per `STATS[type].drop` and last 10s.
- Each enemy's weapon/attack pose is drawn in code: `drawDagger()`, `drawClub()`, `drawScythe()`,
  `drawSlamWarning()`/`drawShock()` (troll), and the dragon's glowing mouth in `drawEnemy()`.

## Player

120 HP (+ shop), speed 78. Dash: 0.16s at speed 230, 0.8s cooldown, i-frames.

Weapons (`Weapon` / `WEAPONS` in `game.ts`), all sharing `shootCd`:
- **wand**: bolt every 0.17s (speed 220, 1 damage).
- **sword** (`SWORD`): `swingSword()` hits every enemy within 22px + its radius and ±1.1 rad of the aim
  (or anything within 6px), 3 damage, 1.8× knockback; it also destroys enemy fireballs in the arc.
  The blade sweeps across the arc for `swingT`.
- **nova** (`NOVA`, the special): `castNova()` spawns an expanding ring (`novas`, 260px/s up to
  110px) that hits each enemy once (`hit` set) for `12 + wave`, 3.5× knockback, and clears fireballs.
  30s `specialCd`, 1s invulnerability. Selecting it (3 / wheel) only *arms* it: the next attack
  fires it and reverts to `prevWeapon`. E / right-click fire it directly. Can't be selected while
  recharging. `updateNovas()` also ticks the cooldown and announces NOVA READY.
- **scatter** (shop, key 4): three bolts ±0.18 rad, 0.28s. **bomb** (shop, key 5): a `bomb` bullet that
  slows down and `explode()`s on fuse end, wall or enemy contact (radius 24, 5 damage).
- Switching: `WEAPON_KEYS` (1–5), Q (wand ↔ sword), mouse wheel (`input.wheel`, cycles owned weapons,
  skipping a recharging nova). The weapon bar shows only owned weapons.
- **Hero weapons** (`HeroWeapon`, `HERO_WEAPONS`, key 6): all four are in `WEAPON_KEYS` on Digit6, and
  `owned()` only allows the current hero's. Boomerang (`throwBoomerang()`, `BOOMERANG`): one in flight,
  turns back (`back`, `hits` reset) after `out` or at a wall, caught near the player. Skeletons
  (`raiseSkeleton()`, `SUMMON`): pushes a `Minion` (`minions`, `updateMinions()`, `drawMinion()`),
  invulnerable like pets, `rise` animation, crumbles after `life`; the oldest goes at `max`. Warhammer
  (`slamHammer()`, `HAMMER`): instant squashed-ellipse area hit, pushes a `Shock` with `r`. Spear
  (`SPEAR`): a `spear` bullet with `pierce: 99` that ignores armour.
- **Pets** (`PET_KINDS`, `Pet`, `updatePets()`, `drawPet()`): can't be hurt. Wolf: runs at the
  nearest enemy and pounces (`breathT` doubles as the pounce timer, `vx`/`vy`). Phoenix: orbits the player
  firing `homing` fireballs, and is the one-time revive (`spent`). The dragon follows behind the player
  and breathes friendly `flame` bullets (blue, 0.4 dmg each, tiny knockback) at the nearest enemy
  within 110px every 1.8s. The spider bites the nearest enemy within 120px of the player (2 dmg, 0.9s)
  and sets `e.slowT` (half speed, web drawn on the enemy).
  `input.rightClicked` and `wheel` are per-frame and cleared by `endFrame()`/`release()`.
- The weapon bar (`drawWeapons()`) sits bottom-left during play; the REMOVE ADS button is bottom-right.
- `hitEnemy()` takes an optional knockback multiplier. Sword and nova filter dead enemies
  immediately so a killed enemy can't finish a swing that frame. When hit: 0.8s invulnerability, knockback, screen shake, red flash. Arrow-key aim
takes priority over the mouse; mouse aim only applies after the mouse has moved over the canvas
(`mouse.active`).

## Sprites (`sprites.ts`)

- Sprites are arrays of strings; each character is a palette key in `PAL` (`.` or any unknown
  character is transparent). Rows may differ in length; width is the longest row.
- Characters are built as `spriteSet(body, legs[])` (the baby dragon passes `[]` as the body and two
  full frames as "legs", for wings up/down): 13 body rows plus a set of 3 leg rows per
  animation frame (2 walk frames). `SpriteSet` holds `r`/`l` (mirrored) and `wr`/`wl` (white
  hit-flash) canvas arrays.
- Weapons and effects are drawn in code, not baked: the player's blaster points at the aim
  direction, the skeleton's sword is at its side and raised during windup, and the sorcerer's
  staff orb glows when charging.
- `ICONS` (sprite canvases used inside ads) is keyed by `IconName`.

## Ads (`ads.ts`)

- `AdSource` = `'skeleton' | 'zombie' | 'sorcerer' | 'premium' | 'death' | 'bonus'`.
- `AdManager.blocking` = an ad is open **or** queued **or** `pendingNext` (the 220ms gap between
  queued ads). The `pendingNext` guard stops two ads opening at once if `push()` runs during the gap.
- `finish(extraWatched)` closes the current ad, updates `watched`/`seconds`, calls `onClose` (which
  `input.release()`s held mouse/keys so you don't fire on resume), then opens the next queued ad.
- `bonus()` (any CTA click) puts a `'bonus'` ad at the front of the queue and closes the current one.
- `reset()` is called by `Game.start()`, so ad stats are per run.
- **Creative selection**: `premium`/`death`/`bonus` always use their tagged creative; enemy sources
  use an enemy-themed creative 60% of the time, otherwise a generic (`tags === ANY`) one.
- **Ad level**: `startWave()` sets `ads.level = wave` (`reset()` puts it back to 1). Each kind in
  `WEIGHTS` has an unlock level (wave 1: countdown/confirm/tiny … wave 6: storm), and `scaled()` grows
  countdown seconds, runaway dodges, multix X count and storm window count with the level.
- **Kind selection**: weighted random from the unlocked `WEIGHTS`, never the same kind twice in a row.
- **Perks**: `rollPerk()` attaches an upgrade or downgrade (`PERKS`, `PerkId`) to enemy/bonus ads,
  hidden from the player until the ad closes. Upgrade chance falls (40% → 12%) and downgrade chance
  rises (10% → 45%) with the level. `finish()` calls `onPerk`; `Game.applyPerk()` applies instant
  ones (heal, drain, nova recharge) or adds a timed entry to `Game.perks`, which feeds `speedMul`,
  `dmgMul`, `rateMul` and reversed movement, and is listed under the HUD strip. `premium` always uses `loading`; `death` always uses a 3s `countdown`.
- All timers go through `later()`/`every()` so `clearTimers()` can cancel them on close or reset.
- Ad windows are centred with a random `--dx/--dy` offset. Pop-in uses the individual `scale`
  property and shake uses `rotate`, so they don't fight the `transform` used for centring.

### Ad gotchas found in testing

- **Never use `ad-`/`ads-`/`advert`/`sponsor`-style class names or ids.** Ad blockers' generic
  cosmetic filters hide them on the live site (`.ad-text` and `.ad-title` were `display: none`, so
  ads showed up with no text). Ad blockers usually ignore localhost, so this never shows up in dev.
  Ad DOM classes use the `nag-` prefix.

- `.nag-bar` must **not** have `position: relative`. Close buttons are absolutely positioned and need
  the whole `.nag-win` as their containing block. When the bar was positioned, its
  `overflow: hidden` clipped the runaway/tiny X whenever it moved out of the title bar.
- The runaway X converts pointer coordinates to overlay space with
  `rect.width / el.offsetWidth` (the transform scale). Keep that if you change the overlay scaling.

## Extending

- **New enemy**: add to `EnemyType`, `STATS`, `COINS`, a sprite in `SPR` (and `ICONS` if ads should use it),
  AI in `updateEnemies()`, death colours and decal in `killEnemy()`/`drawDecal()`, wave composition
  in `startWave()`, add it to `AdSource` and `ANY`, write tagged creatives, and add it to the title-screen
  cast (which shows three at a time and rotates).
- **New ad creative**: append to `CREATIVES` with `tags` (an enemy source, a special source, or `ANY`).
- **Ad kinds added later**: `minigame` (whack-a-goblin), `slider` (pointer-captured knob, speed
  limit in overlay px/ms), `hide` (X under one of six tiles, may move), `captcha` (icon grid, may fake a
  failure once), `terms` (scroll box that appends clauses up to `scaled(0, 3)` times), `watch` (progress
  only advances while the pointer is over the window, rewinds otherwise), `slots` (rigged: `scaled(0, 3)`
  losing spins first), `unsub` (type UNSUBSCRIBE in a focused `<input>`; may "autocorrect" once; the word
  must avoid M (mute hotkey) and spaces (blocked by `Input`)), `hydra` (like `storm`, opened before
  `makeWin`; each close spawns up to two more until `scaled(1, 6)` heads are used up), `quiz` (any
  answers, then a 2s countdown), `wizard` (pre-ticked `EXTRAS`; leaving any ticked ends in `bonus()`),
  `sticky` (calls `finish()` straight away so the game keeps running, then a non-blocking window
  bounces round the overlay; it lives in `stickyEl`/`stickyTimers`, outside `root`/`timers`, and
  `clearSticky()` removes it, including from `reset()`). Styles are in
  `style.css` next to the other ad styles.
- **New ad behaviour**: add to `Kind` and `WEIGHTS`, write a method on `AdManager`, and dispatch it in
  `open()`. Every path must end in `finish()` (or `bonus()`), or the game stays frozen.
- **New sound**: add a method on `Sfx` using `tone()`/`noise()`. The AudioContext unlocks on the first
  pointerdown/keydown (`main.ts`).

## Debugging / verifying in a browser

- In dev builds, `window.__game` and `window.__ads` are exposed (`main.ts`, behind
  `import.meta.env.DEV`). Private fields and methods are reachable at runtime from devtools.
- **Automated browser tabs are often `visibilityState: hidden`, which pauses rAF**, so the game
  won't advance on its own. Drive it manually: `for (...) { g.update(1/60); g.input.endFrame(); } g.render()`.
  Taking a screenshot makes the tab visible again.
- To force a specific ad: `__ads.chooseKind = () => 'runaway'; __ads.push('skeleton')`
  (then `delete __ads.chooseKind` to restore the prototype method).
- To auto-dismiss ads in a soak test: `if (ads.root) ads.finish(); else { ads.pendingNext = false; ads.next(); }`.
- A bot soak test (auto-aim at the nearest enemy, HP clamped) got to wave 8 with every enemy type
  and every ad kind exercised and no errors. Repeat it after gameplay changes.
- HMR reloads the page on edits, which wipes any in-progress game and the debug state.

## Conventions

- Match the existing style: small interfaces, plain objects for entities, arrays filtered after
  update (`dead`/`life`/`t` flags), with no classes per entity.
- Palette colours are mostly Sweetie-16 hex values; reuse them rather than adding new colours.
- Animations use `steps()` timing to keep the low-framerate retro feel.
