import { TILE_H, TILE_HALF_H } from "../config";
import { ACTOR_H } from "../assets/draw";

// Shared sprite-placement constants so tiles, decor and actors line up on the
// isometric grid. Derived from the canvas layouts used by the generators.

// Decor canvases draw their content around y = TILE_H + 6; this offset places
// that point at the tile center when the sprite is anchored top-center.
const DECOR_CONTENT_Y = TILE_H + 6;
export const FLOOR_OFFSET_FIX = DECOR_CONTENT_Y - TILE_HALF_H;

// Actor sprites: feet are drawn near the bottom of the canvas (ACTOR_H - 10).
// Anchoring there lets us position an actor by its tile-center foot point.
export const ACTOR_FEET_Y = ACTOR_H - 10;
export const ACTOR_ANCHOR_Y = ACTOR_FEET_Y / ACTOR_H;

// Vertical screen offset from a tile's top vertex to its center (where feet go).
export const TILE_CENTER_DY = TILE_HALF_H;
