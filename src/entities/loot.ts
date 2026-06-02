import { Sprite, Container, Texture } from "pixi.js";
import { gridToScreen, depthKey } from "../core/iso";
import { TILE_CENTER_DY } from "../world/layout";

export type LootKind = "health" | "mana" | "gold" | "sword";

// A pickup lying on the dungeon floor. Bobs gently and is collected when the
// player steps onto its tile.

export class Loot {
  x: number;
  y: number;
  kind: LootKind;
  amount: number;
  sprite: Sprite;
  collected = false;
  private bob = Math.random() * Math.PI * 2;
  private baseY = 0;

  constructor(texture: Texture, layer: Container, x: number, y: number, kind: LootKind, amount: number) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.amount = amount;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 0.7);
    layer.addChild(this.sprite);
    const s = gridToScreen(x, y);
    this.sprite.x = s.x;
    this.baseY = s.y + TILE_CENTER_DY - 4;
    this.sprite.zIndex = depthKey(x, y, 3);
  }

  update(dt: number, visible: boolean): void {
    this.bob += dt * 3;
    this.sprite.y = this.baseY + Math.sin(this.bob) * 2;
    this.sprite.visible = visible;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
