import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { Simulation, parseSave, COLLECTOR } from "../src/simulation";
import { PADS, padLockedSector } from "../src/progression";
const idle = { throttle: 0, steer: 0, brake: true };
function step(sim: Simulation, frames: number) {
  for (let i = 0; i < frames; i++) sim.update(idle);
}
function isolate(sim: Simulation, keep = 0) {
  const gems = [...sim.gems.values()].sort((a, b) => a.radius - b.radius);
  for (const gem of gems.slice(keep)) {
    Matter.Composite.remove(sim.engine.world, gem.body);
    sim.gems.delete(gem.id);
  }
  return gems.slice(0, keep);
}
test("platform escrow survives leaving and reloading, then fits only one level per visit", () => {
  let sim = new Simulation();
  const pad = PADS.find((p) => p.id === "engine")!;
  sim.progress.money = sim.progress.earned = 40;
  sim.teleport(pad.x, pad.y, 0);
  step(sim, 150);
  assert.equal(sim.progress.money, 0);
  assert.equal(sim.progress.funding.engine, 40);
  assert.equal(sim.progress.levels.engine, 1);
  sim.teleport(0, 0);
  step(sim, 1);
  const save = parseSave(JSON.stringify(sim.snapshot()));
  assert.ok(save);
  sim = new Simulation(save);
  sim.progress.money += 200;
  sim.progress.earned += 200;
  sim.teleport(pad.x, pad.y, 0);
  step(sim, 600);
  assert.equal(sim.progress.levels.engine, 2);
  assert.equal(sim.progress.funding.engine, 0);
  assert.equal(sim.progress.money, 150);
  const parked = parseSave(JSON.stringify(sim.snapshot()));
  assert.ok(parked);
  sim = new Simulation(parked);
  step(sim, 60);
  assert.equal(
    sim.progress.money,
    150,
    "reloading on a completed pad does not begin a second purchase",
  );
  sim.teleport(0, 0);
  step(sim, 1);
  sim.teleport(pad.x, pad.y);
  step(sim, 45);
  assert.ok(sim.progress.funding.engine > 0);
  assert.equal(sim.progress.levels.engine, 2);
});
test("a fully cleared sector refunds partial key funding and lowers the physical gate before passage", () => {
  const sim = new Simulation();
  sim.progress.money = sim.progress.earned = 30;
  sim.teleport(335, -345, 0);
  step(sim, 60);
  assert.equal(sim.progress.funding.gate1, 30);
  for (const gem of [...sim.gems.values()].filter((g) => g.sector === 0))
    sim.collect(gem);
  const wallet = sim.progress.money;
  assert.ok(
    parseSave(JSON.stringify(sim.snapshot())),
    "free key with existing escrow remains a valid save",
  );
  step(sim, 1);
  assert.equal(sim.progress.sector, 2);
  assert.equal(sim.progress.money, wallet + 30);
  assert.equal(sim.gates.length, 2);
  step(sim, 45);
  assert.ok(sim.gateOpening[0] > 0 && sim.gateOpening[0] < 1);
  assert.equal(sim.gates.length, 2);
  step(sim, 46);
  assert.equal(sim.gates.length, 1);
  assert.equal(
    sim.activePad,
    null,
    "finished key pad leaves the driving route",
  );
});

test("deeper sectors unlock stronger equipment and new machinery", () => {
  const sim = new Simulation();
  sim.progress.money = sim.progress.earned = 100000;
  assert.equal(sim.purchase("magnet"), false);
  assert.equal(sim.purchase("refinery"), false);
  for (const kind of ["engine", "blade", "intake"] as const) {
    assert.ok(sim.purchase(kind));
    assert.ok(sim.purchase(kind));
    assert.equal(sim.purchase(kind), false);
    assert.equal(padLockedSector(sim.progress, kind), 2);
  }
  assert.ok(sim.purchase("gate"));
  for (const kind of ["engine", "blade", "intake"] as const) {
    assert.ok(sim.purchase(kind));
    assert.equal(sim.purchase(kind), false);
  }
  for (let i = 0; i < 3; i++) assert.ok(sim.purchase("magnet"));
  assert.equal(sim.purchase("magnet"), false);
  assert.equal(sim.purchase("refinery"), false);
  assert.ok(sim.purchase("gate"));
  for (const kind of [
    "engine",
    "blade",
    "intake",
    "magnet",
    "refinery",
  ] as const)
    assert.ok(sim.purchase(kind));
});

test("refinery pays its bonus once per gem and preserves it through saves", () => {
  const sim = new Simulation();
  sim.progress.sector = 3;
  sim.progress.money = sim.progress.earned = 10000;
  for (let level = 1; level <= 3; level++) {
    assert.ok(sim.purchase("refinery"));
    const wallet = sim.progress.money,
      earned = sim.progress.earned;
    const gem = sim.gems.values().next().value!;
    sim.collect(gem);
    sim.collect(gem);
    assert.equal(sim.progress.money, wallet + gem.value + level);
    assert.equal(sim.progress.earned, earned + gem.value + level);
  }
  assert.equal(sim.purchase("refinery"), false);
  const restored = parseSave(JSON.stringify(sim.snapshot()));
  assert.ok(restored);
  assert.deepEqual(restored.progress, sim.progress);
});

test("version three keeps existing equipment and escrow even when the next tier moves deeper", () => {
  const old = JSON.parse(JSON.stringify(new Simulation().snapshot()));
  old.version = 3;
  old.progress.levels.engine = 5;
  old.progress.levels.magnet = 3;
  old.progress.funding.magnet = 80;
  old.progress.earned = 1000;
  old.progress.money = 100;
  delete old.progress.levels.refinery;
  delete old.progress.funding.refinery;
  const saved = parseSave(JSON.stringify(old));
  assert.ok(saved);
  assert.equal(saved.version, 6);
  assert.equal(saved.progress.levels.refinery, 0);
  assert.equal(saved.progress.levels.engine, 5);
  assert.equal(padLockedSector(saved.progress, "engine"), null);
  assert.equal(saved.progress.funding.magnet, 80);
  assert.equal(padLockedSector(saved.progress, "magnet"), 3);
  const sim = new Simulation(saved);
  sim.teleport(350, -535);
  step(sim, 60);
  assert.equal(sim.progress.money, 100);
  assert.equal(sim.progress.funding.magnet, 80);
});
test("maximum conveyor catches far-edge stragglers and its long forward feeder delivers them", () => {
  const sim = new Simulation();
  const [edge, feeder] = isolate(sim, 2);
  sim.progress.levels.intake = 5;
  sim.teleport(-300, 0, 0);
  Matter.Body.setPosition(edge.body, { x: 405, y: COLLECTOR.y });
  Matter.Body.setPosition(feeder.body, { x: 0, y: -70 });
  step(sim, 350);
  assert.ok(!sim.gems.has(edge.id));
  assert.ok(!sim.gems.has(feeder.id));
});
test("magnet starts weak, strengthens with upgrades, and never pulls behind the plow or across a closed gate", () => {
  const trial = (level: number, x: number, y: number, machineY = 0) => {
    const sim = new Simulation();
    const [gem] = isolate(sim, 1);
    sim.progress.levels.magnet = level;
    sim.teleport(0, machineY, 0);
    Matter.Body.setPosition(gem.body, { x, y });
    step(sim, 60);
    return Math.hypot(gem.body.position.x - x, gem.body.position.y - y);
  };
  assert.ok(trial(1, 30, -130) > 1);
  assert.ok(trial(5, 30, -130) > trial(1, 30, -130) * 2);
  assert.equal(trial(0, 30, -130), 0);
  assert.equal(trial(5, 120, 50), 0);
  assert.equal(trial(5, 0, -455, -290), 0);
  assert.equal(
    trial(5, 0, -455, -330),
    0,
    "an overhanging magnet cannot pull stones through the gate",
  );
});
test("version two saves gain an unfitted magnet and empty platform funding", () => {
  const snapshot = new Simulation().snapshot();
  const old = JSON.parse(JSON.stringify(snapshot));
  old.version = 2;
  delete old.progress.levels.magnet;
  delete old.progress.funding;
  const restored = parseSave(JSON.stringify(old));
  assert.ok(restored);
  assert.equal(restored.version, 6);
  assert.equal(restored.progress.levels.magnet, 0);
  assert.equal(restored.progress.funding.engine, 0);
  assert.equal(restored.gems.length, 6300);
  restored.progress.funding.engine = -1;
  assert.equal(parseSave(JSON.stringify(restored)), null);
});

test("magnet keeps loose gems spread across the blade and lets captured stones sleep", () => {
  const sim = new Simulation();
  const [left, right, captured] = isolate(sim, 3);
  sim.progress.levels.magnet = 5;
  sim.teleport(0, 0, 0);
  Matter.Body.setPosition(left.body, { x: -30, y: -155 });
  Matter.Body.setPosition(right.body, { x: 30, y: -155 });
  Matter.Body.setPosition(captured.body, { x: 0, y: -82 });
  step(sim, 120);
  assert.ok(left.body.position.y > -130);
  assert.ok(right.body.position.y > -130);
  assert.ok(
    left.body.position.x < -25 && right.body.position.x > 25,
    "gems keep separate lanes instead of bunching at one point",
  );
  assert.equal(captured.body.isSleeping, true);
  assert.equal(captured.body.position.y, -82);
});

test("magnet leaves packed ore sleeping but still draws a nearby straggler", () => {
  const sim = new Simulation();
  const gems = isolate(sim, 10);
  sim.progress.levels.magnet = 5;
  sim.teleport(0, 0, 0);
  for (let i = 0; i < 9; i++)
    Matter.Body.setPosition(gems[i].body, {
      x: ((i % 3) - 1) * 8.2,
      y: -170 - Math.floor(i / 3) * 8.2,
    });
  const loose = gems[9];
  Matter.Body.setPosition(loose.body, { x: 80, y: -150 });
  step(sim, 90);
  assert.ok(gems.slice(0, 9).every((g) => g.body.isSleeping));
  assert.ok(loose.body.position.y > -140);
  assert.ok(loose.body.position.x < 75);
});
