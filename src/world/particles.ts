import { Container, Sprite } from "pixi.js";
import { Dungeon } from "./dungeon";
import { Assets } from "../assets/assetStore";
import { gridToScreen, dist } from "../core/iso";
import { TILE_HALF_H, WALL_H, TORCH_RADIUS } from "../config";
import { RNG } from "../core/rng";

// Atmospheric particles layered above the world: pale dust motes that drift
// up through the torch pool around the player, and warm embers rising off the
// wall torches. They are faint on their own — the bloom pass blows them into
// the soft floating glows that give the scene depth (à la lmaomoba).

interface Mote {
  sprite: Sprite;
  gx: number; // grid position (so motes live inside the lit pool)
  gy: number;
  ry: number; // pixels risen above the floor this life
  rise: number; // rise speed, px/s
  sway: number; // horizontal sway amplitude, px
  phase: number; // sway phase offset
  life: number;
  maxLife: number;
  baseAlpha: number;
}

interface Ember {
  sprite: Sprite;
  sx: number; // screen anchor (the torch)
  sy: number;
  ry: number;
  rise: number;
  sway: number;
  phase: number;
  life: number;
  maxLife: number;
  active: boolean;
}

const MOTE_COUNT = 54;
const EMBER_COUNT = 44;
const EMBER_RANGE = 8.5; // tiles: torches within this of the player emit embers

export class Particles {
  readonly root = new Container();
  private motes: Mote[] = [];
  private embers: Ember[] = [];
  private torches: { x: number; y: number; sx: number; sy: number }[] = [];
  private rng = new RNG(0x5eed1e);
  private emberAcc = 0;

  constructor(dungeon: Dungeon, assets: Assets) {
    this.root.eventMode = "none";

    for (const idx of dungeon.torchWalls) {
      const x = idx % dungeon.width;
      const y = (idx / dungeon.width) | 0;
      const s = gridToScreen(x, y);
      this.torches.push({ x, y, sx: s.x, sy: s.y + TILE_HALF_H - WALL_H * 0.45 });
    }

    for (let i = 0; i < MOTE_COUNT; i++) {
      const sprite = new Sprite(assets.mote);
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      sprite.alpha = 0;
      this.root.addChild(sprite);
      this.motes.push({
        sprite, gx: 0, gy: 0, ry: 0, rise: 0, sway: 0, phase: 0,
        life: 0, maxLife: 1, baseAlpha: 0,
      });
    }

    for (let i = 0; i < EMBER_COUNT; i++) {
      const sprite = new Sprite(assets.ember);
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      sprite.alpha = 0;
      this.root.addChild(sprite);
      this.embers.push({
        sprite, sx: 0, sy: 0, ry: 0, rise: 0, sway: 0, phase: 0,
        life: 0, maxLife: 1, active: false,
      });
    }
  }

  /** Place a mote at a fresh spot somewhere inside the player's torch pool. */
  private spawnMote(m: Mote, px: number, py: number): void {
    const ang = this.rng.next() * Math.PI * 2;
    const rad = Math.sqrt(this.rng.next()) * TORCH_RADIUS * 0.85;
    m.gx = px + Math.cos(ang) * rad;
    m.gy = py + Math.sin(ang) * rad;
    m.ry = this.rng.range(0, 22);
    m.rise = this.rng.range(5, 16);
    m.sway = this.rng.range(2, 7);
    m.phase = this.rng.next() * Math.PI * 2;
    m.maxLife = this.rng.range(2.6, 5.5);
    m.life = m.maxLife;
    m.baseAlpha = this.rng.range(0.16, 0.44);
    m.sprite.scale.set(this.rng.range(0.35, 0.85));
  }

  private spawnEmber(px: number, py: number, time: number): void {
    // Pick a torch near the player.
    const near = this.torches.filter((t) => dist(t.x, t.y, px, py) < EMBER_RANGE);
    if (near.length === 0) return;
    const slot = this.embers.find((e) => !e.active);
    if (!slot) return;
    const t = near[(this.rng.next() * near.length) | 0];
    slot.active = true;
    slot.sx = t.sx + this.rng.range(-3, 3);
    slot.sy = t.sy + this.rng.range(-2, 2);
    slot.ry = 0;
    slot.rise = this.rng.range(14, 30);
    slot.sway = this.rng.range(3, 9);
    slot.phase = time + this.rng.next() * 6;
    slot.maxLife = this.rng.range(0.9, 1.8);
    slot.life = slot.maxLife;
    slot.sprite.scale.set(this.rng.range(0.35, 0.7));
  }

  update(dt: number, px: number, py: number, time: number): void {
    for (const m of this.motes) {
      m.life -= dt;
      if (m.life <= 0 || dist(m.gx, m.gy, px, py) > TORCH_RADIUS) {
        this.spawnMote(m, px, py);
      }
      m.ry += m.rise * dt;
      const s = gridToScreen(m.gx, m.gy);
      m.sprite.x = s.x + Math.sin(time * 0.8 + m.phase) * m.sway;
      m.sprite.y = s.y + TILE_HALF_H - m.ry;
      // Fade in/out over life, and dim toward the edge of the lit pool.
      const t = m.life / m.maxLife;
      const fade = Math.min(t, 1 - t) * 2; // 0 at ends, 1 mid-life
      const d = dist(m.gx, m.gy, px, py);
      const lit = Math.max(0, 1 - d / TORCH_RADIUS);
      m.sprite.alpha = m.baseAlpha * Math.max(0, fade) * lit * lit;
    }

    // Trickle of embers from nearby torches.
    this.emberAcc += dt;
    const interval = 0.06;
    while (this.emberAcc >= interval) {
      this.emberAcc -= interval;
      if (this.rng.chance(0.5)) this.spawnEmber(px, py, time);
    }
    for (const e of this.embers) {
      if (!e.active) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.active = false;
        e.sprite.alpha = 0;
        continue;
      }
      e.ry += e.rise * dt;
      e.sprite.x = e.sx + Math.sin(time * 3 + e.phase) * e.sway;
      e.sprite.y = e.sy - e.ry;
      const t = e.life / e.maxLife;
      e.sprite.alpha = 0.5 * t * t; // bright at birth, fading as it rises
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
