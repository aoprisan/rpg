import { Container } from "pixi.js";
import { Actor } from "./entity";
import { TextureActorFrames } from "../assets/assetStore";
import { Dungeon } from "../world/dungeon";
import { findPath } from "../core/pathfinding";
import { dist } from "../core/iso";
import { Player } from "./player";
import { ENEMY_AGGRO_RADIUS, ENEMY_DEAGGRO_RADIUS } from "../config";
import { RNG } from "../core/rng";

export type EnemyKind = "skeleton" | "zombie" | "cultist";

interface EnemyStats {
  hp: number;
  speed: number;
  damage: number;
  meleeRange: number;
  attackCd: number;
  ranged: boolean;
  xp: number;
}

const STATS: Record<EnemyKind, EnemyStats> = {
  skeleton: { hp: 28, speed: 2.6, damage: 8, meleeRange: 1.25, attackCd: 1.0, ranged: false, xp: 12 },
  zombie: { hp: 44, speed: 1.5, damage: 13, meleeRange: 1.25, attackCd: 1.4, ranged: false, xp: 18 },
  cultist: { hp: 22, speed: 2.0, damage: 10, meleeRange: 6.0, attackCd: 1.7, ranged: true, xp: 22 },
};

export interface AIContext {
  dungeon: Dungeon;
  player: Player;
  dealToPlayer(amount: number): void;
  castAtPlayer(fromX: number, fromY: number, damage: number): void;
}

type AIState = "wander" | "chase" | "attack";

export class Enemy extends Actor {
  readonly kind: EnemyKind;
  readonly stats: EnemyStats;
  readonly xpValue: number;
  private ai: AIState = "wander";
  private attackTimer = 0;
  private repathTimer = 0;
  private wanderTimer = 0;
  private rng: RNG;

  constructor(
    kind: EnemyKind,
    frames: TextureActorFrames,
    x: number,
    y: number,
    layer: Container,
    rng: RNG,
  ) {
    const stats = STATS[kind];
    super(frames, x, y, layer, stats.hp);
    this.kind = kind;
    this.stats = stats;
    this.xpValue = stats.xp;
    this.speed = stats.speed;
    this.rng = rng;
  }

  update(dt: number, ctx: AIContext): void {
    if (this.state === "dead") {
      this.updateAnimation(dt);
      return;
    }

    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.repathTimer > 0) this.repathTimer -= dt;

    const { player } = ctx;
    const d = dist(this.x, this.y, player.x, player.y);
    const playerAlive = player.alive;

    // Aggro transitions.
    if (this.ai === "wander" && playerAlive && d <= ENEMY_AGGRO_RADIUS) {
      this.ai = "chase";
    } else if (this.ai !== "wander" && (!playerAlive || d > ENEMY_DEAGGRO_RADIUS)) {
      this.ai = "wander";
      this.path = [];
    }

    switch (this.ai) {
      case "wander":
        this.doWander(dt, ctx);
        break;
      case "chase":
        this.doChase(dt, ctx, d);
        break;
      case "attack":
        this.doAttack(dt, ctx, d);
        break;
    }

    this.syncSprite();
    this.updateAnimation(dt);
  }

  private doWander(dt: number, ctx: AIContext): void {
    this.wanderTimer -= dt;
    if (this.path.length > 0) {
      this.state = "walk";
      this.followPath(dt);
      return;
    }
    this.state = "idle";
    if (this.wanderTimer <= 0) {
      this.wanderTimer = this.rng.range(2, 5);
      if (this.rng.chance(0.5)) {
        const tx = Math.round(this.x) + this.rng.int(-3, 3);
        const ty = Math.round(this.y) + this.rng.int(-3, 3);
        const path = findPath(ctx.dungeon, this.x, this.y, tx, ty);
        if (path) this.path = path;
      }
    }
  }

  private doChase(dt: number, ctx: AIContext, d: number): void {
    if (d <= this.stats.meleeRange) {
      this.ai = "attack";
      this.path = [];
      return;
    }
    this.state = "walk";
    // Repath toward the player periodically.
    if (this.repathTimer <= 0) {
      this.repathTimer = 0.4;
      const path = findPath(ctx.dungeon, this.x, this.y, ctx.player.x, ctx.player.y);
      if (path && path.length > 0) {
        // Stop short so we end adjacent rather than on top of the player.
        this.path = path.slice(0, Math.max(1, path.length - 1));
      }
    }
    if (this.path.length === 0) {
      this.faceTowards(ctx.player.x, ctx.player.y);
    } else {
      this.followPath(dt);
    }
  }

  private doAttack(_dt: number, ctx: AIContext, d: number): void {
    if (d > this.stats.meleeRange * 1.15) {
      this.ai = "chase";
      return;
    }
    this.state = "idle";
    this.faceTowards(ctx.player.x, ctx.player.y);
    if (this.attackTimer <= 0) {
      this.attackTimer = this.stats.attackCd;
      this.playAttack();
      if (this.stats.ranged) {
        ctx.castAtPlayer(this.x, this.y, this.stats.damage);
      } else {
        ctx.dealToPlayer(this.stats.damage);
      }
    }
  }
}
