import { TILE_W, TILE_H, TILE_HALF_W, TILE_HALF_H, WALL_H } from "../config";
import { PALETTE as P, css, shade, mix } from "./palette";
import { makeCanvas, ctx2d, diamondPath, speckle, isoPrism } from "./draw";
import { RNG } from "../core/rng";

// Generates the static dungeon tile art. All tiles share the iso diamond
// footprint; walls extend upward as a prism so they occlude correctly when
// depth-sorted.

const FLOOR_PAD = 2;

/** A single stone floor diamond with cracks, grime and occasional moss. */
export function makeFloorTile(rng: RNG, mossy: boolean): HTMLCanvasElement {
  const c = makeCanvas(TILE_W + FLOOR_PAD * 2, TILE_H + FLOOR_PAD * 2);
  const g = ctx2d(c);
  const cx = c.width / 2;
  const topY = FLOOR_PAD;

  const base = rng.chance(0.5) ? P.floor : P.floorAlt;
  diamondPath(g, cx, topY);
  g.fillStyle = css(base);
  g.fill();

  // Inner bevel: subtle darker edge for depth.
  g.save();
  diamondPath(g, cx, topY);
  g.clip();
  // grime gradient
  const grad = g.createLinearGradient(0, topY, 0, topY + TILE_H);
  grad.addColorStop(0, css(shade(base, 1.12), 0.5));
  grad.addColorStop(1, css(shade(base, 0.7), 0.5));
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);

  speckle(g, rng, base, 26, { x: FLOOR_PAD, y: topY, w: TILE_W, h: TILE_H });

  // Cracks
  const cracks = rng.int(0, 2);
  g.strokeStyle = css(P.floorCrack, 0.8);
  g.lineWidth = 1;
  for (let i = 0; i < cracks; i++) {
    let px = cx + rng.range(-TILE_HALF_W * 0.5, TILE_HALF_W * 0.5);
    let py = topY + TILE_HALF_H + rng.range(-6, 6);
    g.beginPath();
    g.moveTo(px, py);
    const segs = rng.int(2, 4);
    for (let s = 0; s < segs; s++) {
      px += rng.range(-8, 8);
      py += rng.range(-5, 5);
      g.lineTo(px, py);
    }
    g.stroke();
  }

  if (mossy) {
    g.fillStyle = css(P.moss, 0.5);
    const patches = rng.int(2, 5);
    for (let i = 0; i < patches; i++) {
      const x = cx + rng.range(-TILE_HALF_W * 0.6, TILE_HALF_W * 0.6);
      const y = topY + TILE_HALF_H + rng.range(-TILE_HALF_H * 0.5, TILE_HALF_H * 0.5);
      g.beginPath();
      g.ellipse(x, y, rng.range(2, 5), rng.range(1, 3), 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Edge ambient occlusion: darken toward the diamond rim so the grout lines
  // between slabs read as recessed grooves and each stone gains a lit center.
  const ao = g.createRadialGradient(
    cx, topY + TILE_HALF_H, TILE_HALF_H * 0.35,
    cx, topY + TILE_HALF_H, TILE_HALF_W,
  );
  ao.addColorStop(0, "rgba(0,0,0,0)");
  ao.addColorStop(1, "rgba(0,0,0,0.34)");
  g.fillStyle = ao;
  g.fillRect(0, 0, c.width, c.height);
  g.restore();

  // Edge highlight
  diamondPath(g, cx, topY);
  g.strokeStyle = css(shade(base, 1.3), 0.25);
  g.lineWidth = 1;
  g.stroke();

  return c;
}

/** A wall tile: a tall stone prism sitting on the tile footprint. */
export function makeWallTile(rng: RNG): HTMLCanvasElement {
  const pad = 2;
  const c = makeCanvas(TILE_W + pad * 2, TILE_H + WALL_H + pad * 2);
  const g = ctx2d(c);
  const cx = c.width / 2;
  const topY = pad;
  isoPrism(g, cx, topY, WALL_H, P.wall, rng);

  // Add some weathering speckle on the top face.
  g.save();
  diamondPath(g, cx, topY);
  g.clip();
  speckle(g, rng, P.wall, 18, { x: pad, y: topY, w: TILE_W, h: TILE_H });
  g.restore();
  return c;
}

/** A wall with a lit wall-torch bracket (drawn on the left face). */
export function makeTorchWallTile(rng: RNG): HTMLCanvasElement {
  const c = makeWallTile(rng);
  const g = ctx2d(c);
  const cx = c.width / 2;
  // Bracket on the left face, mid-height.
  const bx = cx - TILE_HALF_W * 0.5;
  const by = 2 + TILE_HALF_H + WALL_H * 0.35;
  g.fillStyle = css(shade(P.wall, 0.25));
  g.fillRect(bx - 1, by, 3, 10);
  // Flame
  const grad = g.createRadialGradient(bx, by - 4, 0, bx, by - 4, 10);
  grad.addColorStop(0, css(P.torchCore, 1));
  grad.addColorStop(0.5, css(P.torch, 0.9));
  grad.addColorStop(1, css(P.torch, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(bx, by - 4, 6, 9, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** A doorway tile: floor with a dark stone arch frame. */
export function makeDoorTile(rng: RNG): HTMLCanvasElement {
  const c = makeWallTile(rng);
  const g = ctx2d(c);
  const cx = c.width / 2;
  const topY = 2;
  // Cut a dark archway into the front.
  g.fillStyle = css(P.black, 0.92);
  const archW = TILE_HALF_W * 0.8;
  const archTop = topY + TILE_HALF_H + 10;
  const archBottom = topY + TILE_H + WALL_H - 2;
  g.beginPath();
  g.moveTo(cx - archW / 2, archBottom);
  g.lineTo(cx - archW / 2, archTop + 6);
  g.quadraticCurveTo(cx, archTop - 6, cx + archW / 2, archTop + 6);
  g.lineTo(cx + archW / 2, archBottom);
  g.closePath();
  g.fill();
  return c;
}

/** Decorative floor props (rubble pile, bones, blood splat). */
export function makeDecor(rng: RNG, kind: "bones" | "rubble" | "blood"): HTMLCanvasElement {
  const c = makeCanvas(TILE_W, TILE_H + 16);
  const g = ctx2d(c);
  const cx = c.width / 2;
  const cy = TILE_H + 6;
  if (kind === "blood") {
    g.fillStyle = css(P.bloodDark, 0.7);
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(cx + rng.range(-12, 12), cy + rng.range(-4, 4), rng.range(2, 7), rng.range(1, 3), 0, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === "bones") {
    g.strokeStyle = css(P.bone);
    g.fillStyle = css(P.bone);
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = cx + rng.range(-10, 10);
      const y = cy + rng.range(-4, 4);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rng.range(-6, 6), y + rng.range(-4, 4));
      g.stroke();
    }
    // skull
    g.beginPath();
    g.ellipse(cx + rng.range(-6, 6), cy - 2, 4, 3.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(P.black);
    g.fillRect(cx - 2, cy - 3, 1.5, 1.5);
    g.fillRect(cx + 1, cy - 3, 1.5, 1.5);
  } else {
    // rubble
    for (let i = 0; i < 7; i++) {
      g.fillStyle = css(shade(mix(P.wall, P.wallDark, rng.next()), rng.range(0.7, 1.1)));
      const s = rng.range(2, 6);
      g.fillRect(cx + rng.range(-12, 12), cy + rng.range(-4, 4), s, s * 0.7);
    }
  }
  return c;
}
