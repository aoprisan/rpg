import { Container } from "pixi.js";
import { Actor } from "./entity";
import { TextureActorFrames } from "../assets/assetStore";
import {
  PLAYER_MAX_HP,
  PLAYER_MAX_MANA,
  PLAYER_SPEED,
  PLAYER_ATTACK_COOLDOWN,
  SPELL_COOLDOWN,
} from "../config";

// The player avatar. Holds combat stats, mana, cooldowns and a weapon-damage
// modifier from picked-up gear. Movement/animation come from Actor; the Game
// drives intents (move / attack / cast) and combat resolution.

export class Player extends Actor {
  mana = PLAYER_MAX_MANA;
  maxMana = PLAYER_MAX_MANA;
  gold = 0;
  xp = 0;
  weaponBonus = 0; // added to melee damage from loot
  meleeCd = 0;
  spellCd = 0;

  constructor(frames: TextureActorFrames, x: number, y: number, layer: Container) {
    super(frames, x, y, layer, PLAYER_MAX_HP);
    this.speed = PLAYER_SPEED;
  }

  get canMelee(): boolean {
    return this.meleeCd <= 0 && this.alive;
  }

  get canCast(): boolean {
    return this.spellCd <= 0 && this.alive;
  }

  startMeleeCooldown(): void {
    this.meleeCd = PLAYER_ATTACK_COOLDOWN;
  }

  startSpellCooldown(): void {
    this.spellCd = SPELL_COOLDOWN;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  restoreMana(amount: number): void {
    this.mana = Math.min(this.maxMana, this.mana + amount);
  }

  tickCooldowns(dt: number): void {
    if (this.meleeCd > 0) this.meleeCd -= dt;
    if (this.spellCd > 0) this.spellCd -= dt;
    // Slow mana regeneration.
    this.restoreMana(dt * 1.5);
  }
}
