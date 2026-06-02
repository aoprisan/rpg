// Pointer + keyboard input. Diablo-style controls: left button moves / attacks
// (and can be held to keep moving toward the cursor), right button casts the
// spell, number/letter keys quaff potions. Screen coordinates are reported in
// canvas pixels; the Game converts them to world tiles using the camera.

export interface InputHandlers {
  moveOrAttack(sx: number, sy: number): void;
  cast(sx: number, sy: number): void;
  key(k: string): void;
}

export class Input {
  pointerDown = false;
  button = 0;
  x = 0;
  y = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private handlers: InputHandlers,
  ) {
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", this.onKey);
  }

  private localPos(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.x = e.clientX - rect.left;
    this.y = e.clientY - rect.top;
  }

  private onDown = (e: PointerEvent): void => {
    this.localPos(e);
    this.pointerDown = true;
    this.button = e.button;
    if (e.button === 2) this.handlers.cast(this.x, this.y);
    else this.handlers.moveOrAttack(this.x, this.y);
  };

  private onMove = (e: PointerEvent): void => {
    this.localPos(e);
  };

  private onUp = (): void => {
    this.pointerDown = false;
  };

  private onKey = (e: KeyboardEvent): void => {
    this.handlers.key(e.key.toLowerCase());
  };

  /** Whether the left button is being held (for continuous movement). */
  get holdingMove(): boolean {
    return this.pointerDown && this.button === 0;
  }
}
