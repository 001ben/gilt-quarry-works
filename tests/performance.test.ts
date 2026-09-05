import test from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { CollisionRegion } from "../src/collision-region";
import { Simulation } from "../src/simulation";

const pairs = (bodies: Matter.Body[]) =>
  Matter.Detector.collisions(Matter.Detector.create({ bodies }))
    .map((c) => [c.bodyA.id, c.bodyB.id].sort((a, b) => a - b).join(":"))
    .sort();

test("collision region preserves stock Matter contacts across cell edges and compound bodies", () => {
  const bodies: Matter.Body[] = [];
  let seed = 411;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 2400; i++) {
    const x = ((i % 60) - 30) * 8 + random() * 2;
    const y = Math.floor(i / 60) * 8 - 300 + random() * 2;
    const body = Matter.Bodies.circle(x, y, 3.7 + random());
    Matter.Sleeping.set(body, i % 9 !== 0);
    bodies.push(body);
  }
  bodies.push(
    Matter.Bodies.rectangle(-240, -150, 20, 1000, { isStatic: true }),
  );
  bodies.push(
    Matter.Body.create({
      parts: [
        Matter.Bodies.rectangle(-64, -64, 95, 70),
        Matter.Bodies.rectangle(-64, -105, 120, 10),
      ],
    }),
  );
  const selected: Matter.Body[] = [];
  new CollisionRegion().select(bodies, selected);
  const expected = pairs(bodies);
  assert.ok(expected.length > 10);
  assert.deepEqual(pairs(selected), expected);
});

test("integrated detector keeps all contacts while the real dozer drives into a sleeping heap", () => {
  const sim = new Simulation();
  let checks = 0;
  Matter.Events.on(sim.engine, "beforeSolve", () => {
    if (![1, 30, 90].includes(sim.tick)) return;
    assert.deepEqual(
      pairs(sim.engine.detector.bodies),
      pairs(Matter.Composite.allBodies(sim.engine.world)),
    );
    assert.ok(sim.engine.detector.bodies.length < sim.gems.size / 2);
    checks++;
  });
  for (let i = 0; i < 95; i++)
    sim.update({ throttle: 1, steer: 0, brake: false });
  assert.equal(checks, 3);
  assert.ok(sim.progress.collected[0] >= 60);
});

test("parking does not repeatedly wake untouched heaps", () => {
  const sim = new Simulation();
  const gem = sim.gems.values().next().value!;
  Matter.Body.setPosition(gem.body, { x: 180, y: 40 });
  for (let i = 0; i < 75; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  assert.equal(gem.body.isSleeping, true);
  assert.ok(sim.engine.detector.bodies.length < 30);
});
