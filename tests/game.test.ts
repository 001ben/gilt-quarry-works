import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { Simulation, parseSave, COLLECTOR } from "../src/simulation";
import { gateCost, SECTORS, stats, TOTAL_GEMS } from "../src/progression";
const idle = { throttle: 0, steer: 0, brake: false };

test("driving the first sweep physically delivers starter gems", () => {
  const sim = new Simulation();
  for (let i = 0; i < 95; i++)
    sim.update({ throttle: 1, steer: 0, brake: false });
  for (let i = 0; i < 180; i++) sim.update({ ...idle, brake: true });
  assert.ok(
    sim.progress.collected[0] >= 60,
    `Collected ${sim.progress.collected[0]}; dozer ${JSON.stringify(sim.position)}`,
  );
  assert.equal(
    sim.progress.money,
    sim.progress.collected[0] * SECTORS[0].value,
  );
});
test("the locked sector physically blocks the dozer; purchase opens it", () => {
  const sim = new Simulation();
  sim.teleport(200, -275, 0);
  for (let i = 0; i < 180; i++)
    sim.update({ throttle: 1, steer: 0, brake: false });
  assert.ok(sim.position.y > -420);
  assert.equal(sim.purchase("gate"), false);
  sim.progress.money = 350;
  sim.progress.earned = 350;
  assert.equal(sim.purchase("gate"), true);
  for (let i = 0; i < 90; i++) sim.update({ ...idle, brake: true });
  for (let i = 0; i < 120; i++)
    sim.update({ throttle: 1, steer: 0, brake: false });
  assert.ok(sim.position.y < -480);
});
test("intake upgrades convey gems beyond the original hopper reach", () => {
  const sim = new Simulation();
  sim.progress.levels.intake = 5;
  const g = [...sim.gems.values()][0];
  Matter.Body.setPosition(g.body, { x: 120, y: COLLECTOR.y });
  for (let i = 0; i < 180; i++) sim.update(idle);
  assert.ok(!sim.gems.has(g.id));
});
test("upgrades preserve chassis position and match blade collision width", () => {
  const sim = new Simulation();
  sim.teleport(210, -190, 0.7);
  sim.progress.sector = 3;
  sim.progress.money = 1e5;
  sim.progress.earned = 1e5;
  for (const kind of ["engine", "blade"] as const)
    for (let i = 0; i < 4; i++) {
      const before = { ...sim.position };
      assert.ok(sim.purchase(kind));
      assert.ok(
        Math.hypot(sim.position.x - before.x, sim.position.y - before.y) < 1e-6,
      );
    }
  assert.equal(sim.purchase("engine"), false);
  sim.teleport(0, 0, 0);
  const blade = sim.dozer.parts.find((p) => p.label === "blade")!;
  assert.ok(
    Math.abs(
      blade.bounds.max.x -
        blade.bounds.min.x -
        stats(sim.progress).bladeWidth * 30,
    ) < 0.01,
  );
  assert.equal(sim.dozer.parts.filter((p) => p.label === "wing").length, 2);
});
test("all engine levels have bounded speed and braking settles promptly", () => {
  for (let level = 1; level <= 5; level++) {
    const sim = new Simulation();
    sim.progress.levels.engine = level;
    sim.progress.sector = 3;
    sim.rebuildGates();
    sim.rebuildDozer();
    for (const g of sim.gems.values())
      Matter.Composite.remove(sim.engine.world, g.body);
    sim.teleport(0, -1400, Math.PI);
    for (let i = 0; i < 120; i++)
      sim.update({ throttle: 1, steer: 0, brake: false });
    assert.ok(sim.dozer.speed <= stats(sim.progress).maxSpeed + 0.01);
    assert.ok(sim.dozer.speed > stats(sim.progress).maxSpeed - 0.1);
    for (let i = 0; i < 30; i++) sim.update({ ...idle, brake: true });
    assert.ok(sim.dozer.speed < 0.01);
  }
});
test("campaign accounting, free gate fallback and victory complete exactly once", () => {
  const sim = new Simulation();
  let expected = 0;
  for (let sector = 0; sector < 3; sector++) {
    for (const gem of [...sim.gems.values()].filter(
      (g) => g.sector === sector,
    )) {
      Matter.Body.setPosition(gem.body, COLLECTOR);
      sim.update(idle);
      // Collected bodies cannot award money twice.
      const money = sim.progress.money;
      sim.collect(gem);
      assert.equal(sim.progress.money, money);
    }
    expected +=
      SECTORS[sector].count * SECTORS[sector].value + SECTORS[sector].bonus;
    assert.equal(sim.progress.earned, expected);
    if (sector < 2) {
      assert.equal(gateCost(sim.progress), 0);
      assert.ok(sim.purchase("gate"));
    }
  }
  assert.equal(sim.progress.victory, true);
  assert.equal(sim.gems.size, 0);
  assert.equal(sim.events.filter((e) => e.type === "victory").length, 1);
  assert.equal(sim.progress.earned, 16480);
});
test("save round trip preserves remaining gems, earned money, upgrades and position", () => {
  const sim = new Simulation();
  for (const g of [...sim.gems.values()].slice(0, 120)) sim.collect(g);
  sim.purchase("engine");
  sim.teleport(88, -88, 1.2);
  const save = sim.snapshot(),
    parsed = parseSave(JSON.stringify(save));
  assert.ok(parsed);
  const restored = new Simulation(parsed);
  assert.deepEqual(restored.progress, sim.progress);
  assert.equal(restored.gems.size, TOTAL_GEMS - 120);
  assert.ok(Math.abs(restored.position.x - 88) < 1e-6);
  assert.equal(restored.dozer.angle, 1.2);
  assert.deepEqual(new Set(restored.gems.keys()), new Set(sim.gems.keys()));
  for (const [id, g] of sim.gems)
    assert.equal(restored.gems.get(id)!.radius, g.radius);
});
test("invalid and inconsistent saves safely return null", () => {
  for (const raw of [null, "broken", "{}", '{"version":9}'])
    assert.equal(parseSave(raw), null);
  const s = new Simulation().snapshot();
  s.progress.levels.engine = 99;
  assert.equal(parseSave(JSON.stringify(s)), null);
  s.progress.levels.engine = 1;
  s.gems.push(s.gems[0]);
  assert.equal(parseSave(JSON.stringify(s)), null);
});
