import Matter from "matter-js";
import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, parseSave } from "../src/simulation";
import { SECTORS, stats, padLockedSector } from "../src/progression";
import { generateGemLayout } from "../src/gems";
import { machinePoint, VACUUM_REAR, VACUUM_MOUTH } from "../src/vacuum";
import { createVacuum } from "../src/vacuum-model";

function fixture(count = 50) {
  const save = new Simulation().snapshot();
  save.progress.sector = 3;
  save.progress.levels.vacuum = 1;
  save.progress.money = save.progress.earned = 10000;
  save.progress.collected = SECTORS.map(
    (s, i) => s.count - (i === 2 ? count : 0),
  );
  save.progress.bonuses = [true, true, true];
  save.machine = { x: 0, y: -1200, angle: 0 };
  save.gems = generateGemLayout()
    .slice(3900, 3900 + count)
    .map((g, i) => ({
      id: g.id,
      x: ((i % 8) - 3.5) * 7.5,
      y: -1323 + (Math.floor(i / 8) - 3) * 7.5,
      angle: 0,
    }));
  return new Simulation(save);
}
const step = (sim: Simulation, n: number) => {
  for (let i = 0; i < n; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
};

test("vacuum reserves capacity without selling, stops full and preserves every ID on reload", () => {
  const sim = fixture();
  step(sim, 200);
  assert.equal(sim.vacuum.cargo.length, 40);
  assert.equal(sim.gems.size, 10);
  assert.equal(sim.progress.money, 10000);
  assert.equal(sim.progress.victory, false);
  const save = parseSave(JSON.stringify(sim.snapshot()))!;
  assert.ok(save);
  const restored = new Simulation(save);
  step(restored, 100);
  assert.equal(restored.vacuum.cargo.length, 40);
  assert.equal(restored.gems.size, 10);
  assert.equal(
    new Set([
      ...restored.gems.keys(),
      ...restored.vacuum.cargo.map((g) => g.id),
    ]).size,
    50,
  );
  const duplicate = structuredClone(save);
  duplicate.cargo[0] = duplicate.gems[0].id;
  assert.equal(parseSave(JSON.stringify(duplicate)), null);
  const excess = structuredClone(save);
  excess.cargo.push(excess.gems.pop()!.id);
  assert.equal(parseSave(JSON.stringify(excess)), null);
});

test("rear unloading animates first, returns physical stones to belt and pays exactly once", () => {
  const sim = fixture(20);
  step(sim, 150);
  assert.equal(sim.gems.size, 0);
  assert.equal(sim.progress.victory, false);
  // Face north: the rear chute is precisely over the main conveyor.
  sim.teleport(0, 245 - VACUUM_REAR.z * 30, 0);
  step(sim, 12);
  assert.ok(sim.vacuum.unloading);
  assert.ok(sim.vacuum.flights.some((f) => f.kind === "unload"));
  assert.equal(sim.progress.money, 10000);
  const saved = parseSave(JSON.stringify(sim.snapshot()))!;
  assert.ok(saved);
  const resumed = new Simulation(saved);
  step(resumed, 250);
  assert.equal(resumed.vacuum.cargo.length, 0);
  assert.equal(resumed.gems.size, 0);
  assert.equal(resumed.progress.money, 10080);
  assert.equal(resumed.progress.victory, true);
  step(resumed, 80);
  assert.equal(resumed.progress.money, 10080);
});

test("vacuum unlocks in zone three, upgrades capacity and enlarges the actual hopper", () => {
  const sim = fixture();
  sim.progress.sector = 2;
  sim.progress.levels.vacuum = 0;
  assert.equal(padLockedSector(sim.progress, "vacuum"), 3);
  assert.equal(sim.purchase("vacuum"), false);
  sim.progress.sector = 3;
  const widths: number[] = [],
    heights: number[] = [];
  for (const capacity of [40, 90, 180]) {
    assert.equal(sim.purchase("vacuum"), true);
    assert.equal(stats(sim.progress).vacuumCapacity, capacity);
    const model = createVacuum(sim.progress.levels.vacuum);
    widths.push(model.userData.width);
    heights.push(model.userData.height);
    assert.ok(model.getObjectByName("VacuumDoor"));
    assert.ok(model.getObjectByName("VacuumHopper"));
  }
  assert.ok(widths[0] < widths[1] && widths[1] < widths[2]);
  assert.ok(heights[0] < heights[1] && heights[1] < heights[2]);
  assert.equal(sim.purchase("vacuum"), false);
});

test("vacuum respects gates, excludes conveyor stones and migrates version five", () => {
  const sim = fixture(1);
  sim.progress.sector = 2;
  sim.gateOpening = [1, 0];
  sim.teleport(0, -920, 0);
  const gem = [...sim.gems.values()][0];
  // The intake reaches across the shut gate, but collection is blocked.
  const point = machinePoint(sim, VACUUM_MOUTH);
  Matter.Body.setPosition(gem.body, point);
  step(sim, 20);
  assert.equal(sim.vacuum.cargo.length, 0);
  const old: any = new Simulation().snapshot();
  old.version = 5;
  delete old.cargo;
  delete old.progress.levels.vacuum;
  delete old.progress.funding.vacuum;
  const migrated = parseSave(JSON.stringify(old))!;
  assert.equal(migrated.version, 6);
  assert.deepEqual(migrated.cargo, []);
  assert.equal(migrated.progress.levels.vacuum, 0);
});

test("overtime can be entirely carried without completing; belt delivery completes the job once", () => {
  const save = fixture(1).snapshot();
  save.progress.victory = true;
  save.progress.collected = [1800, 2100, 2400];
  save.progress.overtime = { active: true, completed: 0, collected: 599 };
  save.gems = [{ id: 0, x: 0, y: -1323, angle: 0 }];
  const sim = new Simulation(save);
  step(sim, 60);
  assert.equal(sim.vacuum.cargo.length, 1);
  assert.equal(sim.progress.overtime.active, true);
  assert.ok(parseSave(JSON.stringify(sim.snapshot())));
  sim.teleport(0, 245 - VACUUM_REAR.z * 30, 0);
  step(sim, 120);
  assert.equal(sim.progress.overtime.completed, 1);
  assert.equal(sim.progress.money, 10253);
  assert.equal(
    sim.events.filter((e) => e.type === "overtime-complete").length,
    1,
  );
});
test("the vacuum leaves belt stones to the collector", () => {
  const sim = fixture(1);
  sim.progress.levels.intake = 5;
  sim.teleport(0, 100, Math.PI);
  const gem = [...sim.gems.values()][0];
  Matter.Body.setPosition(gem.body, { x: 60, y: 245 });
  step(sim, 25);
  assert.equal(sim.vacuum.cargo.length, 0);
});
