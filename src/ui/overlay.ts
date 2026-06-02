import { Container, Graphics, Text, TextStyle } from "pixi.js";

// Full-screen title and death overlays plus a transient controls hint.

export class Overlay {
  readonly root = new Container();
  private dim: Graphics;
  private title: Text;
  private subtitle: Text;
  private hint: Text;
  private hintTimer = 0;
  onDismiss: (() => void) | null = null;

  constructor(private screenW: number, private screenH: number) {
    this.dim = new Graphics();
    this.title = new Text({
      text: "GOTHIC DEPTHS",
      style: new TextStyle({
        fill: 0x8a1c1c,
        fontFamily: "Georgia, serif",
        fontSize: 56,
        letterSpacing: 8,
        dropShadow: { color: 0x2a0606, blur: 14, distance: 0, alpha: 1 },
      }),
    });
    this.title.anchor.set(0.5);
    this.subtitle = new Text({
      text: "Click to descend\n\nLeft-click: move / attack   ·   Right-click: cast bolt\nQ: health potion   ·   E: mana potion",
      style: new TextStyle({ fill: 0x9a8a70, fontFamily: "Georgia, serif", fontSize: 18, align: "center", lineHeight: 26 }),
    });
    this.subtitle.anchor.set(0.5);

    this.hint = new Text({
      text: "",
      style: new TextStyle({ fill: 0xc9b27e, fontFamily: "Georgia, serif", fontSize: 18, align: "center" }),
    });
    this.hint.anchor.set(0.5);
    this.hint.alpha = 0;

    this.root.addChild(this.dim, this.title, this.subtitle, this.hint);
    this.root.eventMode = "static";
    this.root.on("pointerdown", () => {
      if (this.onDismiss) this.onDismiss();
    });
    this.layout();
  }

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
    this.layout();
  }

  private layout(): void {
    this.dim.clear().rect(0, 0, this.screenW, this.screenH).fill({ color: 0x000000, alpha: 0.72 });
    this.title.position.set(this.screenW / 2, this.screenH / 2 - 70);
    this.subtitle.position.set(this.screenW / 2, this.screenH / 2 + 40);
    this.hint.position.set(this.screenW / 2, this.screenH * 0.28);
  }

  showTitle(): void {
    this.root.visible = true;
    this.title.text = "GOTHIC DEPTHS";
    this.title.style.fill = 0x8a1c1c;
    this.subtitle.text =
      "Click to descend\n\nLeft-click: move / attack   ·   Right-click: cast bolt\nQ: health potion   ·   E: mana potion";
    this.subtitle.visible = true;
  }

  showDeath(): void {
    this.root.visible = true;
    this.title.text = "YOU HAVE DIED";
    this.title.style.fill = 0x6a0d0d;
    this.subtitle.text = "Click to rise again";
    this.subtitle.visible = true;
  }

  hide(): void {
    this.root.visible = false;
  }

  flash(message: string): void {
    this.hint.text = message;
    this.hint.alpha = 1;
    this.hintTimer = 2.2;
  }

  update(dt: number): void {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      this.hint.alpha = Math.min(1, this.hintTimer);
    }
  }
}
