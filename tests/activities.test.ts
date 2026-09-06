import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import {
  ASSAY_BETS,
  ASSAY_RTP_PERCENT,
  assayPayout,
  playAssay,
  validAssay,
} from "../src/assay";
import { freshProgress, SECTORS } from "../src/progression";
import { generateOvertimeLayout, overtimeContract } from "../src/overtime";
import { ACTIVITY_PADS } from "../src/activities";
import { Simulation, parseSave, COLLECTOR } from "../src/simulation";

function finishedQuarry() {
  const sim = new Simulation();
  for (const gem of sim.gems.values()) sim.collect(gem);
  sim.progress.sector = 3;
  sim.progress.levels = {
    engine: 5,
    blade: 5,
    intake: 5,
    magnet: 5,
    refinery: 3,
    vacuum: 0,
  };
  return new Simulation(sim.snapshot());
}

test("all 64 assay outcomes match the displayed odds and 98.75% return", () => {
  const counts = new Map<number, number>();
  for (let a = 0; a < 4; a++)
    for (let b = 0; b < 4; b++)
      for (let c = 0; c < 4; c++) {
        const payout = assayPayout(100, [a, b, c]);
        counts.set(payout, (counts.get(payout) ?? 0) + 1);
      }
  assert.equal(counts.get(680), 4);
  assert.equal(counts.get(100), 36);
  assert.equal(counts.get(0), 24);
  assert.equal(
    [...counts].reduce((sum, [value, count]) => sum + value * count, 0) / 64,
    98.75,
  );
});

test("every stake pays whole coins with the same advertised RTP", () => {
  for (const bet of ASSAY_BETS) {
    let total = 0;
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++)
        for (let c = 0; c < 4; c++) {
          const payout = assayPayout(bet, [a, b, c]);
          assert.ok(Number.isInteger(payout));
          total += payout;
        }
    assert.equal(total / (64 * bet), 0.9875);
    assert.equal((total / (64 * bet)) * 100, ASSAY_RTP_PERCENT);
  }
});

test("legacy 6x wins keep their settled balance across repeated reloads", () => {
  const sim = new Simulation();
  sim.progress.money = sim.progress.earned = 600;
  sim.progress.lastAssay = { bet: 100, faces: [2, 2, 2], payout: 600 };
  const restored = new Simulation(parseSave(JSON.stringify(sim.snapshot()))!);
  const reloaded = parseSave(JSON.stringify(restored.snapshot()))!;
  assert.equal(reloaded.progress.money, 600);
  assert.equal(reloaded.progress.earned, 600);
  assert.deepEqual(reloaded.progress.lastAssay, sim.progress.lastAssay);
  assert.equal(validAssay({ bet: 100, faces: [2, 2, 1], payout: 600 }), false);
});

test("stakes settle atomically with net-win accounting; invalid bets never charge", () => {
  const p = freshProgress();
  p.money = p.earned = 100;
  for (const bet of [-10, 0, 1, 500, NaN, Infinity])
    assert.equal(playAssay(p, bet), null);
  assert.equal(p.money, 100);
  assert.equal(
    playAssay(p, 10, () => 1),
    null,
  );
  const triple = playAssay(p, 10, () => 0.8)!;
  assert.deepEqual(triple, { bet: 10, faces: [3, 3, 3], payout: 68 });
  assert.equal(p.money, 158);
  assert.equal(p.earned, 158);
  let rolls = [0, 0.3, 0.7];
  playAssay(p, 100, () => rolls.shift()!);
  assert.equal(p.money, 58);
  assert.equal(p.earned, 158);
  rolls = [0, 0.1, 0.8];
  playAssay(p, 50, () => rolls.shift()!);
  assert.equal(p.money, 58);
  assert.equal(p.earned, 158);
  assert.ok(validAssay(p.lastAssay));
  assert.equal(validAssay({ ...p.lastAssay, payout: 100000 }), false);
});

test("old saves migrate and settled assay outcomes survive reload", () => {
  const sim = new Simulation();
  sim.progress.money = sim.progress.earned = 100;
  playAssay(sim.progress, 100, () => 0.5);
  const restored = parseSave(JSON.stringify(sim.snapshot()))!;
  assert.equal(restored.progress.money, 680);
  assert.deepEqual(restored.progress.lastAssay, sim.progress.lastAssay);
  for (const version of [2, 3, 4]) {
    const legacy = { ...sim.snapshot(), version };
    delete (legacy.progress as Partial<typeof legacy.progress>).overtime;
    delete (legacy.progress as Partial<typeof legacy.progress>).lastAssay;
    const migrated = parseSave(JSON.stringify(legacy))!;
    assert.equal(migrated.version, 6);
    assert.equal(migrated.progress.lastAssay, null);
    assert.deepEqual(migrated.progress.overtime, {
      completed: 0,
      active: false,
      collected: 0,
    });
  }
});

test("overtime is free, keeps equipment, rotates all sectors and caps the live population", () => {
  assert.equal(new Simulation().startOvertime(), null);
  const base = finishedQuarry();
  base.progress.money = 0;
  let sim = base.startOvertime()!;
  assert.equal(sim.progress.money, 0);
  assert.deepEqual(sim.progress.levels, base.progress.levels);
  assert.equal(sim.startOvertime(), null);
  for (let round = 0; round < 12; round++) {
    const job = overtimeContract(round);
    assert.equal(sim.gems.size, Math.min(900, 600 + round * 60));
    assert.ok([...sim.gems.values()].every((g) => g.sector === round % 3));
    assert.deepEqual(
      sim.progress.collected,
      SECTORS.map((s) => s.count),
    );
    const before = sim.progress.money;
    const last = [...sim.gems.values()].at(-1)!;
    for (const gem of sim.gems.values()) sim.collect(gem);
    sim.collect(last);
    assert.equal(
      sim.progress.money - before,
      job.count * (job.value + 3) + job.bonus,
    );
    assert.equal(
      sim.events.filter((e) => e.type === "overtime-complete").length,
      1,
    );
    assert.equal(sim.events.filter((e) => e.type === "victory").length, 0);
    assert.equal(sim.progress.overtime.completed, round + 1);
    assert.ok(parseSave(JSON.stringify(sim.snapshot())));
    sim = sim.startOvertime()!;
    assert.ok(parseSave(JSON.stringify(sim.snapshot())));
  }
});

test("overtime saves restore partial hauls and reject inconsistent or foreign gem IDs", () => {
  const sim = finishedQuarry().startOvertime()!;
  const gem = [...sim.gems.values()][0];
  Matter.Body.setPosition(gem.body, COLLECTOR);
  for (let n = 0; n < 30; n++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  assert.ok(sim.progress.overtime.collected > 0);
  const save = sim.snapshot();
  const restored = new Simulation(parseSave(JSON.stringify(save))!);
  assert.equal(restored.gems.size, sim.gems.size);
  assert.equal(restored.gems.values().next().value!.value, 3);
  assert.equal(restored.progress.money, sim.progress.money);
  for (const mutate of [
    (s: typeof save) => {
      s.progress.overtime.collected++;
    },
    (s: typeof save) => {
      s.gems[0].id = 2000;
    },
    (s: typeof save) => {
      s.progress.overtime.active = false;
    },
    (s: typeof save) => {
      s.progress.victory = false;
    },
    (s: typeof save) => {
      s.progress.overtime.completed = -1;
    },
  ]) {
    const invalid = structuredClone(save);
    mutate(invalid);
    assert.equal(parseSave(JSON.stringify(invalid)), null);
  }
  for (let round = 0; round < 12; round++) {
    const seeds = generateOvertimeLayout(round),
      job = overtimeContract(round),
      sector = SECTORS[job.sector];
    assert.equal(new Set(seeds.map((s) => s.id)).size, job.count);
    assert.ok(
      seeds.every(
        (s) => Math.abs(s.x) < 300 && s.y > sector.minY && s.y < sector.maxY,
      ),
    );
  }
});

test("parking opens an activity once per visit, never places a bet, and reload stays closed", () => {
  const sim = finishedQuarry();
  const pad = ACTIVITY_PADS[0],
    funds = sim.progress.money;
  const step = () => {
    for (let i = 0; i < 45; i++)
      sim.update({ throttle: 0, steer: 0, brake: true });
  };
  sim.teleport(pad.x, pad.y, 0);
  step();
  step();
  assert.equal(sim.events.filter((e) => e.type === "activity").length, 1);
  assert.equal(sim.progress.money, funds);
  const restored = new Simulation(sim.snapshot());
  for (let i = 0; i < 45; i++)
    restored.update({ throttle: 0, steer: 0, brake: true });
  assert.equal(restored.events.filter((e) => e.type === "activity").length, 0);
  sim.teleport(0, 0, 0);
  step();
  sim.teleport(pad.x, pad.y, 0);
  step();
  assert.equal(sim.events.filter((e) => e.type === "activity").length, 2);
});
