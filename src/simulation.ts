import Matter from "matter-js";
import { activityAt, type Activity } from "./activities";
import { validAssay } from "./assay";
import { generateOvertimeLayout, overtimeContract } from "./overtime";
import { CollisionRegion } from "./collision-region";
import {
  freshProgress,
  emptyFunding,
  PADS,
  PadId,
  padCost,
  gatePadFinished,
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
  | { type: "fund"; pad: PadId; value: number; ratio: number }
  | { type: "activity"; activity: Activity }
  | { type: "overtime-complete"; bonus: number }
  | { type: "victory" };
export interface SaveData {
  version: 5;
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
      ![1, 2, 3, 4, 5].includes(s.version) ||
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
    if (s.version < 4 && p.funding) {
      p.levels.refinery = 0;
      p.funding.refinery = 0;
    }
    if (s.version < 5) {
      p.lastAssay = null;
      p.overtime = { completed: 0, active: false, collected: 0 };
    }
    const overtime = p.overtime;
    if (
      !validAssay(p.lastAssay) ||
      !overtime ||
      !Number.isSafeInteger(overtime.completed) ||
      overtime.completed < 0 ||
      overtime.completed >= Number.MAX_SAFE_INTEGER ||
      typeof overtime.active !== "boolean" ||
      !Number.isInteger(overtime.collected) ||
      overtime.collected < 0 ||
      (!overtime.active && overtime.collected !== 0) ||
      ((overtime.active || overtime.completed > 0) &&
        (!p.victory || p.sector !== 3))
    )
      return null;
    if (
      !Number.isInteger(p.levels.magnet) ||
      p.levels.magnet < 0 ||
      p.levels.magnet > 5 ||
      !Number.isInteger(p.levels.refinery) ||
      p.levels.refinery < 0 ||
      p.levels.refinery > 3 ||
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
    if (overtime.active) {
      const layout = generateOvertimeLayout(overtime.completed);
      const allowed = new Set(layout.map((g) => g.id));
      if (
        !p.collected.every((n, i) => n === counts[i]) ||
        !p.bonuses.every(Boolean) ||
        s.gems.length === 0 ||
        overtime.collected + s.gems.length !== layout.length ||
        !s.gems.every((g) => allowed.has(g.id))
      )
        return null;
    } else {
      if (!remaining.every((n, i) => n + p.collected[i] === counts[i]))
        return null;
      if (p.victory !== (s.gems.length === 0)) return null;
    }
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
        version: 5,
        progress,
        machine: s.machine,
        gems: gems.map(({ id, x, y, angle }) => ({ id, x, y, angle })),
      };
    }
    return { ...s, version: 5 };
  } catch {
    return null;
  }
}

export class Simulation {
  engine = Engine.create({
    enableSleeping: true,
    gravity: { x: 0, y: 0 },
    positionIterations: 8,
    velocityIterations: 4,
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
  activeActivity: Activity | null = null;
  private activityTicks = 0;
  private activityOpened = false;
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
    if (save) {
      this.activeActivity = activityAt(this.position);
      this.activityOpened = this.activeActivity !== null;
    }
    const stored = save ? new Map(save.gems.map((g) => [g.id, g])) : null;
    const layout = this.progress.overtime.active
      ? generateOvertimeLayout(this.progress.overtime.completed)
      : generateGemLayout();
    for (const seed of layout) {
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
    const previousBounds = {
      minX: b.bounds.min.x,
      maxX: b.bounds.max.x,
      minY: b.bounds.min.y,
      maxY: b.bounds.max.y,
    };
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
    // Cover the previous and current machine footprint, with room for the next
    // step and a few rows of stones. Reverse and pivot turns wake their contact area too.
    const wakeMargin = 32 + s.maxSpeed;
    const wake = {
      minX: Math.min(previousBounds.minX, b.bounds.min.x) - wakeMargin,
      maxX: Math.max(previousBounds.maxX, b.bounds.max.x) + wakeMargin,
      minY: Math.min(previousBounds.minY, b.bounds.min.y) - wakeMargin,
      maxY: Math.max(previousBounds.maxY, b.bounds.max.y) + wakeMargin,
    };
    const moving = Boolean(
      (!input.brake && (input.throttle || input.steer)) || b.speed > 0.05,
    );
    const captureAhead = 2.65 * UNIT * s.scale;
    const captureHalfWidth = (s.bladeWidth * UNIT) / 2 - 12;
    // A small local grid lets the magnet distinguish loose stones from packed ore.
    // Surrounded stones already belong to a load; repeatedly pulling them only jams it.
    const nearby = new Map<number, Gem[]>();
    const cellKey = (x: number, y: number) => x + y * 1024;
    if (s.magnetRange) {
      const reach = s.magnetRange + 12;
      for (const gem of this.gems.values()) {
        const p = gem.body.position;
        if (
          Math.abs(p.x - magnet.x) > reach ||
          Math.abs(p.y - magnet.y) > reach
        )
          continue;
        const key = cellKey(Math.floor(p.x / 16), Math.floor(p.y / 16));
        const cell = nearby.get(key);
        if (cell) cell.push(gem);
        else nearby.set(key, [gem]);
      }
    }
    const surrounded = (gem: Gem) => {
      const p = gem.body.position,
        cx = Math.floor(p.x / 16),
        cy = Math.floor(p.y / 16);
      let neighbors = 0;
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++)
          for (const other of nearby.get(cellKey(x, y)) ?? []) {
            if (other === gem) continue;
            const q = other.body.position;
            if (
              (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < 12 ** 2 &&
              ++neighbors >= 3
            )
              return true;
          }
      return false;
    };
    for (const gem of this.gems.values()) {
      const p = gem.body.position;
      // Slow contact needs explicit waking; distant parts of a heap can stay asleep.
      if (
        gem.body.isSleeping &&
        moving &&
        p.x > wake.minX &&
        p.x < wake.maxX &&
        p.y > wake.minY &&
        p.y < wake.maxY
      ) {
        Sleeping.set(gem.body, false);
      }
      if (s.magnetRange) {
        const mx = magnet.x - p.x,
          my = magnet.y - p.y;
        const rangeSquared = mx * mx + my * my;
        const relativeX = p.x - this.position.x,
          relativeY = p.y - this.position.y;
        const ahead = relativeX * forward.x + relativeY * forward.y;
        const gap = ahead - captureAhead;
        if (
          rangeSquared < s.magnetRange ** 2 &&
          gap > 6 &&
          !surrounded(gem) &&
          gem.radius <= 3.35 + this.progress.levels.magnet * 0.08 &&
          !GATES.some(
            (y, i) =>
              this.gateOpening[i] < 1 && (p.y - y) * (this.position.y - y) < 0,
          )
        ) {
          // Preserve each stone's lateral position inside a strip across the plow.
          // Only outlying stones steer inward; captured stones receive no more pull.
          const side = relativeX * -forward.y + relativeY * forward.x;
          const targetSide = Math.max(
            -captureHalfWidth,
            Math.min(captureHalfWidth, side),
          );
          const sideways = targetSide - side;
          const distance = Math.hypot(sideways, gap);
          const pull =
            s.magnetStrength *
            (1 - (Math.sqrt(rangeSquared) / s.magnetRange) * 0.65) *
            Math.min(1, gap / 28);
          if (gem.body.isSleeping) Sleeping.set(gem.body, false);
          Body.setVelocity(gem.body, {
            x:
              gem.body.velocity.x +
              ((-forward.y * sideways - forward.x * gap) / distance) * pull,
            y:
              gem.body.velocity.y +
              ((forward.x * sideways - forward.y * gap) / distance) * pull,
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
    this.visitActivity();
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
    const value = gem.value + stats(p).gemBonus;
    p.money += value;
    p.earned += value;
    this.events.push({
      type: "collect",
      ...gem.body.position,
      value,
      color: SECTORS[gem.sector].color,
    });
    if (p.overtime.active) {
      p.overtime.collected++;
      if (this.gems.size === 0) {
        const { bonus } = overtimeContract(p.overtime.completed);
        p.overtime = {
          completed: p.overtime.completed + 1,
          active: false,
          collected: 0,
        };
        p.money += bonus;
        p.earned += bonus;
        this.events.push({ type: "overtime-complete", bonus });
      }
      return;
    }
    p.collected[gem.sector]++;
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
  startOvertime(): Simulation | null {
    if (
      !this.progress.victory ||
      this.progress.overtime.active ||
      this.gems.size
    )
      return null;
    const save = this.snapshot();
    save.progress.overtime.active = true;
    save.progress.overtime.collected = 0;
    // All deposits remain at the south end; all three cleared sectors stay accessible.
    save.progress.sector = 3;
    save.gems = generateOvertimeLayout(save.progress.overtime.completed).map(
      ({ id, x, y, angle }) => ({ id, x, y, angle }),
    );
    return new Simulation(save);
  }
  private visitActivity() {
    const activity = activityAt(this.position);
    if (activity !== this.activeActivity) {
      this.activeActivity = activity;
      this.activityTicks = 0;
      this.activityOpened = false;
    }
    if (!activity || this.activityOpened) return;
    this.activityTicks = this.dozer.speed < 0.6 ? this.activityTicks + 1 : 0;
    if (this.activityTicks >= 20) {
      this.activityOpened = true;
      this.events.push({ type: "activity", activity });
    }
  }
  private fundPlatform() {
    const pad = PADS.find(
      (p) =>
        !gatePadFinished(this.progress, p.id) &&
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
      if (amount > 0)
        this.events.push({
          type: "fund",
          pad: pad.id,
          value: amount,
          ratio: this.progress.funding[pad.id] / cost,
        });
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
      kind === "gate" ? gateCost(this.progress) : padCost(this.progress, kind);
    if (cost === null || this.progress.money < cost) return false;
    this.progress.money -= cost;
    if (kind === "gate") {
      this.progress.sector++;
      this.rebuildGates();
    } else {
      this.progress.levels[kind]++;
      if (kind === "engine" || kind === "blade") this.rebuildDozer();
    }
    this.events.push({ type: "upgrade", kind });
    return true;
  }
  snapshot(): SaveData {
    return {
      version: 5,
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
