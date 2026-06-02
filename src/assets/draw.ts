import { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H } from "../config";
import { RGB, css, shade, mix, FACE_TOP, FACE_LEFT, FACE_RIGHT } from "./palette";
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
    // Recessed mortar courses (dark groove + a thin lit lip beneath it) give
    // the side faces real stonework relief instead of flat shaded quads.
    for (let yy = topY + TILE_HALF_H + 10; yy < topY + TILE_HALF_H + h; yy += 12) {
      g.strokeStyle = css(shade(color, 0.28), 0.6);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(leftV[0], yy);
      g.lineTo(bottomV[0], yy + TILE_HALF_H);
      g.lineTo(rightV[0], yy);
      g.stroke();
      g.strokeStyle = css(shade(color, 1.25), 0.18);
      g.beginPath();
      g.moveTo(leftV[0], yy + 1);
      g.lineTo(bottomV[0], yy + TILE_HALF_H + 1);
      g.lineTo(rightV[0], yy + 1);
      g.stroke();
    }

    // Vertical joints between bricks, following each slanted face.
    g.strokeStyle = css(shade(color, 0.28), 0.45);
    g.lineWidth = 1;
    for (const p of [0.33, 0.66]) {
      let jx = leftV[0] + p * TILE_HALF_W;
      let jy = leftV[1] + p * TILE_HALF_H;
      g.beginPath();
      g.moveTo(jx, jy);
      g.lineTo(jx, jy + h);
      g.stroke();
      jx = bottomV[0] + p * TILE_HALF_W;
      jy = bottomV[1] - p * TILE_HALF_H;
      g.beginPath();
      g.moveTo(jx, jy);
      g.lineTo(jx, jy + h);
      g.stroke();
    }

    // Torch-catching highlight along the two front top edges of the cap.
    g.strokeStyle = css(shade(color, 1.7), 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(leftV[0], leftV[1]);
    g.lineTo(bottomV[0], bottomV[1]);
    g.lineTo(rightV[0], rightV[1]);
    g.stroke();

    // Ambient occlusion darkening at the base where the wall meets the floor.
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.moveTo(leftV[0], leftV[1] + h);
    g.lineTo(bottomV[0], bottomV[1] + h);
    g.lineTo(rightV[0], rightV[1] + h);
    g.lineTo(rightV[0], rightV[1] + h - 7);
    g.lineTo(bottomV[0], bottomV[1] + h - 7);
    g.lineTo(leftV[0], leftV[1] + h - 7);
    g.closePath();
    g.fill();
  }
}

/** Soft radial glow used for torches, magic, light sprites. */
export function radialGlow(size: number, inner: RGB, outer: RGB): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  // A hot, near-white core that bleeds into the warm/colored outer falloff for
  // a softer, more volumetric bloom than a single linear ramp.
  grad.addColorStop(0, css(inner, 1));
  grad.addColorStop(0.16, css(inner, 0.82));
  grad.addColorStop(0.42, css(mix(inner, outer, 0.6), 0.4));
  grad.addColorStop(0.72, css(outer, 0.12));
  grad.addColorStop(1, css(outer, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** A full-screen vignette: transparent center fading to dark, gothic corners. */
export function makeVignette(size = 512): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.62);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.62, "rgba(3,2,6,0.12)");
  grad.addColorStop(1, "rgba(3,2,6,0.74)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Fill the opaque pixels of `src` with a flat color (its silhouette). */
function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, src.width, src.height);
  return c;
}

/**
 * Stamp a 1px dark outline around the opaque pixels of `src` and draw `src` on
 * top. A crisp outline keeps sprites legible against the near-black dungeon.
 */
export function outlined(src: HTMLCanvasElement, color = "rgba(6,5,9,0.92)"): HTMLCanvasElement {
  const sil = silhouette(src, color);
  const c = makeCanvas(src.width, src.height);
  const g = ctx2d(c);
  const offsets = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];
  for (const [dx, dy] of offsets) g.drawImage(sil, dx, dy);
  g.drawImage(src, 0, 0);
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
