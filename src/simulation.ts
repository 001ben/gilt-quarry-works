import Matter from "matter-js";
import { CollisionRegion } from "./collision-region";
import {
  freshProgress,
  emptyFunding,
  PADS,
  PadId,
  padCost,
  gateCost,
  GATES,
  Progress,
  SECTORS,
  stats,
  Upgrade,
  upgradeCost,
} from "./progression";
import { generateGemLayout } from "./gems";
const { Bodies, Body, Composite, Engine, Sleeping } = Matter;
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
  version: 3;
  completedPad?: PadId;
  progress: Progress;
  machine: { x: number; y: number; angle: number };
  gems: { id: number; x: number; y: number; angle: number }[];
}
export function parseSave(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Omit<SaveData, "version"> & {
        version: number;
      },
      p = s.progress;
    if (
      (s.version !== 1 && s.version !== 2 && s.version !== 3) ||
      !p ||
      !p.levels ||
      !s.machine ||
      !Array.isArray(s.gems)
    )
      return null;
    const counts =
      s.version === 1 ? [60, 75, 90] : SECTORS.map((zone) => zone.count);
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
    if (s.version < 3) {
      p.levels.magnet = 0;
      p.funding = emptyFunding();
    }
    if (
      !Number.isInteger(p.levels.magnet) ||
      p.levels.magnet < 0 ||
      p.levels.magnet > 5 ||
      !p.funding ||
      !PADS.every(
        ({ id }) =>
          finite(p.funding[id]) &&
          p.funding[id] >= 0 &&
          p.funding[id] <=
            (id === "gate1"
              ? 350
              : id === "gate2"
                ? 1100
                : (upgradeCost(p, id) ?? 0)),
      ) ||
      Object.values(p.funding).reduce((a, b) => a + b, 0) + p.money > p.earned
    )
      return null;
    if (
      !Array.isArray(p.collected) ||
      p.collected.length !== 3 ||
      !p.collected.every(
        (v, i) => Number.isInteger(v) && v >= 0 && v <= counts[i],
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
        g.id >= counts.reduce((a, b) => a + b, 0) ||
        ids.has(g.id) ||
        ![g.x, g.y, g.angle].every(finite) ||
        Math.abs(g.x) > 450 ||
        g.y < -1560 ||
        g.y > 360
      )
        return null;
      ids.add(g.id);
      remaining[g.id < counts[0] ? 0 : g.id < counts[0] + counts[1] ? 1 : 2]++;
    }
    if (!remaining.every((n, i) => n + p.collected[i] === counts[i]))
      return null;
    if (p.victory !== (s.gems.length === 0)) return null;
    if (s.version === 1) {
      // Keep funds, equipment and clearance fractions when moving to the denser layout.
      const progress = structuredClone(p);
      progress.collected = p.collected.map((n, i) =>
        Math.round((n / counts[i]) * SECTORS[i].count),
      );
      const skipped = [0, 0, 0];
      const gems = generateGemLayout().filter(
        (g) => skipped[g.sector]++ >= progress.collected[g.sector],
      );
      return {
        version: 3,
        progress,
        machine: s.machine,
        gems: gems.map(({ id, x, y, angle }) => ({ id, x, y, angle })),
      };
    }
    return { ...s, version: 3 };
  } catch {
    return null;
  }
}

export class Simulation {
  engine = Engine.create({
    enableSleeping: true,
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
  activePad: PadId | null = null;
  private padTicks = 0;
  padCompleted = false;
  gateOpening = [0, 0];
  trackTravel = { left: 0, right: 0 };
  constructor(save: SaveData | null = null) {
    const region = new CollisionRegion();
    Matter.Events.on(this.engine, "beforeSolve", () => {
      region.select(
        Composite.allBodies(this.engine.world),
        this.engine.detector.bodies,
      );
    });
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
    this.gateOpening = GATES.map((_, i) =>
      this.progress.sector > i + 1 ? 1 : 0,
    );
    this.rebuildGates();
    this.rebuildDozer();
    if (save) {
      this.teleport(save.machine.x, save.machine.y, save.machine.angle);
      const pad = PADS.find(
        (p) =>
          p.id === save.completedPad &&
          Math.abs(p.x - this.position.x) < 47 &&
          Math.abs(p.y - this.position.y) < 47,
      );
      if (pad) {
        this.activePad = pad.id;
        this.padCompleted = true;
      }
    }
    const stored = save ? new Map(save.gems.map((g) => [g.id, g])) : null;
    for (const seed of generateGemLayout()) {
      const { id, sector, radius, value } = seed;
      let { x, y } = seed;
      const persisted = stored?.get(id);
      if (stored && !persisted) continue;
      if (persisted) {
        x = persisted.x;
        y = persisted.y;
      }
      const body = Bodies.circle(x, y, radius, {
        density: 0.0009,
        friction: 0.05,
        frictionAir: 0.07,
        restitution: 0.04,
        label: "gem",
      });
      Body.setAngle(body, persisted?.angle ?? seed.angle);
      Sleeping.set(body, true);
      this.gems.set(id, { id, sector, body, radius, value });
      Composite.add(this.engine.world, body);
    }
  }
  get position() {
    return this.chassis.position;
  }
  rebuildGates() {
    for (const g of this.gates) Composite.remove(this.engine.world, g);
    this.gates = GATES.filter(
      (_, i) => this.progress.sector <= i + 1 || this.gateOpening[i] < 1,
    ).map((y) =>
      Bodies.rectangle(0, y, 900, 20, { isStatic: true, label: "gate" }),
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
  update(input: { throttle: number; steer: number; brake: boolean }) {
    this.tick++;
    const s = stats(this.progress),
      b = this.dozer;
    const previous = { ...this.position, angle: b.angle };
    if (input.throttle || input.steer) Sleeping.set(b, false);
    if (!input.brake) {
      const yaw = Math.max(-1, Math.min(1, input.steer)) * 0.035;
      Body.setAngle(b, b.angle + yaw);
      // Steer about the chassis, not the blade-shifted compound centre of mass.
      Body.translate(b, {
        x: previous.x - this.position.x,
        y: previous.y - this.position.y,
      });
    }
    if (Math.abs(input.throttle) > 0.05 && !input.brake) {
      const forward = { x: Math.sin(b.angle), y: -Math.cos(b.angle) };
      const speed = b.velocity.x * forward.x + b.velocity.y * forward.y;
      const throttle = Math.max(-1, Math.min(1, input.throttle));
      const desired = s.maxSpeed * throttle * (throttle < 0 ? 0.7 : 1);
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
    const intake = s;
    const forward = { x: Math.sin(b.angle), y: -Math.cos(b.angle) };
    const magnet = {
      x: this.position.x + forward.x * 2.85 * UNIT * s.scale,
      y: this.position.y + forward.y * 2.85 * UNIT * s.scale,
    };
    for (let i = 0; i < GATES.length; i++) {
      if (this.progress.sector > i + 1 && this.gateOpening[i] < 1) {
        this.gateOpening[i] = Math.min(1, this.gateOpening[i] + 1 / 90);
        if (this.gateOpening[i] === 1) this.rebuildGates();
      }
    }
    for (const gem of this.gems.values()) {
      const p = gem.body.position;
      // Wake an approaching heap before contact: a slow blade otherwise treats sleeping
      // stones as immovable until it exceeds Matter's collision-wake threshold.
      if (
        gem.body.isSleeping &&
        (input.throttle || input.steer || b.speed > 0.05) &&
        (p.x - this.position.x) ** 2 + (p.y - this.position.y) ** 2 < 260 ** 2
      ) {
        Sleeping.set(gem.body, false);
      }
      if (s.magnetRange) {
        const dx = magnet.x - p.x,
          dy = magnet.y - p.y;
        const distance = Math.hypot(dx, dy);
        const ahead =
          (p.x - this.position.x) * forward.x +
          (p.y - this.position.y) * forward.y;
        const sameSector = !GATES.some(
          (y, i) =>
            this.gateOpening[i] < 1 && (p.y - y) * (this.position.y - y) < 0,
        );
        if (
          s.magnetRange &&
          distance < s.magnetRange &&
          distance > 4 &&
          ahead > 2.3 * UNIT * s.scale &&
          sameSector &&
          gem.radius <= 3.35 + this.progress.levels.magnet * 0.08
        ) {
          Sleeping.set(gem.body, false);
          const pull =
            s.magnetStrength * (1 - (distance / s.magnetRange) * 0.65);
          Body.setVelocity(gem.body, {
            x: gem.body.velocity.x + (dx / distance) * pull,
            y: gem.body.velocity.y + (dy / distance) * pull,
          });
        }
      }
      if (
        Math.abs(p.x) < intake.intakeWidth / 2 &&
        Math.abs(p.y - COLLECTOR.y) < intake.intakeDepth / 2
      ) {
        Body.setVelocity(gem.body, {
          x: Math.sign(-p.x) * Math.min(2.4, Math.abs(p.x) * 0.055),
          y: (COLLECTOR.y - p.y) * 0.075,
        });
        Sleeping.set(gem.body, false);
      }
      if (
        intake.feederLength > 0 &&
        Math.abs(p.x) < 27 &&
        p.y > COLLECTOR.y - intake.feederLength &&
        p.y < COLLECTOR.y
      ) {
        Body.setVelocity(gem.body, { x: -p.x * 0.04, y: 1.6 });
        Sleeping.set(gem.body, false);
      }
    }
    Engine.update(this.engine, 1000 / 60);
    this.fundPlatform();
    const heading = (previous.angle + b.angle) / 2;
    const travel =
      ((this.position.x - previous.x) * Math.sin(heading) -
        (this.position.y - previous.y) * Math.cos(heading)) /
      (UNIT * s.scale);
    const turn = b.angle - previous.angle;
    // Measured ground travel: reverse reverses the chain; a pivot counter-rotates its sides.
    this.trackTravel.left += travel + turn;
    this.trackTravel.right += travel - turn;
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
  private fundPlatform() {
    const pad = PADS.find(
      (p) =>
        Math.abs(this.position.x - p.x) < 47 &&
        Math.abs(this.position.y - p.y) < 47,
    );
    if ((pad?.id ?? null) !== this.activePad) {
      this.activePad = pad?.id ?? null;
      this.padTicks = 0;
      this.padCompleted = false;
    }
    if (!pad || this.padCompleted || ++this.padTicks < 20) return;
    const cost = padCost(this.progress, pad.id);
    if (cost === null) return;
    const paid = this.progress.funding[pad.id];
    if (this.padTicks % 15 === 0 && paid < cost) {
      const amount = Math.min(
        this.progress.money,
        cost - paid,
        Math.max(5, Math.ceil(cost / 16)),
      );
      this.progress.money -= amount;
      this.progress.funding[pad.id] += amount;
    }
    if (this.progress.funding[pad.id] >= cost) {
      this.progress.money += this.progress.funding[pad.id];
      this.progress.funding[pad.id] = 0;
      this.purchase(pad.id.startsWith("gate") ? "gate" : (pad.id as Upgrade));
      this.padCompleted = true;
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
      version: 3,
      completedPad: this.padCompleted
        ? (this.activePad ?? undefined)
        : undefined,
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
