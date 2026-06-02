import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { Player } from "../entities/player";
import { Enemy } from "../entities/enemy";

// Diablo-style heads-up display: a blood-red health orb at the lower left, a
// blue mana orb at the lower right, gold/weapon readouts between them, and a
// monster name + health bar at the top when an enemy is targeted.

function orb(radius: number, liquid: number, rim: number): { node: Container; set: (f: number) => void } {
  const node = new Container();
  const bg = new Graphics().circle(0, 0, radius).fill({ color: 0x0a0608 });
  const fill = new Graphics();
  const mask = new Graphics().circle(0, 0, radius).fill({ color: 0xffffff });
  fill.mask = mask;
  const ring = new Graphics().circle(0, 0, radius).stroke({ color: rim, width: 3, alpha: 0.8 });
  // glassy highlight
  const gloss = new Graphics().ellipse(-radius * 0.3, -radius * 0.4, radius * 0.4, radius * 0.22).fill({ color: 0xffffff, alpha: 0.12 });
  node.addChild(bg, fill, mask, ring, gloss);

  const set = (f: number) => {
    f = Math.max(0, Math.min(1, f));
    const top = radius - 2 * radius * f;
    fill.clear();
    fill.rect(-radius, top, radius * 2, radius * 2).fill({ color: liquid });
    // brighter meniscus line
    fill.rect(-radius, top, radius * 2, 2).fill({ color: 0xffffff, alpha: 0.25 });
  };
  set(1);
  return { node, set };
}

export class HUD {
  readonly root = new Container();
  private healthOrb: { node: Container; set: (f: number) => void };
  private manaOrb: { node: Container; set: (f: number) => void };
  private stats: Text;
  private monsterName: Text;
  private monsterBarBg: Graphics;
  private monsterBar: Graphics;
  private monsterGroup: Container;
  private radius = 56;

  constructor(private screenW: number, private screenH: number) {
    this.healthOrb = orb(this.radius, 0xb01a1a, 0x401016);
    this.manaOrb = orb(this.radius, 0x2860d0, 0x101a40);
    this.root.addChild(this.healthOrb.node, this.manaOrb.node);

    const style = new TextStyle({
      fill: 0xcdbfa0,
      fontFamily: "Georgia, serif",
      fontSize: 15,
      align: "center",
      dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.8 },
    });
    this.stats = new Text({ text: "", style });
    this.stats.anchor.set(0.5, 1);
    this.root.addChild(this.stats);

    // Monster targeting bar (top center).
    this.monsterGroup = new Container();
    this.monsterBarBg = new Graphics();
    this.monsterBar = new Graphics();
    this.monsterName = new Text({
      text: "",
      style: new TextStyle({ fill: 0xc9b27e, fontFamily: "Georgia, serif", fontSize: 16, letterSpacing: 2 }),
    });
    this.monsterName.anchor.set(0.5, 0);
    this.monsterGroup.addChild(this.monsterBarBg, this.monsterBar, this.monsterName);
    this.monsterGroup.visible = false;
    this.root.addChild(this.monsterGroup);

    this.layout();
  }

  resize(w: number, h: number): void {
    this.screenW = w;
    this.screenH = h;
    this.layout();
  }

  private layout(): void {
    const r = this.radius;
    const margin = 18;
    this.healthOrb.node.position.set(margin + r, this.screenH - margin - r);
    this.manaOrb.node.position.set(this.screenW - margin - r, this.screenH - margin - r);
    this.stats.position.set(this.screenW / 2, this.screenH - 14);
    this.monsterGroup.position.set(this.screenW / 2, 16);
  }

  update(player: Player): void {
    this.healthOrb.set(player.hp / player.maxHp);
    this.manaOrb.set(player.mana / player.maxMana);
    const dmg = 14 + player.weaponBonus;
    this.stats.text = `HP ${Math.ceil(Math.max(0, player.hp))}/${player.maxHp}    ⚔ ${dmg}    ◈ ${player.gold} gold    ✦ ${player.xp} xp`;
  }

  setTarget(enemy: Enemy | null): void {
    if (!enemy || !enemy.alive) {
      this.monsterGroup.visible = false;
      return;
    }
    this.monsterGroup.visible = true;
    const name = enemy.kind === "skeleton" ? "Skeleton" : enemy.kind === "zombie" ? "Rotting Dead" : "Dark Cultist";
    this.monsterName.text = name;
    this.monsterName.y = 0;
    const w = 220;
    const frac = Math.max(0, enemy.hp / enemy.maxHp);
    this.monsterBarBg.clear().roundRect(-w / 2, 26, w, 10, 3).fill({ color: 0x1a0a0a }).stroke({ color: 0x000000, width: 1 });
    this.monsterBar.clear().roundRect(-w / 2 + 1, 27, (w - 2) * frac, 8, 2).fill({ color: 0x8a1c1c });
  }
}
