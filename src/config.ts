// Central tuning constants for the game. Tweak balance & look here.

// --- Isometric tile geometry (2:1 diamond) ---
export const TILE_W = 64; // full diamond width in pixels
export const TILE_H = 32; // full diamond height in pixels
export const TILE_HALF_W = TILE_W / 2;
export const TILE_HALF_H = TILE_H / 2;

// Wall height in pixels (how tall the side faces of a wall prism are drawn).
export const WALL_H = 48;

// --- Dungeon generation ---
export const MAP_W = 56;
export const MAP_H = 56;
export const MIN_ROOMS = 9;
export const MAX_ROOMS = 14;
export const ROOM_MIN = 5;
export const ROOM_MAX = 11;

// --- Player ---
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_MANA = 50;
export const PLAYER_SPEED = 3.6; // tiles per second
export const PLAYER_MELEE_RANGE = 1.35; // tiles
export const PLAYER_MELEE_DAMAGE = 14;
export const PLAYER_ATTACK_COOLDOWN = 0.45; // seconds
export const SPELL_MANA_COST = 8;
export const SPELL_DAMAGE = 22;
export const SPELL_COOLDOWN = 0.55;
export const PROJECTILE_SPEED = 9; // tiles per second

// --- Enemies ---
export const ENEMY_AGGRO_RADIUS = 7; // tiles
export const ENEMY_DEAGGRO_RADIUS = 12;

// --- Lighting ---
export const TORCH_RADIUS = 5.2; // tiles of bright visibility
export const TORCH_FLICKER = 0.35; // tiles of radius flicker
export const FOG_EXPLORED_DIM = 0.78; // darkness of explored-but-unlit tiles (0..1)

// --- Camera ---
export const CAMERA_LERP = 0.12;

// Seed for reproducible runs; change for a different dungeon.
export const WORLD_SEED = 0xc0ffee ^ 0x1ab10;
