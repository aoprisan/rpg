import { Container } from "pixi.js";
import { Enemy } from "../entities/enemy";
import { Loot, LootKind } from "../entities/loot";
import { Assets } from "../assets/assetStore";
import { RNG } from "../core/rng";
import { Dungeon } from "../world/dungeon";

// Loot drop tables and helpers. Kept separate from movement/AI so balance is in
// one place.

const TEXTURE_FOR: Record<LootKind, keyof Assets["items"]> = {
  health: "health",
  mana: "mana",
  gold: "gold",
  sword: "sword",
};

/** Roll a drop when an enemy dies and, if any, place it on the floor. */
export function rollLoot(
  enemy: Enemy,
  dungeon: Dungeon,
  assets: Assets,
  layer: Container,
  rng: RNG,
): Loot | null {
  // Find a free-ish tile at the corpse.
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  if (!dungeon.isWalkable(x, y)) return null;

  const roll = rng.next();
  let kind: LootKind;
  let amount = 1;
  if (roll < 0.42) {
    kind = "gold";
    amount = rng.int(3, 12) + (enemy.kind === "cultist" ? 8 : 0);
  } else if (roll < 0.62) {
    kind = "health";
    amount = 30;
  } else if (roll < 0.76) {
    kind = "mana";
    amount = 20;
  } else if (roll < 0.84) {
    kind = "sword";
    amount = rng.int(3, 9); // bonus melee damage
  } else {
    return null; // no drop
  }

  return new Loot(assets.items[TEXTURE_FOR[kind]], layer, x, y, kind, amount);
}
