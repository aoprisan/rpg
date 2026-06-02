import { RNG } from "../core/rng";
import {
  MAP_W,
  MAP_H,
  MIN_ROOMS,
  MAX_ROOMS,
  ROOM_MIN,
  ROOM_MAX,
} from "../config";
import { GridLike } from "../core/pathfinding";

export const enum Tile {
  Wall = 0,
  Floor = 1,
  Door = 2,
}

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export class Dungeon implements GridLike {
  readonly width = MAP_W;
  readonly height = MAP_H;
  readonly tiles: Uint8Array;
  readonly rooms: Room[] = [];
  /** Walls flagged to carry a lit torch bracket (for ambient light + look). */
  readonly torchWalls = new Set<number>();
  readonly rng: RNG;

  constructor(seed: number) {
    this.rng = new RNG(seed);
    this.tiles = new Uint8Array(MAP_W * MAP_H).fill(Tile.Wall);
    this.generate();
  }

  private idx(x: number, y: number): number {
    return y * this.width + x;
  }

  get(x: number, y: number): Tile {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return Tile.Wall;
    return this.tiles[this.idx(x, y)] as Tile;
  }

  isWalkable(x: number, y: number): boolean {
    const t = this.get(x, y);
    return t === Tile.Floor || t === Tile.Door;
  }

  /** True if this tile is a solid wall that should be drawn as a prism. */
  isWall(x: number, y: number): boolean {
    return this.get(x, y) === Tile.Wall;
  }

  /** A wall tile is only "visible"/drawn if it borders any open tile. */
  isExposedWall(x: number, y: number): boolean {
    if (!this.isWall(x, y)) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.isWalkable(x + dx, y + dy)) return true;
      }
    }
    return false;
  }

  private carveRoom(r: Room): void {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        this.tiles[this.idx(x, y)] = Tile.Floor;
      }
    }
  }

  private carveCorridor(x1: number, y1: number, x2: number, y2: number): void {
    let x = x1;
    let y = y1;
    const horizFirst = this.rng.chance(0.5);
    const stepH = () => {
      while (x !== x2) {
        this.tiles[this.idx(x, y)] = Tile.Floor;
        x += x2 > x ? 1 : -1;
      }
    };
    const stepV = () => {
      while (y !== y2) {
        this.tiles[this.idx(x, y)] = Tile.Floor;
        y += y2 > y ? 1 : -1;
      }
    };
    if (horizFirst) {
      stepH();
      stepV();
    } else {
      stepV();
      stepH();
    }
    this.tiles[this.idx(x2, y2)] = Tile.Floor;
  }

  private overlaps(r: Room): boolean {
    for (const o of this.rooms) {
      if (
        r.x - 1 < o.x + o.w &&
        r.x + r.w + 1 > o.x &&
        r.y - 1 < o.y + o.h &&
        r.y + r.h + 1 > o.y
      ) {
        return true;
      }
    }
    return false;
  }

  private generate(): void {
    const target = this.rng.int(MIN_ROOMS, MAX_ROOMS);
    let attempts = 0;
    while (this.rooms.length < target && attempts < 400) {
      attempts++;
      const w = this.rng.int(ROOM_MIN, ROOM_MAX);
      const h = this.rng.int(ROOM_MIN, ROOM_MAX);
      const x = this.rng.int(2, this.width - w - 2);
      const y = this.rng.int(2, this.height - h - 2);
      const room: Room = { x, y, w, h, cx: (x + w / 2) | 0, cy: (y + h / 2) | 0 };
      if (this.overlaps(room)) continue;
      this.carveRoom(room);
      if (this.rooms.length > 0) {
        const prev = this.rooms[this.rooms.length - 1];
        this.carveCorridor(prev.cx, prev.cy, room.cx, room.cy);
      }
      this.rooms.push(room);
    }

    // Place doors where corridors pierce room walls (single-width floor in a wall run).
    this.placeDoors();
    this.placeTorches();
  }

  private placeDoors(): void {
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        if (this.get(x, y) !== Tile.Floor) continue;
        const horiz = this.isWall(x - 1, y) && this.isWall(x + 1, y);
        const vert = this.isWall(x, y - 1) && this.isWall(x, y + 1);
        const openH = this.isWalkable(x, y - 1) && this.isWalkable(x, y + 1);
        const openV = this.isWalkable(x - 1, y) && this.isWalkable(x + 1, y);
        if ((horiz && openH) || (vert && openV)) {
          if (this.rng.chance(0.7)) this.tiles[this.idx(x, y)] = Tile.Door;
        }
      }
    }
  }

  private placeTorches(): void {
    // Flag a sparse set of exposed walls to bear torches for ambient light.
    for (const room of this.rooms) {
      const count = this.rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const tx = this.rng.int(room.x, room.x + room.w - 1);
        const ty = room.y - 1;
        if (this.isExposedWall(tx, ty)) this.torchWalls.add(this.idx(tx, ty));
      }
    }
  }

  /** Player spawn = center of the first room. */
  get spawn(): { x: number; y: number } {
    const r = this.rooms[0];
    return { x: r.cx, y: r.cy };
  }

  /** Random walkable tile inside a given room (rounded). */
  randomFloorInRoom(room: Room): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (let i = 0; i < 12; i++) {
      x = this.rng.int(room.x, room.x + room.w - 1);
      y = this.rng.int(room.y, room.y + room.h - 1);
      if (this.isWalkable(x, y)) break;
    }
    return { x, y };
  }
}
