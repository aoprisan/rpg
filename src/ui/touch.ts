import { Container, Graphics, Text, TextStyle } from "pixi.js";

// Touch controls for mobile: a floating virtual joystick that steers continuous
// movement, plus tap buttons for the spell. Everything here is driven by raw DOM
// pointer events filtered to `pointerType === "touch"`, so it coexists with the
// desktop mouse/keyboard Input without either one stealing the other's events.
//
// The joystick is "floating": it anchors wherever the finger first lands in the
// play area and follows the drag, which is the comfortable thumb-roaming pattern
// for phones. `moveVector()` reports a screen-space direction + magnitude that the
// Game converts into grid movement.

interface TouchButton {
  x: number;
  y: number;
  r: number;
  node: Container;
  press: Graphics;
  onTap: () => void;
}

export interface TouchHandlers {
  cast: () => void;
}

export class TouchControls {
  readonly root = new Container();
  /** Flips true the first time a real touch is seen, so desktop never shows the UI. */
  touchActive = false;

  private joyId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private knobX = 0;
  private knobY = 0;
  private readonly maxRadius = 64;
  private readonly deadzone = 12;

  private joyGfx = new Graphics();
  private knobGfx = new Graphics();

  private buttons: TouchButton[] = [];
  private buttonId: number | null = null;
  private activeButton: TouchButton | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private screenW: number,
    private screenH: number,
    handlers: TouchHandlers,
  ) {
    this.root.visible = false;
    this.root.addChild(this.joyGfx, this.knobGfx);
    this.joyGfx.visible = false;
    this.knobGfx.visible = false;

    this.addButton("✦", () => handlers.cast());
    this.layout();

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  private addButton(glyph: string, onTap: () => void): void {
    const node = new Container();
    const base = new Graphics()
      .circle(0, 0, 42)
      .fill({ color: 0x140d0a, alpha: 0.55 })
      .stroke({ color: 0xc9a24b, width: 2, alpha: 0.8 });
    const press = new Graphics().circle(0, 0, 42).fill({ color: 0xff9b46, alpha: 1 });
    press.alpha = 0;
    const label = new Text({
      text: glyph,
      style: new TextStyle({ fill: 0xe7c878, fontFamily: "Georgia, serif", fontSize: 34 }),
    });
    label.anchor.set(0.5);
    node.addChild(base, press, label);
    this.root.addChild(node);
    this.buttons.push({ x: 0, y: 0, r: 42, node, press, onTap });
  }

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
    this.layout();
  }

  private layout(): void {
    // Cast button: lower-right, floating above the mana orb.
    const b = this.buttons[0];
    if (b) {
      b.x = this.screenW - 86;
      b.y = this.screenH - 168;
      b.node.position.set(b.x, b.y);
    }
  }

  /**
   * Active movement intent, or null when the stick is idle/in the deadzone.
   * `dx,dy` is a unit vector in *screen* space; `mag` is 0..1 throttle.
   */
  moveVector(): { dx: number; dy: number; mag: number } | null {
    if (this.joyId === null) return null;
    const ox = this.knobX - this.baseX;
    const oy = this.knobY - this.baseY;
    const len = Math.hypot(ox, oy);
    if (len <= this.deadzone) return null;
    const mag = Math.min(1, (len - this.deadzone) / (this.maxRadius - this.deadzone));
    return { dx: ox / len, dy: oy / len, mag };
  }

  private localPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private hitButton(x: number, y: number): TouchButton | null {
    for (const b of this.buttons) {
      if (Math.hypot(x - b.x, y - b.y) <= b.r) return b;
    }
    return null;
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") return;
    this.touchActive = true;
    const p = this.localPos(e);

    // Buttons take priority over the movement zone.
    const b = this.hitButton(p.x, p.y);
    if (b && this.buttonId === null) {
      this.buttonId = e.pointerId;
      this.activeButton = b;
      b.press.alpha = 0.35;
      b.onTap();
      return;
    }

    // Otherwise start (or replace) the floating joystick under this finger.
    if (this.joyId === null) {
      this.joyId = e.pointerId;
      this.baseX = this.knobX = p.x;
      this.baseY = this.knobY = p.y;
      this.joyGfx.visible = true;
      this.knobGfx.visible = true;
      this.draw();
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerType !== "touch" || e.pointerId !== this.joyId) return;
    const p = this.localPos(e);
    let dx = p.x - this.baseX;
    let dy = p.y - this.baseY;
    const len = Math.hypot(dx, dy);
    if (len > this.maxRadius) {
      dx = (dx / len) * this.maxRadius;
      dy = (dy / len) * this.maxRadius;
    }
    this.knobX = this.baseX + dx;
    this.knobY = this.baseY + dy;
    this.draw();
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.joyGfx.visible = false;
      this.knobGfx.visible = false;
    }
    if (e.pointerId === this.buttonId) {
      if (this.activeButton) this.activeButton.press.alpha = 0;
      this.buttonId = null;
      this.activeButton = null;
    }
  };

  private draw(): void {
    this.joyGfx
      .clear()
      .circle(this.baseX, this.baseY, this.maxRadius)
      .fill({ color: 0x0a0608, alpha: 0.35 })
      .stroke({ color: 0xc9a24b, width: 2, alpha: 0.5 });
    this.knobGfx
      .clear()
      .circle(this.knobX, this.knobY, 26)
      .fill({ color: 0xc9a24b, alpha: 0.45 })
      .stroke({ color: 0xe7c878, width: 2, alpha: 0.85 });
  }
}
