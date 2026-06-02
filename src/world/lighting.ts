import { Container, Graphics, Sprite } from "pixi.js";
import { Dungeon } from "./dungeon";
import { Assets } from "../assets/assetStore";
import { gridToScreen, dist } from "../core/iso";
import {
  TILE_HALF_W,
  TILE_HALF_H,
  TILE_H,
  WALL_H,
  TORCH_RADIUS,
  TORCH_FLICKER,
  FOG_EXPLORED_DIM,
} from "../config";

// Torch-lit visibility + fog of war. A world-space dark Graphics is rebuilt
// whenever the player steps onto a new tile (cheap, infrequent): tiles within
// the torch radius are clear, explored-but-dark tiles stay dimly visible, and
// never-seen tiles are pure black. A separate additive warm glow follows the
// player every frame for a living, flickering torch feel.

const INNER_FRAC = 0.55; // fraction of torch radius that is fully bright
const TORCH_WALL_RADIUS = 3.6;

export class Lighting {
  readonly root = new Container();
  private fog = new Graphics();
  private playerGlow: Sprite;
  private playerPool: Sprite;
  private wallGlows: { sprite: Sprite; base: number; seed: number }[] = [];
  private explored: Uint8Array;
  private lastTX = -999;
  private lastTY = -999;
  private torchWallTiles: { x: number; y: number }[] = [];

  constructor(
    private dungeon: Dungeon,
    assets: Assets,
  ) {
    this.explored = new Uint8Array(dungeon.width * dungeon.height);
    this.root.addChild(this.fog);

    // Static warm glow at each wall torch.
    for (const idx of dungeon.torchWalls) {
      const x = idx % dungeon.width;
      const y = (idx / dungeon.width) | 0;
      this.torchWallTiles.push({ x, y });
      const s = gridToScreen(x, y);
      const glow = new Sprite(assets.torchGlow);
      glow.anchor.set(0.5);
      glow.blendMode = "add";
      glow.alpha = 0.45;
      glow.scale.set(0.55);
      glow.x = s.x;
      glow.y = s.y + TILE_HALF_H - WALL_H * 0.4;
      this.root.addChild(glow);
      this.wallGlows.push({ sprite: glow, base: 0.45, seed: (x * 13 + y * 7) % 100 });
    }

    // Wide, dim pool that softly washes the floor around the player so the lit
    // area reads as a gradient instead of a hard torch disc.
    this.playerPool = new Sprite(assets.torchGlow);
    this.playerPool.anchor.set(0.5);
    this.playerPool.blendMode = "add";
    this.playerPool.alpha = 0.1;
    this.playerPool.scale.set(2.6);
    this.root.addChild(this.playerPool);

    // Player torch glow (flickers).
    this.playerGlow = new Sprite(assets.torchGlow);
    this.playerGlow.anchor.set(0.5);
    this.playerGlow.blendMode = "add";
    this.playerGlow.alpha = 0.42;
    this.root.addChild(this.playerGlow);
  }

  /** True if the player has ever seen this tile (used to keep loot/enemies hidden in fog). */
  isExplored(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.dungeon.width || y >= this.dungeon.height) return false;
    return this.explored[y * this.dungeon.width + x] === 1;
  }

  /** Current torch radius including flicker, in tiles. */
  litRadius(time: number): number {
    return TORCH_RADIUS + Math.sin(time * 7.3) * TORCH_FLICKER + Math.sin(time * 2.1) * TORCH_FLICKER * 0.5;
  }

  update(px: number, py: number, time: number): void {
    const s = gridToScreen(px, py);
    this.playerGlow.x = s.x;
    this.playerGlow.y = s.y + TILE_HALF_H;
    const flick = 1 + Math.sin(time * 9) * 0.05 + Math.sin(time * 3.3) * 0.04;
    this.playerGlow.scale.set(1.7 * flick);
    this.playerGlow.alpha = 0.32 + Math.sin(time * 11) * 0.03;
    this.playerPool.x = s.x;
    this.playerPool.y = s.y + TILE_HALF_H;
    this.playerPool.scale.set(2.6 * (1 + Math.sin(time * 2.7) * 0.03));
    this.playerPool.alpha = 0.1 + Math.sin(time * 5.1) * 0.015;

    // Each wall torch breathes on its own offset rhythm.
    for (const w of this.wallGlows) {
      const t = time * 6 + w.seed;
      w.sprite.alpha = w.base + Math.sin(t) * 0.06 + Math.sin(t * 0.41) * 0.04;
      w.sprite.scale.set(0.55 * (1 + Math.sin(t * 0.7) * 0.04));
    }

    const tx = Math.round(px);
    const ty = Math.round(py);
    if (tx !== this.lastTX || ty !== this.lastTY) {
      this.lastTX = tx;
      this.lastTY = ty;
      this.rebuild(tx, ty);
    }
  }

  private brightnessAt(tx: number, ty: number, x: number, y: number): number {
    const r = TORCH_RADIUS;
    const inner = r * INNER_FRAC;
    const d = dist(x, y, tx, ty);
    let lit = d <= inner ? 1 : d >= r ? 0 : 1 - (d - inner) / (r - inner);
    // Ambient light from wall torches.
    for (const t of this.torchWallTiles) {
      const td = dist(x, y, t.x, t.y);
      if (td < TORCH_WALL_RADIUS) {
        lit = Math.max(lit, (1 - td / TORCH_WALL_RADIUS) * 0.75);
      }
    }
    return lit;
  }

  private rebuild(tx: number, ty: number): void {
    const d = this.dungeon;
    const g = this.fog;
    g.clear();

    // Mark explored tiles within the lit radius.
    const r = Math.ceil(TORCH_RADIUS) + 1;
    for (let y = ty - r; y <= ty + r; y++) {
      for (let x = tx - r; x <= tx + r; x++) {
        if (x < 0 || y < 0 || x >= d.width || y >= d.height) continue;
        if (this.brightnessAt(tx, ty, x, y) > 0.05) {
          this.explored[y * d.width + x] = 1;
        }
      }
    }

    // Draw darkness over every open tile and exposed wall.
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        const open = d.isWalkable(x, y);
        const wall = d.isExposedWall(x, y);
        if (!open && !wall) continue;

        const explored = this.explored[y * d.width + x] === 1;
        const lit = explored ? this.brightnessAt(tx, ty, x, y) : 0;
        let alpha: number;
        if (!explored) alpha = 1;
        else alpha = Math.min(1 - lit, FOG_EXPLORED_DIM);
        if (alpha <= 0.02) continue; // fully lit: no overlay

        const s = gridToScreen(x, y);
        if (wall) {
          // Match the wall prism silhouette so the whole wall darkens cleanly.
          g.poly([
            s.x, s.y - 2,
            s.x + TILE_HALF_W, s.y + TILE_HALF_H - 2,
            s.x + TILE_HALF_W, s.y + TILE_HALF_H + WALL_H - 2,
            s.x, s.y + TILE_H + WALL_H - 2,
            s.x - TILE_HALF_W, s.y + TILE_HALF_H + WALL_H - 2,
            s.x - TILE_HALF_W, s.y + TILE_HALF_H - 2,
          ]);
        } else {
          g.poly([
            s.x, s.y,
            s.x + TILE_HALF_W, s.y + TILE_HALF_H,
            s.x, s.y + TILE_H,
            s.x - TILE_HALF_W, s.y + TILE_HALF_H,
          ]);
        }
        g.fill({ color: 0x05040a, alpha });
      }
    }
  }
}
