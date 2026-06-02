import { TILE_HALF_W, TILE_HALF_H } from "../config";

// Conversions between dungeon grid space (tile x/y, may be fractional for
// smooth movement) and screen space (pixels) for a 2:1 isometric projection.
//
// Screen origin is the projection of grid (0,0). The world container is then
// translated by the camera so the player stays centered.

export interface Point {
  x: number;
  y: number;
}

/** Grid coordinates -> screen pixel coordinates (top of the tile diamond). */
export function gridToScreen(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * TILE_HALF_W,
    y: (gx + gy) * TILE_HALF_H,
  };
}

/** Screen pixel coordinates -> fractional grid coordinates. */
export function screenToGrid(sx: number, sy: number): Point {
  const gx = (sx / TILE_HALF_W + sy / TILE_HALF_H) / 2;
  const gy = (sy / TILE_HALF_H - sx / TILE_HALF_W) / 2;
  return { x: gx, y: gy };
}

/**
 * Depth sort key: objects with a larger (x + y) are "closer" to the camera and
 * draw on top. We scale by a large factor and add a small layer bias so e.g.
 * walls/entities on the same tile order predictably.
 */
export function depthKey(gx: number, gy: number, layerBias = 0): number {
  return (gx + gy) * 1000 + layerBias;
}

/** Euclidean tile distance. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Map a grid-space movement delta to one of 8 facing sectors (0=+x, CCW). */
export function gridFacing8(gdx: number, gdy: number): number {
  if (gdx === 0 && gdy === 0) return 6;
  const a = Math.atan2(gdy, gdx);
  return ((Math.round((a / (Math.PI * 2)) * 8) % 8) + 8) % 8;
}

/** Inverse of gridFacing8: a unit grid-space vector for an 8-way facing sector. */
export function facing8ToVector(dir: number): Point {
  const a = (dir / 8) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
}
