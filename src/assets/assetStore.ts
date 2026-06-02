import { Texture } from "pixi.js";
import { RNG } from "../core/rng";
import { WORLD_SEED } from "../config";
import {
  makeFloorTile,
  makeWallTile,
  makeTorchWallTile,
  makeDoorTile,
  makeDecor,
} from "./generateTiles";
import {
  generateActor,
  ActorFrames,
  PLAYER_KIT,
  SKELETON_KIT,
  ZOMBIE_KIT,
  CULTIST_KIT,
} from "./generateActors";
import {
  makeHealthPotion,
  makeManaPotion,
  makeGold,
  makeSwordItem,
} from "./generateItems";
import { radialGlow } from "./draw";
import { PALETTE as P } from "./palette";

// Builds every texture once from the procedural canvas generators and caches
// them. Textures are created with nearest-neighbor scaling for crisp pixels.

export interface TextureActorFrames {
  walk: Texture[][];
  attack: Texture[];
  dead: Texture;
}

function tex(canvas: HTMLCanvasElement): Texture {
  const t = Texture.from(canvas);
  t.source.scaleMode = "nearest";
  return t;
}

function actorToTextures(frames: ActorFrames): TextureActorFrames {
  return {
    walk: frames.walk.map((dir) => dir.map(tex)),
    attack: frames.attack.map(tex),
    dead: tex(frames.dead),
  };
}

export interface Assets {
  floors: Texture[];
  wall: Texture;
  torchWall: Texture;
  door: Texture;
  decor: { bones: Texture; rubble: Texture; blood: Texture };
  actors: {
    player: TextureActorFrames;
    skeleton: TextureActorFrames;
    zombie: TextureActorFrames;
    cultist: TextureActorFrames;
  };
  items: { health: Texture; mana: Texture; gold: Texture; sword: Texture };
  torchGlow: Texture;
  magicGlow: Texture;
}

let cached: Assets | null = null;

export function buildAssets(): Assets {
  if (cached) return cached;
  const rng = new RNG(WORLD_SEED);

  const floors: Texture[] = [];
  for (let i = 0; i < 6; i++) {
    floors.push(tex(makeFloorTile(rng, rng.chance(0.25))));
  }

  cached = {
    floors,
    wall: tex(makeWallTile(rng)),
    torchWall: tex(makeTorchWallTile(rng)),
    door: tex(makeDoorTile(rng)),
    decor: {
      bones: tex(makeDecor(rng, "bones")),
      rubble: tex(makeDecor(rng, "rubble")),
      blood: tex(makeDecor(rng, "blood")),
    },
    actors: {
      player: actorToTextures(generateActor(PLAYER_KIT)),
      skeleton: actorToTextures(generateActor(SKELETON_KIT)),
      zombie: actorToTextures(generateActor(ZOMBIE_KIT)),
      cultist: actorToTextures(generateActor(CULTIST_KIT)),
    },
    items: {
      health: tex(makeHealthPotion()),
      mana: tex(makeManaPotion()),
      gold: tex(makeGold()),
      sword: tex(makeSwordItem()),
    },
    torchGlow: tex(radialGlow(256, P.torch, P.torch)),
    magicGlow: tex(radialGlow(64, P.magicCore, P.magic)),
  };
  return cached;
}
