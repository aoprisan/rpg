import { Container } from "pixi.js";
import { Dungeon } from "../world/dungeon";
import { Assets } from "../assets/assetStore";
import { Enemy, EnemyKind } from "../entities/enemy";
import { RNG } from "../core/rng";
import { dist } from "../core/iso";

// Populates the dungeon with enemies. The first room (player spawn) is left
// clear; deeper rooms get progressively more dangerous packs.

export function spawnEnemies(
  dungeon: Dungeon,
  assets: Assets,
  layer: Container,
  rng: RNG,
  spawn: { x: number; y: number },
): Enemy[] {
  const enemies: Enemy[] = [];
  for (let i = 1; i < dungeon.rooms.length; i++) {
    const room = dungeon.rooms[i];
    const danger = i / dungeon.rooms.length; // 0..1 deeper = harder
    const count = rng.int(1, 2 + Math.floor(danger * 3));
    for (let n = 0; n < count; n++) {
      const pos = dungeon.randomFloorInRoom(room);
      if (dist(pos.x, pos.y, spawn.x, spawn.y) < 6) continue;
      // Weight toward tougher foes deeper in.
      let kind: EnemyKind;
      const roll = rng.next();
      if (roll < 0.5 - danger * 0.2) kind = "skeleton";
      else if (roll < 0.8 - danger * 0.1) kind = "zombie";
      else kind = "cultist";
      const framesKey = kind as keyof Assets["actors"];
      enemies.push(new Enemy(kind, assets.actors[framesKey], pos.x, pos.y, layer, rng));
    }
  }
  return enemies;
}
