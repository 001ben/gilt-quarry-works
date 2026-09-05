import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Matter from "matter-js";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { bakeModelPart } from "../src/model";
import { Simulation, parseSave } from "../src/simulation";
import { SECTORS, TOTAL_GEMS, freshProgress } from "../src/progression";
import { generateGemLayout } from "../src/gems";
import { sampleTrack, TRACK_LENGTH } from "../src/tracks";

function emptyQuarry() {
  const sim = new Simulation();
  Matter.Composite.remove(
    sim.engine.world,
    [...sim.gems.values()].map((g) => g.body),
  );
  sim.gems.clear();
  sim.teleport(0, 0, 0);
  return sim;
}

test("W/S throttle reverses in the same heading; tracks follow signed ground travel", () => {
  const sim = emptyQuarry();
  for (let i = 0; i < 60; i++)
    sim.update({ throttle: 1, steer: 0, brake: false });
  assert.ok(sim.position.y < -100);
  assert.equal(sim.dozer.angle, 0);
  assert.ok(sim.trackTravel.left > 0);
  assert.equal(sim.trackTravel.left, sim.trackTravel.right);
  const y = sim.position.y,
    phase = sim.trackTravel.left;
  for (let i = 0; i < 120; i++)
    sim.update({ throttle: -1, steer: 0, brake: false });
  assert.ok(sim.position.y > y + 70);
  assert.equal(sim.dozer.angle, 0);
  assert.ok(sim.trackTravel.left < phase);
  for (let i = 0; i < 90; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  const stopped = { ...sim.trackTravel };
  for (let i = 0; i < 30; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  assert.ok(Math.abs(sim.trackTravel.left - stopped.left) < 1e-5);
});

test("arrow steering pivots the chassis and counter-rotates the tracks", () => {
  const sim = emptyQuarry();
  for (let i = 0; i < 30; i++)
    sim.update({ throttle: 0, steer: 1, brake: false });
  assert.ok(sim.dozer.angle > 1);
  assert.ok(Math.hypot(sim.position.x, sim.position.y) < 0.001);
  assert.ok(sim.trackTravel.left > 0);
  assert.ok(sim.trackTravel.right < 0);
  assert.ok(Math.abs(sim.trackTravel.left + sim.trackTravel.right) < 1e-6);
  const previous = { ...sim.trackTravel };
  for (let i = 0; i < 20; i++)
    sim.update({ throttle: 1, steer: 1, brake: false });
  assert.ok(
    sim.trackTravel.left - previous.left >
      sim.trackTravel.right - previous.right,
  );
});

test("track chain wraps continuously around both sprockets at a constant arc length", () => {
  assert.deepEqual(sampleTrack(0), sampleTrack(TRACK_LENGTH));
  for (let s = 0; s < TRACK_LENGTH; s += 0.013) {
    const a = sampleTrack(s),
      b = sampleTrack(s + 0.001);
    assert.ok(Math.abs(Math.hypot(b.y - a.y, b.z - a.z) - 0.001) < 1e-6);
  }
});

test("all painted blade triangles survive runtime batching and form a continuous face", async () => {
  const buffer = await fs.readFile("public/models/gilt-dozer.glb");
  const gltf = await new GLTFLoader().parseAsync(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
    "",
  );
  const source = gltf.scene.getObjectByName("Blade")!;
  let originalTriangles = 0;
  source.traverse((o) => {
    if (o instanceof THREE.Mesh)
      originalTriangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
  });
  const blade = bakeModelPart(source);
  blade.updateMatrixWorld(true);
  const mergedTriangles = (blade.children as THREE.Mesh[]).reduce(
    (sum, mesh) =>
      sum +
      (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) /
        3,
    0,
  );
  assert.equal(mergedTriangles, originalTriangles);
  for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, 0.65, -3),
      new THREE.Vector3(0, 0, 1),
    );
    assert.ok(
      ray
        .intersectObject(blade, true)
        .some(
          (hit) =>
            ((hit.object as THREE.Mesh).material as THREE.Material).name ===
            "Saffron enamel",
        ),
    );
  }
  assert.ok(gltf.scene.getObjectByName("TrackShoe"));
  assert.ok(!gltf.scene.getObjectByName("Track_Assembly_Preview"));
});

test("dense heap layout has 6300 smaller physical stones, all within quarry boundaries", () => {
  const layout = generateGemLayout();
  assert.equal(layout.length, 6300);
  for (const [index, zone] of SECTORS.entries())
    assert.equal(layout.filter((g) => g.sector === index).length, zone.count);
  assert.ok(
    layout.every(
      (g) =>
        g.radius >= 3.1 &&
        g.radius <= 3.7 &&
        Math.abs(g.x) < 440 &&
        g.y > -1550 &&
        g.y < 350,
    ),
  );
  const starter = layout.slice(0, 180);
  assert.ok(
    Math.max(...starter.map((g) => g.x)) -
      Math.min(...starter.map((g) => g.x)) <
      100,
  );
});

test("old saves migrate money, equipment and clearance fractions without awarding extra credit", () => {
  const p = freshProgress();
  p.money = 6;
  p.earned = 96;
  p.levels.engine = 2;
  p.collected = [8, 0, 0];
  const gems = Array.from({ length: 225 }, (_, id) => ({
    id,
    x: 100,
    y: -100,
    angle: 0,
  })).slice(8);
  const save = parseSave(
    JSON.stringify({
      version: 1,
      progress: p,
      machine: { x: 0, y: 40, angle: Math.PI },
      gems,
    }),
  );
  assert.ok(save);
  assert.equal(save.version, 6);
  assert.equal(save.progress.money, 6);
  assert.equal(save.progress.earned, 96);
  assert.equal(save.progress.levels.engine, 2);
  assert.equal(save.progress.collected[0], 240);
  assert.equal(save.gems.length, TOTAL_GEMS - 240);
  assert.ok(parseSave(JSON.stringify(save)));
});
