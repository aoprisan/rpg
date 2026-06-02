import { PALETTE as P, css, shade, RGB } from "./palette";
import { makeCanvas, ctx2d } from "./draw";

// Ground item / pickup sprites. Small, centered, with a faint ground shadow so
// they read as lying on the dungeon floor.

const ITEM = 28;

function base(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D; cx: number; cy: number } {
  const c = makeCanvas(ITEM, ITEM);
  const g = ctx2d(c);
  const cx = ITEM / 2;
  const cy = ITEM / 2 + 3;
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath();
  g.ellipse(cx, cy + 8, 8, 3, 0, 0, Math.PI * 2);
  g.fill();
  return { c, g, cx, cy };
}

function potion(color: RGB): HTMLCanvasElement {
  const { c, g, cx, cy } = base();
  // glass
  g.fillStyle = "rgba(200,210,220,0.25)";
  g.beginPath();
  g.ellipse(cx, cy + 2, 6, 7, 0, 0, Math.PI * 2);
  g.fill();
  // liquid
  g.fillStyle = css(color);
  g.beginPath();
  g.ellipse(cx, cy + 3, 5, 5.5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = css(shade(color, 1.5), 0.8);
  g.beginPath();
  g.ellipse(cx - 1.5, cy + 1, 1.5, 2, 0, 0, Math.PI * 2);
  g.fill();
  // neck + cork
  g.fillStyle = "rgba(200,210,220,0.35)";
  g.fillRect(cx - 2, cy - 7, 4, 5);
  g.fillStyle = css(shade(P.wall, 0.6));
  g.fillRect(cx - 2.5, cy - 9, 5, 3);
  return c;
}

export function makeHealthPotion(): HTMLCanvasElement {
  return potion(P.potionRed);
}

export function makeManaPotion(): HTMLCanvasElement {
  return potion(P.potionBlue);
}

export function makeGold(): HTMLCanvasElement {
  const { c, g, cx, cy } = base();
  for (let i = 0; i < 6; i++) {
    const x = cx + (Math.cos(i) * 4);
    const y = cy + 3 + (i % 2) * 2 - (i > 3 ? 3 : 0);
    g.fillStyle = css(shade(P.gold, 0.8 + (i % 3) * 0.15));
    g.beginPath();
    g.ellipse(x, y, 3.5, 2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = css(shade(P.gold, 1.4), 0.7);
    g.beginPath();
    g.ellipse(x - 0.8, y - 0.6, 1.2, 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function makeSwordItem(): HTMLCanvasElement {
  const { c, g, cx, cy } = base();
  g.save();
  g.translate(cx, cy);
  g.rotate(-0.6);
  g.fillStyle = css(P.steel);
  g.fillRect(-1.5, -10, 3, 16);
  g.fillStyle = css(shade(P.steel, 1.4), 0.8);
  g.fillRect(-0.5, -10, 1, 16);
  g.fillStyle = css(P.steelDark);
  g.fillRect(-5, 5, 10, 2.5);
  g.fillRect(-1.5, 6, 3, 5);
  g.fillStyle = css(P.gold);
  g.beginPath();
  g.arc(0, 11, 1.8, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return c;
}
