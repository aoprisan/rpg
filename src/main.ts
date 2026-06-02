import { Application, Container, Sprite, Rectangle } from "pixi.js";
import { AdvancedBloomFilter, AdjustmentFilter } from "pixi-filters";
import {
  WORLD_SEED,
  PLAYER_MELEE_RANGE,
  PLAYER_MELEE_DAMAGE,
  SPELL_DAMAGE,
  SPELL_MANA_COST,
  TILE_HALF_H,
} from "./config";
import { RNG } from "./core/rng";
import { screenToGrid, gridToScreen, dist, facing8ToVector } from "./core/iso";
import { findPath } from "./core/pathfinding";
import { Input } from "./core/input";
import { TouchControls } from "./ui/touch";
import { buildAssets, Assets } from "./assets/assetStore";
import { Dungeon } from "./world/dungeon";
import { TileMap } from "./world/tilemap";
import { Lighting } from "./world/lighting";
import { Particles } from "./world/particles";
import { TILE_CENTER_DY } from "./world/layout";
import { Player } from "./entities/player";
import { Enemy, AIContext } from "./entities/enemy";
import { Projectile } from "./entities/projectile";
import { Loot } from "./entities/loot";
import { Camera } from "./systems/camera";
import { spawnEnemies } from "./systems/spawner";
import { rollLoot } from "./systems/combat";
import { HUD } from "./ui/hud";
import { Overlay } from "./ui/overlay";

// ---- Game ------------------------------------------------------------------

class Game {
  app!: Application;
  assets!: Assets;
  rng = new RNG(0xbeef);

  world = new Container();
  // Stationary, full-screen wrapper that carries the post-processing filters.
  // The camera moves `world` inside it, so the filter region stays aligned to
  // the viewport instead of sliding off with the camera.
  worldFx = new Container();
  vignette!: Sprite;
  dungeon!: Dungeon;
  tilemap!: TileMap;
  lighting!: Lighting;
  particles!: Particles;
  camera!: Camera;
  player!: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  loot: Loot[] = [];
  hud!: HUD;
  overlay!: Overlay;
  input!: Input;
  touch!: TouchControls;

  running = false;
  time = 0;
  levelSeed = WORLD_SEED;
  target: Enemy | null = null;
  moveGoal: { x: number; y: number } | null = null;
  repathAcc = 0;

  async start(): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: 0x05040a,
      resizeTo: window,
      antialias: false,
      roundPixels: true,
    });
    const host = document.getElementById("app")!;
    host.appendChild(this.app.canvas);

    this.assets = buildAssets();

    this.worldFx.addChild(this.world);
    this.app.stage.addChild(this.worldFx);

    // Post-processing on the world layer (the HUD/vignette stay crisp above it):
    // a gentle color grade for richer, warmer stone, then a threshold bloom so
    // torches, magic, embers and metal glints bleed light into the dark — the
    // soft-glow look without losing the pixel-art crunch.
    const grade = new AdjustmentFilter({
      gamma: 1.04,
      saturation: 1.12,
      contrast: 1.08,
      brightness: 1.0,
      red: 1.03,
      green: 1.0,
      blue: 0.97,
    });
    const bloom = new AdvancedBloomFilter({
      threshold: 0.72,
      bloomScale: 0.6,
      brightness: 1.0,
      blur: 6,
      quality: 4,
    });
    this.worldFx.filters = [grade, bloom];
    this.updateFilterArea();

    // Full-screen vignette over the world for gothic, light-starved corners.
    this.vignette = new Sprite(this.assets.vignette);
    this.vignette.anchor.set(0.5);
    this.app.stage.addChild(this.vignette);
    this.layoutVignette();

    this.hud = new HUD(this.app.screen.width, this.app.screen.height);
    this.overlay = new Overlay(this.app.screen.width, this.app.screen.height);
    this.app.stage.addChild(this.hud.root);

    this.camera = new Camera(this.world, this.app.screen.width, this.app.screen.height);
    this.input = new Input(this.app.canvas, {
      moveOrAttack: (x, y) => this.onMoveOrAttack(x, y),
      cast: (x, y) => this.onCast(x, y),
      key: (k) => this.onKey(k),
    });
    // Touch controls (joystick + cast button) layer above the HUD but below the
    // title/death overlay so those still capture taps to dismiss.
    this.touch = new TouchControls(this.app.canvas, this.app.screen.width, this.app.screen.height, {
      cast: () => this.onTouchCast(),
    });
    this.app.stage.addChild(this.touch.root, this.overlay.root);

    this.buildLevel(this.levelSeed);

    this.overlay.showTitle();
    this.overlay.onDismiss = () => this.onOverlayDismiss();

    window.addEventListener("resize", () => this.onResize());

    this.app.ticker.add((tk) => this.update(tk.deltaMS / 1000));

    // Hand the entry experience to the HTML landing overlay (index.html): it
    // holds the loading state, then reveals a "Descend" prompt that starts the
    // run and fades into the dungeon. Falls back to dropping the loader.
    const startRun = () => {
      if (!this.running) this.onOverlayDismiss();
    };
    const landing = (window as unknown as { GothicLanding?: { ready(fn: () => void): void } }).GothicLanding;
    if (landing) landing.ready(startRun);
    else document.getElementById("boot")?.remove();
  }

  private buildLevel(seed: number): void {
    // Tear down any previous level.
    this.world.removeChildren();
    this.particles?.destroy();
    this.enemies.forEach((e) => e.destroy());
    this.loot.forEach((l) => l.destroy());
    this.projectiles.forEach((p) => p.destroy());
    this.enemies = [];
    this.loot = [];
    this.projectiles = [];
    this.target = null;
    this.moveGoal = null;

    this.dungeon = new Dungeon(seed);
    this.tilemap = new TileMap(this.dungeon, this.assets);
    this.lighting = new Lighting(this.dungeon, this.assets);
    this.particles = new Particles(this.dungeon, this.assets);

    // Particles sit above the fog so dust/embers read inside the lit pool.
    this.world.addChild(this.tilemap.root, this.lighting.root, this.particles.root);

    const spawn = this.dungeon.spawn;
    this.player = new Player(this.assets.actors.player, spawn.x, spawn.y, this.tilemap.objectLayer);

    this.enemies = spawnEnemies(this.dungeon, this.assets, this.tilemap.objectLayer, this.rng, spawn);

    // Center immediately.
    const s = gridToScreen(spawn.x, spawn.y);
    this.camera.follow(s.x, s.y + TILE_CENTER_DY, true);
    this.lighting.update(spawn.x, spawn.y, 0);
  }

  // ---- Input intents -------------------------------------------------------

  private screenToTile(sx: number, sy: number): { x: number; y: number } {
    const localX = sx - this.world.x;
    const localY = sy - this.world.y;
    const g = screenToGrid(localX, localY - TILE_HALF_H);
    return { x: Math.round(g.x), y: Math.round(g.y) };
  }

  private screenToGridF(sx: number, sy: number): { x: number; y: number } {
    const localX = sx - this.world.x;
    const localY = sy - this.world.y;
    return screenToGrid(localX, localY - TILE_HALF_H);
  }

  private enemyAt(gx: number, gy: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = 0.9;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(e.x, e.y, gx, gy);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private onMoveOrAttack(sx: number, sy: number): void {
    if (!this.running) return;
    const gf = this.screenToGridF(sx, sy);
    const enemy = this.enemyAt(gf.x, gf.y);
    if (enemy) {
      this.target = enemy;
      this.moveGoal = null;
    } else {
      this.target = null;
      const tile = this.screenToTile(sx, sy);
      this.setMoveGoal(tile.x, tile.y);
    }
  }

  private setMoveGoal(tx: number, ty: number): void {
    if (!this.dungeon.isWalkable(tx, ty)) return;
    this.moveGoal = { x: tx, y: ty };
    const path = findPath(this.dungeon, this.player.x, this.player.y, tx, ty);
    if (path) this.player.path = path;
  }

  private onCast(sx: number, sy: number): void {
    if (!this.running || !this.player.canCast) return;
    if (this.player.mana < SPELL_MANA_COST) {
      this.overlay.flash("Not enough mana");
      return;
    }
    const gf = this.screenToGridF(sx, sy);
    const dx = gf.x - this.player.x;
    const dy = gf.y - this.player.y;
    if (dx === 0 && dy === 0) return;
    this.fireBolt(dx, dy);
  }

  // Touch cast button: auto-aim the bolt at the nearest enemy, falling back to
  // the player's current facing if none are around.
  private onTouchCast(): void {
    if (!this.running || !this.player.canCast) return;
    if (this.player.mana < SPELL_MANA_COST) {
      this.overlay.flash("Not enough mana");
      return;
    }
    let best: Enemy | null = null;
    let bestD = 10;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    let dx: number, dy: number;
    if (best) {
      dx = best.x - this.player.x;
      dy = best.y - this.player.y;
    } else {
      const f = facing8ToVector(this.player.dir);
      dx = f.x;
      dy = f.y;
    }
    if (dx === 0 && dy === 0) return;
    this.fireBolt(dx, dy);
  }

  private fireBolt(dx: number, dy: number): void {
    this.player.mana -= SPELL_MANA_COST;
    this.player.startSpellCooldown();
    this.player.faceTowards(this.player.x + dx, this.player.y + dy);
    this.player.playAttack();
    this.projectiles.push(
      new Projectile(
        this.assets.magicGlow,
        this.tilemap.objectLayer,
        this.player.x,
        this.player.y,
        dx,
        dy,
        SPELL_DAMAGE,
        true,
        0x9ecbff,
      ),
    );
  }

  private onKey(k: string): void {
    if (k === "q") this.useStoredPotion("health");
    else if (k === "e") this.useStoredPotion("mana");
  }

  // Quaff the nearest potion on the ground of the given kind (simple inventory-less model).
  private useStoredPotion(kind: "health" | "mana"): void {
    if (!this.running) return;
    if (kind === "health" && this.player.hp >= this.player.maxHp) return;
    if (kind === "mana" && this.player.mana >= this.player.maxMana) return;
    // No inventory in the core slice: potions are consumed on pickup. This is a
    // hook for a future inventory; for now flash a hint.
    this.overlay.flash(kind === "health" ? "Find a health potion" : "Find a mana potion");
  }

  private onOverlayDismiss(): void {
    if (!this.player || this.player.alive) {
      // From title screen.
      this.overlay.hide();
      this.running = true;
    } else {
      // From death screen: new run.
      this.levelSeed = (this.levelSeed * 1664525 + 1013904223) >>> 0;
      this.buildLevel(this.levelSeed);
      this.overlay.hide();
      this.running = true;
    }
  }

  private onResize(): void {
    this.camera.resize(this.app.screen.width, this.app.screen.height);
    this.hud.resize(this.app.screen.width, this.app.screen.height);
    this.overlay.resize(this.app.screen.width, this.app.screen.height);
    this.touch.resize(this.app.screen.width, this.app.screen.height);
    this.layoutVignette();
    this.updateFilterArea();
  }

  // The world filters work in screen space; bound them to the viewport so the
  // bloom only ever processes visible pixels rather than the whole dungeon.
  private updateFilterArea(): void {
    this.worldFx.filterArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
  }

  private layoutVignette(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.vignette.x = w / 2;
    this.vignette.y = h / 2;
    // Stretch to cover the viewport (slight overscan to hide the soft edge).
    this.vignette.width = w * 1.06;
    this.vignette.height = h * 1.06;
  }

  // ---- Main loop -----------------------------------------------------------

  private update(dt: number): void {
    dt = Math.min(dt, 0.05); // clamp big frame gaps
    this.time += dt;
    this.overlay.update(dt);
    if (!this.running) {
      this.touch.root.visible = false;
      return;
    }
    this.touch.root.visible = this.touch.touchActive;

    // Continuous movement while holding the left button (desktop only — touch is
    // driven directly by the joystick in updatePlayer).
    if (!this.touch.touchActive && this.input.holdingMove && !this.target) {
      const tile = this.screenToTile(this.input.x, this.input.y);
      if (!this.moveGoal || this.moveGoal.x !== tile.x || this.moveGoal.y !== tile.y) {
        this.setMoveGoal(tile.x, tile.y);
      }
    }

    this.updatePlayer(dt);
    if (this.touch.touchActive) this.autoMelee();
    else this.updateCombatTarget(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateLoot(dt);

    // Camera + lighting follow the player.
    const ps = gridToScreen(this.player.x, this.player.y);
    this.camera.follow(ps.x, ps.y + TILE_CENTER_DY);
    this.lighting.update(this.player.x, this.player.y, this.time);
    this.particles.update(dt, this.player.x, this.player.y, this.time);

    // HUD: show targeted enemy, else whatever is under the cursor.
    const hover = this.screenToGridF(this.input.x, this.input.y);
    this.hud.setTarget(this.target ?? this.enemyAt(hover.x, hover.y));
    this.hud.update(this.player);

    if (this.player.hp <= 0 && this.player.alive) this.killPlayer();
  }

  private updatePlayer(dt: number): void {
    this.player.tickCooldowns(dt);
    if (this.player.alive) {
      if (this.touch.touchActive) {
        // Free, continuous movement steered by the joystick.
        const v = this.touch.moveVector();
        if (v) {
          const g = screenToGrid(v.dx, v.dy);
          this.player.moveByGrid(g.x, g.y, v.mag, dt, (x, y) => this.dungeon.isWalkable(x, y));
          this.player.state = "walk";
        } else {
          this.player.state = "idle";
        }
      } else {
        const moving = this.player.path.length > 0;
        this.player.state = moving ? "walk" : "idle";
        if (moving) this.player.followPath(dt);
      }
    }
    this.player.advance(dt);
  }

  // Touch combat: auto-swing at the nearest living enemy in melee range. Keeps
  // the game playable with a single thumb on the joystick — walk into a monster
  // and you attack it.
  private autoMelee(): void {
    let best: Enemy | null = null;
    let bestD = PLAYER_MELEE_RANGE;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d <= bestD) {
        bestD = d;
        best = e;
      }
    }
    this.target = best; // surface it on the HUD target bar
    if (best && this.player.canMelee) {
      this.player.faceTowards(best.x, best.y);
      this.player.playAttack();
      this.player.startMeleeCooldown();
      this.damageEnemy(best, PLAYER_MELEE_DAMAGE + this.player.weaponBonus);
    }
  }

  private updateCombatTarget(_dt: number): void {
    const t = this.target;
    if (!t) return;
    if (!t.alive) {
      this.target = null;
      return;
    }
    const d = dist(this.player.x, this.player.y, t.x, t.y);
    if (d <= PLAYER_MELEE_RANGE) {
      this.player.path = [];
      this.player.faceTowards(t.x, t.y);
      if (this.player.canMelee) {
        this.player.playAttack();
        this.player.startMeleeCooldown();
        this.damageEnemy(t, PLAYER_MELEE_DAMAGE + this.player.weaponBonus);
      }
    } else {
      // Approach the target, repathing periodically.
      this.repathAcc += _dt;
      if (this.player.path.length === 0 || this.repathAcc > 0.3) {
        this.repathAcc = 0;
        const path = findPath(this.dungeon, this.player.x, this.player.y, t.x, t.y);
        if (path && path.length > 0) this.player.path = path.slice(0, Math.max(1, path.length - 1));
      }
    }
  }

  private updateEnemies(dt: number): void {
    const ctx: AIContext = {
      dungeon: this.dungeon,
      player: this.player,
      dealToPlayer: (amount) => this.damagePlayer(amount),
      castAtPlayer: (fx, fy, dmg) => {
        const dx = this.player.x - fx;
        const dy = this.player.y - fy;
        this.projectiles.push(
          new Projectile(this.assets.magicGlow, this.tilemap.objectLayer, fx, fy, dx, dy, dmg, false, 0xff7a4a),
        );
      },
    };
    for (const e of this.enemies) e.update(dt, ctx);
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.update(dt);
      const tx = Math.round(p.x);
      const ty = Math.round(p.y);
      if (!this.dungeon.isWalkable(tx, ty)) p.dead = true;
      if (p.friendly) {
        for (const e of this.enemies) {
          if (e.alive && dist(e.x, e.y, p.x, p.y) < 0.6) {
            this.damageEnemy(e, p.damage);
            p.dead = true;
            break;
          }
        }
      } else if (this.player.alive && dist(this.player.x, this.player.y, p.x, p.y) < 0.55) {
        this.damagePlayer(p.damage);
        p.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.dead) {
        p.destroy();
        return false;
      }
      return true;
    });
  }

  private updateLoot(dt: number): void {
    for (const l of this.loot) {
      if (l.collected) continue;
      l.update(dt, this.lighting.isExplored(Math.round(l.x), Math.round(l.y)));
      if (dist(this.player.x, this.player.y, l.x, l.y) < 0.8) this.collect(l);
    }
    this.loot = this.loot.filter((l) => !l.collected);
  }

  // ---- Combat resolution ---------------------------------------------------

  private damageEnemy(e: Enemy, amount: number): void {
    if (!e.alive) return;
    e.hp -= amount;
    e.takeHit();
    if (e.hp <= 0) {
      e.die();
      this.player.xp += e.xpValue;
      const drop = rollLoot(e, this.dungeon, this.assets, this.tilemap.objectLayer, this.rng);
      if (drop) this.loot.push(drop);
      if (this.target === e) this.target = null;
    }
  }

  private damagePlayer(amount: number): void {
    if (!this.player.alive) return;
    this.player.hp -= amount;
    this.player.takeHit();
  }

  private collect(l: Loot): void {
    l.collected = true;
    l.destroy();
    if (l.kind === "gold") {
      this.player.gold += l.amount;
    } else if (l.kind === "health") {
      this.player.heal(l.amount);
      this.overlay.flash("+" + l.amount + " health");
    } else if (l.kind === "mana") {
      this.player.restoreMana(l.amount);
      this.overlay.flash("+" + l.amount + " mana");
    } else if (l.kind === "sword") {
      if (l.amount > this.player.weaponBonus) {
        this.player.weaponBonus = l.amount;
        this.overlay.flash("Found a better blade! +" + l.amount + " damage");
      }
    }
  }

  private killPlayer(): void {
    this.player.die();
    this.running = false;
    this.target = null;
    setTimeout(() => this.overlay.showDeath(), 600);
  }
}

new Game().start();
