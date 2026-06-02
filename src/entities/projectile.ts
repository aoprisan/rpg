import { Sprite, Container, Texture } from "pixi.js";
import { gridToScreen, depthKey } from "../core/iso";
import { TILE_CENTER_DY } from "../world/layout";
import { PROJECTILE_SPEED } from "../config";

// A magic bolt fired by the player's spell or an enemy caster. Travels in a
// straight line until it hits a wall, a valid target, or its range runs out.

export class Projectile {
  x: number;
  y: number;
  private vx: number;
  private vy: number;
  damage: number;
  friendly: boolean;
  life = 2.2; // seconds
  dead = false;
  sprite: Sprite;

  constructor(
    texture: Texture,
    layer: Container,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    damage: number,
    friendly: boolean,
    tint: number,
  ) {
    this.x = x;
    this.y = y;
    const len = Math.hypot(dirX, dirY) || 1;
    this.vx = (dirX / len) * PROJECTILE_SPEED;
    this.vy = (dirY / len) * PROJECTILE_SPEED;
    this.damage = damage;
    this.friendly = friendly;
    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5);
    this.sprite.blendMode = "add";
    this.sprite.tint = tint;
    this.sprite.scale.set(0.7);
    layer.addChild(this.sprite);
    this.sync();
  }

  private sync(): void {
    const s = gridToScreen(this.x, this.y);
    this.sprite.x = s.x;
    this.sprite.y = s.y + TILE_CENTER_DY - 12;
    this.sprite.zIndex = depthKey(this.x, this.y, 8);
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    // Subtle pulsing.
    this.sprite.scale.set(0.6 + Math.sin(this.life * 20) * 0.08);
    if (this.life <= 0) this.dead = true;
    this.sync();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
