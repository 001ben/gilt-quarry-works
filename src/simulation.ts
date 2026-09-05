import Matter from "matter-js";
import {
  freshProgress,
  gateCost,
  GATES,
  Progress,
  SECTORS,
  stats,
  Upgrade,
  upgradeCost,
} from "./progression";
const { Bodies, Body, Composite, Engine } = Matter;
export const UNIT = 30;
export const COLLECTOR = { x: 0, y: 245 };
export interface Gem {
  id: number;
  sector: number;
  body: Matter.Body;
  radius: number;
  value: number;
}
export type GameEvent =
  | { type: "collect"; x: number; y: number; value: number; color: number }
  | { type: "notice"; text: string }
  | { type: "upgrade"; kind: string }
  | { type: "victory" };
export interface SaveData {
  version: 1;
  progress: Progress;
  machine: { x: number; y: number; angle: number };
  gems: { id: number; x: number; y: number; angle: number }[];
}
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as SaveData,
      p = s.progress;
    if (
      s.version !== 1 ||
      !p ||
      !p.levels ||
      !s.machine ||
      !Array.isArray(s.gems)
    )
      return null;
    const finite = (v: unknown): v is number =>
      typeof v === "number" && Number.isFinite(v);
    if (
      ![p.money, p.earned].every((v) => finite(v) && v >= 0) ||
      p.money > p.earned ||
      !Number.isInteger(p.sector) ||
      p.sector < 1 ||
      p.sector > 3
    )
      return null;
    if (
      !["engine", "blade", "intake"].every(
        (k) =>
          Number.isInteger(p.levels[k as Upgrade]) &&
          p.levels[k as Upgrade] >= 1 &&
          p.levels[k as Upgrade] <= 5,
      )
    )
      return null;
    if (
      !Array.isArray(p.collected) ||
      p.collected.length !== 3 ||
      !p.collected.every(
        (v, i) => Number.isInteger(v) && v >= 0 && v <= SECTORS[i].count,
      )
    )
      return null;
    if (
      !Array.isArray(p.bonuses) ||
      p.bonuses.length !== 3 ||
      !p.bonuses.every((v) => typeof v === "boolean") ||
      typeof p.victory !== "boolean" ||
      typeof p.sandbox !== "boolean"
    )
      return null;
    if (
      ![s.machine.x, s.machine.y, s.machine.angle].every(finite) ||
      Math.abs(s.machine.x) > 450 ||
      s.machine.y < -1560 ||
      s.machine.y > 350
    )
      return null;
    const ids = new Set<number>(),
      remaining = [0, 0, 0];
    for (const g of s.gems) {
      if (
        !Number.isInteger(g.id) ||
        g.id < 0 ||
        g.id >= 225 ||
        ids.has(g.id) ||
        ![g.x, g.y, g.angle].every(finite) ||
        Math.abs(g.x) > 450 ||
        g.y < -1560 ||
        g.y > 360
      )
        return null;
      ids.add(g.id);
      remaining[g.id < 60 ? 0 : g.id < 135 ? 1 : 2]++;
    }
    if (!remaining.every((n, i) => n + p.collected[i] === SECTORS[i].count))
      return null;
    if (p.victory !== (s.gems.length === 0)) return null;
    return s;
  } catch {
    return null;
  }
}

export class Simulation {
  engine = Engine.create({
    gravity: { x: 0, y: 0 },
    positionIterations: 8,
    velocityIterations: 8,
  });
  progress: Progress;
  gems = new Map<number, Gem>();
  dozer!: Matter.Body;
  chassis!: Matter.Body;
  gates: Matter.Body[] = [];
  events: GameEvent[] = [];
  tick = 0;
  constructor(save: SaveData | null = null) {
    this.progress = save ? structuredClone(save.progress) : freshProgress();
    const wall = (x: number, y: number, w: number, h: number) =>
      Bodies.rectangle(x, y, w, h, {
        isStatic: true,
        label: "wall",
        friction: 0.1,
      });
    Composite.add(this.engine.world, [
      wall(-467, -600, 34, 1954),
      wall(467, -600, 34, 1954),
      wall(0, -1577, 968, 34),
      wall(0, 377, 968, 34),
    ]);
    this.rebuildGates();
    this.rebuildDozer();
    if (save) this.teleport(save.machine.x, save.machine.y, save.machine.angle);
    let seed = 7159;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const stored = save ? new Map(save.gems.map((g) => [g.id, g])) : null;
    let id = 0;
    for (let sector = 0; sector < 3; sector++) {
      const zone = SECTORS[sector];
      for (let i = 0; i < zone.count; i++, id++) {
        const radius = 7.3 + random() * 3.3;
        let x = -335 + random() * 670,
          y = zone.minY + random() * (zone.maxY - zone.minY);
        // The first delivery is visible straight ahead, teaching the loop through play.
        if (sector === 0 && i < 8) {
          x = ((i % 4) - 1.5) * 19;
          y = 132 + Math.floor(i / 4) * 20;
        }
        const initialAngle = random() * Math.PI;
        const persisted = stored?.get(id);
        if (stored && !persisted) continue;
        if (persisted) {
          x = persisted.x;
          y = persisted.y;
        }
        const body = Bodies.circle(x, y, radius, {
          density: 0.0009,
          friction: 0.05,
          frictionAir: 0.035,
          restitution: 0.16,
          label: "gem",
        });
        Body.setAngle(body, persisted?.angle ?? initialAngle);
        this.gems.set(id, { id, sector, body, radius, value: zone.value });
        Composite.add(this.engine.world, body);
      }
    }
  }
  get position() {
    return this.chassis.position;
  }
  rebuildGates() {
    for (const g of this.gates) Composite.remove(this.engine.world, g);
    this.gates = GATES.filter((_, i) => this.progress.sector <= i + 1).map(
      (y) => Bodies.rectangle(0, y, 900, 20, { isStatic: true, label: "gate" }),
    );
    Composite.add(this.engine.world, this.gates);
  }
  rebuildDozer() {
    const previous = this.dozer
      ? { ...this.position, angle: this.dozer.angle }
      : { x: 0, y: 40, angle: Math.PI };
    if (this.dozer) Composite.remove(this.engine.world, this.dozer);
    const s = stats(this.progress),
      scale = s.scale * UNIT;
    const chassis = Bodies.rectangle(0, 0, 2.55 * scale, 3 * scale, {
      label: "chassis",
    });
    const blade = Bodies.rectangle(
      0,
      -2.1 * scale,
      s.bladeWidth * UNIT,
      0.28 * scale,
      { label: "blade" },
    );
    const parts = [chassis, blade];
    if (s.wings)
      for (const side of [-1, 1])
        parts.push(
          Bodies.rectangle(
            side * ((s.bladeWidth * UNIT) / 2 + 0.19 * scale),
            -2.48 * scale,
            0.16 * scale,
            0.94 * scale,
            { angle: side * 0.4, label: "wing" },
          ),
        );
    this.dozer = Body.create({
      parts,
      density: 0.009,
      frictionAir: 0,
      friction: 0.08,
      restitution: 0,
      label: "dozer",
    });
    Body.setInertia(this.dozer, Infinity);
    this.chassis = chassis;
    Composite.add(this.engine.world, this.dozer);
    this.teleport(previous.x, previous.y, previous.angle);
  }
  teleport(x: number, y: number, angle = this.dozer.angle) {
    Body.setAngle(this.dozer, angle);
    Body.translate(this.dozer, {
      x: x - this.chassis.position.x,
      y: y - this.chassis.position.y,
    });
    Body.setVelocity(this.dozer, { x: 0, y: 0 });
  }
  update(input: { x: number; y: number; brake: boolean }) {
    this.tick++;
    const s = stats(this.progress),
      b = this.dozer;
    const magnitude = Math.hypot(input.x, input.y);
    if (magnitude > 0.05 && !input.brake) {
      const target = Math.atan2(input.x, -input.y);
      const delta = Math.atan2(
        Math.sin(target - b.angle),
        Math.cos(target - b.angle),
      );
      Body.setAngle(b, b.angle + Math.max(-0.055, Math.min(0.055, delta)));
      const forward = { x: Math.sin(b.angle), y: -Math.cos(b.angle) };
      const speed = b.velocity.x * forward.x + b.velocity.y * forward.y;
      const alignment = Math.max(0.15, Math.cos(delta));
      const desired = s.maxSpeed * Math.min(1, magnitude) * alignment;
      const next =
        speed + Math.max(-0.16, Math.min(s.acceleration, desired - speed));
      const side = {
        x: b.velocity.x - forward.x * speed,
        y: b.velocity.y - forward.y * speed,
      };
      Body.setVelocity(b, {
        x: forward.x * next + side.x * 0.63,
        y: forward.y * next + side.y * 0.63,
      });
    } else {
      const drag = input.brake ? 0.72 : 0.94;
      Body.setVelocity(b, { x: b.velocity.x * drag, y: b.velocity.y * drag });
    }
    const intake = stats(this.progress);
    for (const gem of this.gems.values()) {
      const p = gem.body.position;
      if (
        Math.abs(p.x) < intake.intakeWidth / 2 &&
        Math.abs(p.y - COLLECTOR.y) < intake.intakeDepth / 2
      ) {
        Body.setVelocity(gem.body, {
          x: -p.x * 0.055,
          y: (COLLECTOR.y - p.y) * 0.075,
        });
      }
      if (
        this.progress.levels.intake >= 4 &&
        Math.abs(p.x) < 27 &&
        p.y > COLLECTOR.y - 140 &&
        p.y < COLLECTOR.y
      ) {
        Body.setVelocity(gem.body, { x: -p.x * 0.04, y: 1.6 });
      }
    }
    Engine.update(this.engine, 1000 / 60);
    for (const gem of this.gems.values()) {
      const p = gem.body.position;
      if (Math.abs(p.x) < 35 && Math.abs(p.y - COLLECTOR.y) < 24)
        this.collect(gem);
    }
  }
  collect(gem: Gem) {
    if (!this.gems.delete(gem.id)) return;
    Composite.remove(this.engine.world, gem.body);
    const p = this.progress;
    p.money += gem.value;
    p.earned += gem.value;
    p.collected[gem.sector]++;
    this.events.push({
      type: "collect",
      ...gem.body.position,
      value: gem.value,
      color: SECTORS[gem.sector].color,
    });
    const sector = SECTORS[gem.sector];
    if (!p.bonuses[gem.sector] && p.collected[gem.sector] >= sector.count / 2) {
      p.bonuses[gem.sector] = true;
      p.money += sector.bonus;
      p.earned += sector.bonus;
      this.events.push({
        type: "notice",
        text: `${sector.name}: halfway cleared · +$${sector.bonus} contract bonus`,
      });
    }
    if (this.gems.size === 0 && !p.victory) {
      p.victory = true;
      this.events.push({ type: "victory" });
    }
  }
  purchase(kind: Upgrade | "gate"): boolean {
    const cost =
      kind === "gate"
        ? gateCost(this.progress)
        : upgradeCost(this.progress, kind);
    if (cost === null || this.progress.money < cost) return false;
    this.progress.money -= cost;
    if (kind === "gate") {
      this.progress.sector++;
      this.rebuildGates();
    } else {
      this.progress.levels[kind]++;
      if (kind !== "intake") this.rebuildDozer();
    }
    this.events.push({ type: "upgrade", kind });
    return true;
  }
  snapshot(): SaveData {
    return {
      version: 1,
      progress: structuredClone(this.progress),
      machine: { ...this.position, angle: this.dozer.angle },
      gems: [...this.gems.values()].map((g) => ({
        id: g.id,
        ...g.body.position,
        angle: g.body.angle,
      })),
    };
  }
}
