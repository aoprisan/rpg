import { Container } from "pixi.js";
import { CAMERA_LERP } from "../config";

// Smoothly keeps a world-space point (the player) centered on screen by
// translating the world container.

export class Camera {
  private targetX = 0;
  private targetY = 0;

  constructor(
    private world: Container,
    private screenW: number,
    private screenH: number,
  ) {}

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
  }

  /** Center on the given world (screen-space, pre-camera) coordinates. */
  follow(worldX: number, worldY: number, snap = false): void {
    this.targetX = this.screenW / 2 - worldX;
    this.targetY = this.screenH / 2 - worldY;
    if (snap) {
      this.world.x = this.targetX;
      this.world.y = this.targetY;
    } else {
      this.world.x += (this.targetX - this.world.x) * CAMERA_LERP;
      this.world.y += (this.targetY - this.world.y) * CAMERA_LERP;
    }
  }
}
