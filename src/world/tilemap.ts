import { Container, Sprite } from "pixi.js";
import { Dungeon, Tile } from "./dungeon";
import { Assets } from "../assets/assetStore";
import { gridToScreen, depthKey } from "../core/iso";
import { FLOOR_OFFSET_FIX } from "./layout";

// Builds the static isometric scene: a flat floor layer plus a depth-sorted
// object layer holding walls and decor. Dynamic entities are added to the same
// object layer by the game so they sort against walls correctly.

export class TileMap {
  readonly root = new Container();
  readonly floorLayer = new Container();
  readonly objectLayer = new Container();

  constructor(
    private dungeon: Dungeon,
    private assets: Assets,
  ) {
    this.objectLayer.sortableChildren = true;
    this.root.addChild(this.floorLayer, this.objectLayer);
    this.build();
  }

  private build(): void {
    const d = this.dungeon;
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        const t = d.get(x, y);
        const s = gridToScreen(x, y);

        if (t === Tile.Floor || t === Tile.Door) {
          // Floor diamond (every open tile sits on a floor).
          const variant = (x * 7 + y * 13) % this.assets.floors.length;
          const floor = new Sprite(this.assets.floors[variant]);
          floor.anchor.set(0.5, 0);
          floor.x = s.x;
          floor.y = s.y - 2; // account for floor canvas top padding
          this.floorLayer.addChild(floor);
        }

        if (t === Tile.Door) {
          const door = new Sprite(this.assets.door);
          door.anchor.set(0.5, 0);
          door.x = s.x;
          door.y = s.y - 2;
          door.zIndex = depthKey(x, y, 2);
          this.objectLayer.addChild(door);
        }
      }
    }

    // Exposed walls as prisms in the object layer (depth sorted).
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        if (!d.isExposedWall(x, y)) continue;
        const s = gridToScreen(x, y);
        const torch = d.torchWalls.has(y * d.width + x);
        const wall = new Sprite(torch ? this.assets.torchWall : this.assets.wall);
        wall.anchor.set(0.5, 0);
        wall.x = s.x;
        wall.y = s.y - 2;
        wall.zIndex = depthKey(x, y, 2);
        this.objectLayer.addChild(wall);
      }
    }

    // Scatter decor on a sparse set of floor tiles.
    const rng = d.rng;
    const kinds = ["bones", "rubble", "blood"] as const;
    for (let y = 0; y < d.height; y++) {
      for (let x = 0; x < d.width; x++) {
        if (d.get(x, y) !== Tile.Floor) continue;
        if (!rng.chance(0.06)) continue;
        const kind = rng.pick(kinds);
        const s = gridToScreen(x, y);
        const dec = new Sprite(this.assets.decor[kind]);
        dec.anchor.set(0.5, 0);
        dec.x = s.x;
        dec.y = s.y - FLOOR_OFFSET_FIX;
        dec.zIndex = depthKey(x, y, 1);
        this.objectLayer.addChild(dec);
      }
    }
  }
}
