import { Sprite, Container } from "pixi.js";
import { TextureActorFrames } from "../assets/assetStore";
import { gridToScreen, depthKey, gridFacing8 } from "../core/iso";
import { ACTOR_ANCHOR_Y, TILE_CENTER_DY } from "../world/layout";

export type ActorState = "idle" | "walk" | "attack" | "dead";

// Shared base for animated, grid-positioned actors (player + enemies). Handles
// sprite placement on the iso grid, depth sorting, directional walk/attack
// animation, and path following.

export class Actor {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dir = 6;
  state: ActorState = "idle";
  speed = 3;
  sprite: Sprite;
  protected frames: TextureActorFrames;
  protected animTime = 0;
  protected attackAnimTimer = 0;
  path: { x: number; y: number }[] = [];
  hitFlash = 0;

  constructor(frames: TextureActorFrames, x: number, y: number, layer: Container, maxHp: number) {
    this.frames = frames;
    this.x = x;
    this.y = y;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.sprite = new Sprite(frames.walk[this.dir][0]);
    this.sprite.anchor.set(0.5, ACTOR_ANCHOR_Y);
    layer.addChild(this.sprite);
    this.syncSprite();
  }

  get alive(): boolean {
    return this.state !== "dead";
  }

  faceTowards(tx: number, ty: number): void {
    this.dir = gridFacing8(tx - this.x, ty - this.y);
  }

  /** Trigger the attack pose for a short duration. */
  playAttack(): void {
    this.attackAnimTimer = 0.28;
  }

  takeHit(): void {
    this.hitFlash = 0.18;
  }

  /** Convenience for externally-driven actors (the player): sync + animate. */
  advance(dt: number): void {
    this.syncSprite();
    this.updateAnimation(dt);
  }

  syncSprite(): void {
    const s = gridToScreen(this.x, this.y);
    this.sprite.x = s.x;
    this.sprite.y = s.y + TILE_CENTER_DY;
    this.sprite.zIndex = depthKey(this.x, this.y, 5);
  }

  /**
   * Continuous free movement along a grid-space direction (the mobile joystick).
   * `gx,gy` need not be normalized; `scale` is a 0..1 throttle. Moves each axis
   * independently and only into walkable tiles, so the actor slides along walls
   * instead of sticking. Returns true if any movement happened.
   */
  moveByGrid(gx: number, gy: number, scale: number, dt: number, walkable: (x: number, y: number) => boolean): boolean {
    const len = Math.hypot(gx, gy);
    if (len === 0 || scale <= 0) return false;
    const step = this.speed * dt * scale;
    const ux = (gx / len) * step;
    const uy = (gy / len) * step;
    let moved = false;
    const nx = this.x + ux;
    if (walkable(Math.round(nx), Math.round(this.y))) {
      this.x = nx;
      moved = true;
    }
    const ny = this.y + uy;
    if (walkable(Math.round(this.x), Math.round(ny))) {
      this.y = ny;
      moved = true;
    }
    this.dir = gridFacing8(gx, gy);
    return moved;
  }

  /** Advance along the current path; returns true while still moving. */
  followPath(dt: number): boolean {
    if (this.path.length === 0) return false;
    const next = this.path[0];
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;
    if (d <= step) {
      this.x = next.x;
      this.y = next.y;
      this.path.shift();
    } else {
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
      this.dir = gridFacing8(dx, dy);
    }
    return true;
  }

  updateAnimation(dt: number): void {
    this.animTime += dt;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.attackAnimTimer > 0) this.attackAnimTimer -= dt;

    let tex;
    if (this.state === "dead") {
      tex = this.frames.dead;
    } else if (this.attackAnimTimer > 0) {
      tex = this.frames.attack[this.dir];
    } else if (this.state === "walk") {
      const f = Math.floor(this.animTime * 8) % this.frames.walk[this.dir].length;
      tex = this.frames.walk[this.dir][f];
    } else {
      tex = this.frames.walk[this.dir][0];
    }
    this.sprite.texture = tex;

    // Red flash when struck.
    if (this.hitFlash > 0) {
      this.sprite.tint = 0xff6666;
    } else {
      this.sprite.tint = 0xffffff;
    }
  }

  die(): void {
    this.state = "dead";
    this.path = [];
    this.sprite.texture = this.frames.dead;
    this.sprite.tint = 0xffffff;
    this.sprite.zIndex = depthKey(this.x, this.y, 0); // corpses lie under living things
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
