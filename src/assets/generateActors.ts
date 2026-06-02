import { PALETTE as P, RGB, css, shade } from "./palette";
import { makeCanvas, ctx2d, groundShadow, outlined, ACTOR_W, ACTOR_H } from "./draw";

// Procedural humanoid actors. The torso faces the camera; facing direction is
// conveyed by a lean offset and which side the weapon/head turn to. Each actor
// produces an 8-direction set of walk frames plus an attack frame and a corpse.

export interface ActorKit {
  body: RGB; // torso / armor base
  bodyDark: RGB;
  head: RGB; // skin / bone / rot
  accent: RGB; // cloak / cape / detail
  weapon: "sword" | "staff" | "claw" | "none";
  height: number; // overall body height in px
  width: number; // shoulder width in px
}

export interface ActorFrames {
  walk: HTMLCanvasElement[][]; // [dir 0..7][frame]
  attack: HTMLCanvasElement[]; // [dir 0..7]
  dead: HTMLCanvasElement;
}

const WALK_FRAMES = 4;

// Resolve a direction sector (0..7, grid-space CCW from +x) into the screen-space
// facing cues used for drawing: a small lean offset, whether the actor faces
// screen-left, and whether it faces away from the camera.
function facingCues(dir: number): { lx: number; ly: number; facingLeft: boolean; facingAway: boolean } {
  const a = (dir / 8) * Math.PI * 2;
  const gdx = Math.cos(a);
  const gdy = Math.sin(a);
  // Project grid direction to screen direction (2:1 iso).
  const sdx = gdx - gdy;
  const sdy = gdx + gdy;
  return {
    lx: Math.sign(sdx) * Math.min(4, Math.abs(sdx) * 5),
    ly: Math.sign(sdy) * Math.min(4, Math.abs(sdy) * 4),
    facingLeft: sdx < -0.15,
    facingAway: sdy < -0.15,
  };
}

function drawBody(
  g: CanvasRenderingContext2D,
  kit: ActorKit,
  dir: number,
  legPhase: number,
  attack: number, // 0..1 attack swing progress, 0 = none
): void {
  const cx = ACTOR_W / 2;
  const feetY = ACTOR_H - 10;
  const { lx, facingLeft, facingAway } = facingCues(dir);

  const h = kit.height;
  const w = kit.width;
  const hipY = feetY - h * 0.42;
  const shoulderY = feetY - h * 0.86;
  const headY = feetY - h - 2;

  const bob = Math.sin(legPhase * Math.PI * 2) * 1.5;
  const swing = Math.sin(legPhase * Math.PI * 2) * (w * 0.35);

  // Legs
  g.strokeStyle = css(kit.bodyDark);
  g.lineWidth = Math.max(3, w * 0.28);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(cx - 2, hipY + bob);
  g.lineTo(cx - 2 + swing * 0.5, feetY);
  g.moveTo(cx + 2, hipY + bob);
  g.lineTo(cx + 2 - swing * 0.5, feetY);
  g.stroke();

  // Cloak / cape behind torso
  if (kit.accent) {
    g.fillStyle = css(shade(kit.accent, facingAway ? 1.0 : 0.8));
    g.beginPath();
    g.moveTo(cx - w * 0.5 + lx, shoulderY + bob);
    g.lineTo(cx + w * 0.5 + lx, shoulderY + bob);
    g.lineTo(cx + w * 0.35 + lx, hipY + 10 + bob);
    g.lineTo(cx - w * 0.35 + lx, hipY + 10 + bob);
    g.closePath();
    g.fill();
  }

  // Torso
  g.fillStyle = css(kit.body);
  g.beginPath();
  g.moveTo(cx - w * 0.45 + lx, shoulderY + bob);
  g.lineTo(cx + w * 0.45 + lx, shoulderY + bob);
  g.lineTo(cx + w * 0.32 + lx, hipY + 4 + bob);
  g.lineTo(cx - w * 0.32 + lx, hipY + 4 + bob);
  g.closePath();
  g.fill();
  // torso shading
  g.fillStyle = css(kit.bodyDark, 0.5);
  g.fillRect(cx + lx, shoulderY + bob, w * 0.32, hipY - shoulderY + 4);
  // Torch-lit highlight down the near shoulder/chest edge for form.
  g.strokeStyle = css(shade(kit.body, 1.5), 0.5);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - w * 0.42 + lx, shoulderY + 1 + bob);
  g.lineTo(cx - w * 0.3 + lx, hipY + 3 + bob);
  g.stroke();

  // Arms + weapon
  const armY = shoulderY + 3 + bob;
  const wside = facingLeft ? -1 : 1;
  // Back arm
  g.strokeStyle = css(shade(kit.body, 0.8));
  g.lineWidth = Math.max(2.5, w * 0.2);
  g.beginPath();
  g.moveTo(cx - w * 0.4 * wside + lx, armY);
  g.lineTo(cx - w * 0.5 * wside + lx, armY + h * 0.28);
  g.stroke();

  // Front (weapon) arm, raises during attack
  const reach = h * 0.3 * (1 - attack) + h * 0.05;
  const ax = cx + w * 0.45 * wside + lx;
  const ay = armY;
  const handX = ax + (w * 0.4 + 6 * attack) * wside;
  const handY = ay + reach - attack * h * 0.4;
  g.strokeStyle = css(kit.body);
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(handX, handY);
  g.stroke();

  drawWeapon(g, kit, handX, handY, wside, attack, facingAway);

  // Head
  g.fillStyle = css(kit.head);
  g.beginPath();
  g.ellipse(cx + lx * 0.6, headY + bob, w * 0.26, w * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  // Hood/helm shadow on away-facing
  if (facingAway) {
    g.fillStyle = css(kit.accent || kit.bodyDark, 0.85);
    g.beginPath();
    g.ellipse(cx + lx * 0.6, headY + bob, w * 0.28, w * 0.32, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    // eyes
    g.fillStyle = "rgba(10,8,8,0.9)";
    g.fillRect(cx + lx * 0.6 - 3, headY + bob - 1, 1.6, 2);
    g.fillRect(cx + lx * 0.6 + 1.4, headY + bob - 1, 1.6, 2);
  }

  // Torch rim light: a thin lit lip along the upper-left edge of the head and
  // across the near shoulder for a touch of glossy form. Kept gentle so the
  // bloom pass adds a soft sheen rather than washing the sprite to white.
  g.strokeStyle = css(shade(facingAway ? kit.accent || kit.head : kit.head, 1.32), 0.32);
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx + lx * 0.6, headY + bob, w * 0.27, Math.PI * 1.0, Math.PI * 1.55);
  g.stroke();
  g.strokeStyle = css(shade(kit.body, 1.4), 0.28);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - w * 0.42 + lx, shoulderY + bob - 0.5);
  g.lineTo(cx + w * 0.12 + lx, shoulderY + bob - 0.5);
  g.stroke();
}

function drawWeapon(
  g: CanvasRenderingContext2D,
  kit: ActorKit,
  x: number,
  y: number,
  wside: number,
  attack: number,
  facingAway: boolean,
): void {
  if (kit.weapon === "none") return;
  g.save();
  g.translate(x, y);
  const rot = (facingAway ? -0.4 : 0.5) * wside - attack * 1.2 * wside;
  g.rotate(rot);
  if (kit.weapon === "sword") {
    g.fillStyle = css(P.steel);
    g.fillRect(-1.5, -22, 3, 22);
    g.fillStyle = css(P.steelDark);
    g.fillRect(-5, -2, 10, 3); // guard
    g.fillStyle = css(P.steelDark);
    g.fillRect(-1.5, 0, 3, 6); // hilt
  } else if (kit.weapon === "staff") {
    g.strokeStyle = css(shade(P.steelDark, 1.1));
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, 6);
    g.lineTo(0, -24);
    g.stroke();
    const grad = g.createRadialGradient(0, -26, 0, 0, -26, 7);
    grad.addColorStop(0, css(P.magicCore, 1));
    grad.addColorStop(1, css(P.magic, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, -26, 7, 0, Math.PI * 2);
    g.fill();
  } else if (kit.weapon === "claw") {
    g.strokeStyle = css(P.bone);
    g.lineWidth = 1.6;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(i * 3, 0);
      g.lineTo(i * 3 + i * 2, 9);
      g.stroke();
    }
  }
  g.restore();
}

function renderFrame(kit: ActorKit, dir: number, legPhase: number, attack: number): HTMLCanvasElement {
  // Draw the figure on its own layer, outline it, then drop it onto a base that
  // already holds the soft ground shadow (which must stay un-outlined).
  const c = makeCanvas(ACTOR_W, ACTOR_H);
  const g = ctx2d(c);
  groundShadow(g, ACTOR_W / 2, ACTOR_H - 8, kit.width * 0.9);

  const body = makeCanvas(ACTOR_W, ACTOR_H);
  drawBody(ctx2d(body), kit, dir, legPhase, attack);
  g.drawImage(outlined(body), 0, 0);
  return c;
}

function renderDead(kit: ActorKit): HTMLCanvasElement {
  const c = makeCanvas(ACTOR_W, ACTOR_H);
  const g = ctx2d(c);
  const cx = ACTOR_W / 2;
  const cy = ACTOR_H - 14;
  groundShadow(g, cx, cy + 4, kit.width);
  // Blood pool (stays soft / un-outlined).
  g.fillStyle = css(P.bloodDark, 0.6);
  g.beginPath();
  g.ellipse(cx, cy + 4, kit.width * 1.1, kit.width * 0.5, 0, 0, Math.PI * 2);
  g.fill();

  // Sprawled body on its own layer so it gets a crisp outline.
  const body = makeCanvas(ACTOR_W, ACTOR_H);
  const bg = ctx2d(body);
  bg.save();
  bg.translate(cx, cy);
  bg.rotate(0.2);
  bg.fillStyle = css(kit.body);
  bg.fillRect(-kit.width * 0.6, -kit.width * 0.3, kit.width * 1.2, kit.width * 0.6);
  bg.fillStyle = css(kit.head);
  bg.beginPath();
  bg.ellipse(-kit.width * 0.7, -kit.width * 0.1, kit.width * 0.26, kit.width * 0.26, 0, 0, Math.PI * 2);
  bg.fill();
  bg.restore();
  g.drawImage(outlined(body), 0, 0);
  return c;
}

export function generateActor(kit: ActorKit): ActorFrames {
  const walk: HTMLCanvasElement[][] = [];
  const attack: HTMLCanvasElement[] = [];
  for (let dir = 0; dir < 8; dir++) {
    const frames: HTMLCanvasElement[] = [];
    for (let f = 0; f < WALK_FRAMES; f++) {
      frames.push(renderFrame(kit, dir, f / WALK_FRAMES, 0));
    }
    walk.push(frames);
    attack.push(renderFrame(kit, dir, 0, 1));
  }
  return { walk, attack, dead: renderDead(kit) };
}

// --- Predefined kits ---

export const PLAYER_KIT: ActorKit = {
  body: P.steelDark,
  bodyDark: shade(P.steelDark, 0.6),
  head: P.skin,
  accent: P.cloak,
  weapon: "sword",
  height: 40,
  width: 18,
};

export const SKELETON_KIT: ActorKit = {
  body: P.bone,
  bodyDark: P.boneShadow,
  head: P.bone,
  accent: shade(P.boneShadow, 0.7),
  weapon: "sword",
  height: 36,
  width: 15,
};

export const ZOMBIE_KIT: ActorKit = {
  body: P.rot,
  bodyDark: P.rotDark,
  head: P.rot,
  accent: shade(P.rotDark, 0.8),
  weapon: "claw",
  height: 34,
  width: 17,
};

export const CULTIST_KIT: ActorKit = {
  body: P.cloakDark,
  bodyDark: shade(P.cloakDark, 0.6),
  head: P.skin,
  accent: P.blood,
  weapon: "staff",
  height: 38,
  width: 16,
};
