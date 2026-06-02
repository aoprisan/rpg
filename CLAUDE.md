# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gothic Depths — a Diablo 1–inspired isometric action RPG that runs entirely in the
browser. **Every art asset is generated procedurally in code** (drawn to offscreen
canvases, uploaded as WebGL textures); there are no image files, no external art, and
no backend. Stack: TypeScript + Vite + PixiJS v8.

## Commands

```bash
npm run dev        # vite dev server at http://localhost:5173/rpg/
npm run build      # tsc --noEmit, then production build into dist/
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

There is **no test runner and no linter** configured. `tsc --noEmit` (run via
`typecheck` or `build`) is the only static check — treat it as the gate before
considering a change done. `tsconfig.json` uses `strict` plus
`noUnusedLocals`/`noUnusedParameters`, so unused symbols fail the build.

The Vite `base` is hardcoded to `/rpg/` (the repo/Pages subpath) in `vite.config.ts`;
the dev URL and all asset paths live under it.

## Architecture

The game is a single `Game` class in `src/main.ts` that owns all state and the PixiJS
ticker loop. There is no ECS and no framework — `Game.update(dt)` calls a fixed
sequence of `updateX` methods each frame (player → combat target → enemies →
projectiles → loot → camera → lighting → HUD). When changing game behavior, start by
finding the relevant `updateX`/`onX` method in `main.ts`; the subsystems it calls are
mostly passive data + helpers.

Key cross-cutting concepts that require reading several files:

- **Two coordinate spaces.** Everything gameplay-related is in *grid* coordinates
  (float tile x/y). PixiJS rendering is in *screen* coordinates. `src/core/iso.ts`
  converts between them (`gridToScreen` / `screenToGrid`). `src/world/layout.ts`
  holds the shared anchor/offset constants (`TILE_CENTER_DY`, `ACTOR_ANCHOR_Y`,
  `FLOOR_OFFSET_FIX`) that keep tiles, decor, and actor feet aligned on the diamond
  grid — these are derived from the canvas layouts in the generators, so changing a
  generator's drawing offsets means updating `layout.ts` too.

- **Render order = isometric depth.** Sprites are sorted by grid position so
  nearer-to-camera things draw on top. `TileMap.objectLayer` (`src/world/tilemap.ts`)
  is the shared container that the player, enemies, projectiles, and loot all add
  themselves into; their depth is managed there.

- **Procedural asset pipeline.** `buildAssets()` in `src/assets/assetStore.ts` runs
  once at boot, calls every generator (`generateTiles.ts`, `generateActors.ts`,
  `generateItems.ts`, all using primitives from `draw.ts` and colors from
  `palette.ts`), and caches the resulting `Assets` texture bundle. Generators draw to
  canvases; the store wraps them as nearest-neighbor PixiJS `Texture`s. To add or
  change a visual, edit the generator and (if needed) thread the new texture through
  the `Assets` interface.

- **Seeded determinism.** `src/core/rng.ts` is a small seedable PRNG. The same seed
  reproduces the same dungeon and assets. `WORLD_SEED` (in `config.ts`) seeds assets;
  the per-run `levelSeed` advances via an LCG on each death to generate a fresh
  dungeon (see `onOverlayDismiss` in `main.ts`).

- **Dungeon → tilemap → lighting** are built together in `Game.buildLevel()`.
  `Dungeon` (`src/world/dungeon.ts`) generates rooms/corridors/doors and exposes
  `isWalkable` + the player `spawn`. `Lighting` (`src/world/lighting.ts`) is the
  torch-lit fog of war: a flickering radius around the player; explored-but-unlit
  tiles stay dimly remembered. Loot visibility and other systems query
  `lighting.isExplored(...)`.

- **Movement & combat intents.** Clicks become grid tiles; `findPath`
  (`src/core/pathfinding.ts`, A*) produces a path the player follows. Clicking near an
  enemy sets `Game.target` (approach + melee with periodic repathing) instead of a
  move goal. Enemy AI (`src/entities/enemy.ts`) is a wander → chase → attack state
  machine driven by an `AIContext` that `main.ts` supplies so enemies can damage or
  cast at the player without holding a reference to `Game`.

## Tuning

`src/config.ts` is the single source of balance and geometry constants (tile size,
wall height, dungeon size, player/enemy stats, lighting radii, camera lerp, seed).
Prefer changing values here over hardcoding numbers in subsystems.

## Known simplifications

There is no inventory: potions are consumed on pickup, and the `q`/`e` keys are stubs
that only flash a hint (see `useStoredPotion` in `main.ts`). This is an intentional
hook for a future inventory system, not a bug.

## Deploy

Fully static. `.github/workflows/deploy.yml` builds with Vite and publishes `dist/` to
GitHub Pages on push. Forking to a differently named repo requires updating `base` in
`vite.config.ts`.
