import { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H } from "../config";
import { RGB, css, shade, FACE_TOP, FACE_LEFT, FACE_RIGHT } from "./palette";
import { RNG } from "../core/rng";

// Low-level canvas helpers for drawing the procedural pixel art.

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext("2d");
  if (!g) throw new Error("2D canvas context unavailable");
  g.imageSmoothingEnabled = false;
  return g;
}

/**
 * Trace the top diamond face of an iso tile, centered horizontally, with its
 * top vertex at y=topY. Returns the four vertices for reuse.
 */
export function diamondPath(
  g: CanvasRenderingContext2D,
  cx: number,
  topY: number,
): { top: [number, number]; right: [number, number]; bottom: [number, number]; left: [number, number] } {
  const top: [number, number] = [cx, topY];
  const right: [number, number] = [cx + TILE_HALF_W, topY + TILE_HALF_H];
  const bottom: [number, number] = [cx, topY + TILE_H];
  const left: [number, number] = [cx - TILE_HALF_W, topY + TILE_HALF_H];
  g.beginPath();
  g.moveTo(top[0], top[1]);
  g.lineTo(right[0], right[1]);
  g.lineTo(bottom[0], bottom[1]);
  g.lineTo(left[0], left[1]);
  g.closePath();
  return { top, right, bottom, left };
}

/** Scatter small darker/lighter speckles inside the current clip for texture. */
export function speckle(
  g: CanvasRenderingContext2D,
  rng: RNG,
  base: RGB,
  count: number,
  bounds: { x: number; y: number; w: number; h: number },
): void {
  for (let i = 0; i < count; i++) {
    const x = bounds.x + rng.next() * bounds.w;
    const y = bounds.y + rng.next() * bounds.h;
    const f = rng.range(0.7, 1.25);
    g.fillStyle = css(shade(base, f), 0.5);
    const s = rng.next() < 0.85 ? 1 : 2;
    g.fillRect(x | 0, y | 0, s, s);
  }
}

/**
 * Draw a filled, lit iso prism (a cube column) of height `h` pixels with its
 * top diamond's top vertex at (cx, topY). Used for walls. The top face is
 * brightest, left face mid, right face darkest — consistent gothic lighting.
 */
export function isoPrism(
  g: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  h: number,
  color: RGB,
  rng?: RNG,
): void {
  const topV = [cx, topY];
  const rightV = [cx + TILE_HALF_W, topY + TILE_HALF_H];
  const bottomV = [cx, topY + TILE_H];
  const leftV = [cx - TILE_HALF_W, topY + TILE_HALF_H];

  // Left face (bottom-left quad going down).
  g.fillStyle = css(shade(color, FACE_LEFT));
  g.beginPath();
  g.moveTo(leftV[0], leftV[1]);
  g.lineTo(bottomV[0], bottomV[1]);
  g.lineTo(bottomV[0], bottomV[1] + h);
  g.lineTo(leftV[0], leftV[1] + h);
  g.closePath();
  g.fill();

  // Right face.
  g.fillStyle = css(shade(color, FACE_RIGHT));
  g.beginPath();
  g.moveTo(bottomV[0], bottomV[1]);
  g.lineTo(rightV[0], rightV[1]);
  g.lineTo(rightV[0], rightV[1] + h);
  g.lineTo(bottomV[0], bottomV[1] + h);
  g.closePath();
  g.fill();

  // Top face.
  g.fillStyle = css(shade(color, FACE_TOP));
  g.beginPath();
  g.moveTo(topV[0], topV[1]);
  g.lineTo(rightV[0], rightV[1]);
  g.lineTo(bottomV[0], bottomV[1]);
  g.lineTo(leftV[0], leftV[1]);
  g.closePath();
  g.fill();

  if (rng) {
    // Mortar/brick lines on the faces for stonework feel.
    g.strokeStyle = css(shade(color, 0.3), 0.6);
    g.lineWidth = 1;
    for (let yy = topY + TILE_HALF_H + 8; yy < topY + TILE_HALF_H + h; yy += 12) {
      g.beginPath();
      g.moveTo(leftV[0], yy);
      g.lineTo(bottomV[0], yy + TILE_HALF_H);
      g.lineTo(rightV[0], yy);
      g.stroke();
    }
  }
}

/** Soft radial glow used for torches, magic, light sprites. */
export function radialGlow(size: number, inner: RGB, outer: RGB): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, css(inner, 1));
  grad.addColorStop(0.4, css(inner, 0.55));
  grad.addColorStop(1, css(outer, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

// Standard sprite frame size for actors (room for the iso footprint + height).
export const ACTOR_W = TILE_W;
export const ACTOR_H = TILE_H * 2 + 24;

/** Draw a soft elliptical ground shadow at the actor's feet. */
export function groundShadow(g: CanvasRenderingContext2D, cx: number, cy: number, rw: number): void {
  g.save();
  g.fillStyle = "rgba(0,0,0,0.38)";
  g.beginPath();
  g.ellipse(cx, cy, rw, rw * 0.5, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
