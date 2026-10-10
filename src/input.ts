const BLOCKED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  mouse = { x: 0, y: 0, down: false, active: false };
  clicked = false;
  rightClicked = false;
  /** Net mouse-wheel notches this frame (+1 = down). */
  wheel = 0;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    window.addEventListener('keydown', (e) => {
      if (BLOCKED.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    const toGame = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * height;
      this.mouse.active = true;
    };
    canvas.addEventListener('mousemove', toGame);
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.rightClicked = true;
      if (e.button !== 0) return;
      toGame(e);
      this.mouse.down = true;
      this.clicked = true;
    });
    window.addEventListener('mouseup', () => (this.mouse.down = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (e.deltaY) this.wheel += Math.sign(e.deltaY);
      },
      { passive: false },
    );
  }

  down(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }

  hit(...codes: string[]) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** Forget held buttons — used when an ad steals focus. */
  release() {
    this.mouse.down = false;
    this.pressed.clear();
    this.clicked = false;
    this.rightClicked = false;
    this.wheel = 0;
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
    this.rightClicked = false;
    this.wheel = 0;
  }
}
