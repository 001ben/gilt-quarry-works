import Matter from "matter-js";
import { GATES, stats } from "./progression";
import type { GemSeed } from "./gems";
import type { Simulation, Gem } from "./simulation";

export const VACUUM_MOUTH = { x: 0, z: -4.1 };
export const VACUUM_REAR = { x: 0, z: 2.95 };
export interface VacuumFlight {
  kind: "intake" | "unload";
  gem: GemSeed;
  from: { x: number; y: number };
  to: { x: number; y: number };
  age: number;
  duration: number;
}
export function machinePoint(sim: Simulation, local: { x: number; z: number }) {
  const a = sim.dozer.angle,
    scale = stats(sim.progress).scale * 30;
  return {
    x: sim.position.x + (local.x * Math.cos(a) - local.z * Math.sin(a)) * scale,
    y: sim.position.y + (local.x * Math.sin(a) + local.z * Math.cos(a)) * scale,
  };
}
export function onConveyor(sim: Simulation, p: { x: number; y: number }) {
  const s = stats(sim.progress);
  return (
    (Math.abs(p.x) < s.intakeWidth / 2 - 4 &&
      Math.abs(p.y - 245) < s.intakeDepth / 2 - 4) ||
    (s.feederLength > 0 &&
      Math.abs(p.x) < 23 &&
      p.y > 245 - s.feederLength &&
      p.y < 245)
  );
}

/** Cargo owns gem IDs until discharge lands. Animation cancellation never loses a gem. */
export class Vacuum {
  cargo: GemSeed[] = [];
  flights: VacuumFlight[] = [];
  unloading = false;
  constructor(private sim: Simulation) {}
  update() {
    const sim = this.sim,
      capacity = stats(sim.progress).vacuumCapacity;
    if (!capacity) return;
    for (const flight of this.flights) {
      flight.age++;
      if (flight.age < flight.duration || flight.kind === "intake") continue;
      this.cargo = this.cargo.filter((g) => g.id !== flight.gem.id);
      sim.spawnGem({ ...flight.gem, ...flight.to });
    }
    this.flights = this.flights.filter((f) => f.age < f.duration);
    const rear = machinePoint(sim, VACUUM_REAR);
    this.unloading = onConveyor(sim, rear) && this.cargo.length > 0;
    if (this.unloading) {
      if (sim.tick % 3 !== 0) return;
      const gem = this.cargo.find(
        (g) => !this.flights.some((f) => f.gem.id === g.id),
      );
      if (gem)
        this.flights.push({
          kind: "unload",
          gem,
          from: rear,
          to: rear,
          age: 0,
          duration: 30,
        });
      return;
    }
    if (this.cargo.length >= capacity || sim.tick % 4 !== 0) return;
    const mouth = machinePoint(sim, VACUUM_MOUTH);
    let nearest: Gem | null = null;
    let distance = 65 ** 2;
    for (const gem of sim.gems.values()) {
      const p = gem.body.position,
        d = (p.x - mouth.x) ** 2 + (p.y - mouth.y) ** 2;
      if (
        d >= distance ||
        onConveyor(sim, p) ||
        GATES.some(
          (y, i) =>
            sim.gateOpening[i] < 1 && (p.y - y) * (sim.position.y - y) < 0,
        )
      )
        continue;
      distance = d;
      nearest = gem;
    }
    if (!nearest) return;
    const gem: GemSeed = {
      id: nearest.id,
      sector: nearest.sector,
      radius: nearest.radius,
      value: nearest.value,
      ...nearest.body.position,
      angle: nearest.body.angle,
    };
    sim.gems.delete(gem.id);
    Matter.Composite.remove(sim.engine.world, nearest.body);
    this.cargo.push(gem);
    this.flights.push({
      kind: "intake",
      gem,
      from: nearest.body.position,
      to: mouth,
      age: 0,
      duration: 42,
    });
  }
}
