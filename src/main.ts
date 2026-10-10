import '@fontsource/press-start-2p';
import './style.css';
import { Game, W, H } from './game';
import { Input } from './input';
import { AdManager } from './ads';
import { sfx } from './audio';

// The overlay is laid out at 2x the game resolution so ad text stays legible.
const OVERLAY_SCALE = 2;

const stage = document.getElementById('stage') as HTMLDivElement;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;

const input = new Input(canvas, W, H);
const ads = new AdManager(overlay);
const game = new Game(canvas, input, ads);
ads.onClose = () => input.release();

const premium = document.createElement('button');
premium.type = 'button';
premium.className = 'premium';
premium.textContent = 'REMOVE ADS $49.99/mo';
premium.onclick = () => {
  if (game.state === 'playing' && !ads.blocking) ads.push('premium');
};
overlay.appendChild(premium);

const unlock = () => sfx.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

function resize() {
  const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  stage.style.width = `${W * scale}px`;
  stage.style.height = `${H * scale}px`;
  overlay.style.transform = `scale(${scale / OVERLAY_SCALE})`;
}
window.addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  premium.hidden = game.state !== 'playing' || game.paused;
  input.endFrame();
  requestAnimationFrame(frame);
}
void document.fonts.load('8px "Press Start 2P"').finally(() => requestAnimationFrame(frame));

if (import.meta.env.DEV) Object.assign(window, { __game: game, __ads: ads });
