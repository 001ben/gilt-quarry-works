import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.route("**/inspection", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: `
  <style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>
  <script type="module">
    import { Simulation } from '/src/simulation.ts';
    import { QuarryView } from '/src/world.ts';
    const sim=new Simulation();
    const view=new QuarryView(document.querySelector('canvas'),sim);
    await view.load();view.render(0,0);
    window.inspection={sim,view};
  </script>`,
  }),
);
await page.goto("http://127.0.0.1:5173/inspection");
await page.waitForFunction(() => window.inspection?.view.ready);
const result = await page.evaluate(async () => {
  const { sim, view } = window.inspection;
  const matrices = () =>
    view.tracks.map((t) => Array.from(t.mesh.instanceMatrix.array));
  const initial = matrices();
  const beltStart = view.belts.map((s) => s.position.toArray());
  const holoStart = view.platforms.group.children[0].children.find(
    (c) => c.type === "Group",
  ).rotation.y;
  const frameTimes = [];
  let last = performance.now();
  // A real render frame with the full quarry present; drive through the starter heap.
  for (let i = 0; i < 120; i++) {
    await new Promise(requestAnimationFrame);
    const now = performance.now();
    frameTimes.push(now - last);
    last = now;
    sim.update({ throttle: i < 85 ? 1 : 0, steer: 0, brake: i >= 85 });
    sim.events.length = 0;
    view.render(1 / 60, now / 1000);
  }
  const moved = matrices();
  for (let i = 0; i < 100; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  view.render(0, 0);
  const stopped = matrices();
  for (let i = 0; i < 10; i++) view.render(0, i);
  const paused = matrices();
  const beltBefore = view.belts.map((s) => s.position.toArray());
  const holoBefore = view.platforms.group.children[0].children.find(
    (c) => c.type === "Group",
  ).rotation.y;
  view.render(0, 9999);
  const beltAfter = view.belts.map((s) => s.position.toArray());
  const times = frameTimes.slice(15).sort((a, b) => a - b);
  const output = {
    beltAnimated: JSON.stringify(beltStart) !== JSON.stringify(beltBefore),
    beltPaused: JSON.stringify(beltBefore) === JSON.stringify(beltAfter),
    hologramAnimated: holoStart !== holoBefore,
    hologramPaused:
      holoBefore ===
      view.platforms.group.children[0].children.find((c) => c.type === "Group")
        .rotation.y,
    gemCount: sim.gems.size,
    collected: sim.progress.collected[0],
    medianFrameMs: times[Math.floor(times.length * 0.5)],
    p95FrameMs: times[Math.floor(times.length * 0.95)],
    drawCalls: view.renderer.info.render.calls,
    triangles: view.renderer.info.render.triangles,
    trackBatches: view.tracks.length,
    trackInstances: view.tracks.map((t) => t.mesh.count),
    animated: JSON.stringify(initial) !== JSON.stringify(moved),
    pausedStable: JSON.stringify(stopped) === JSON.stringify(paused),
  };
  // Show the same runtime-exported model close up, including the closed plow and real track links.
  sim.progress.levels.magnet = 5;
  sim.teleport(0, 0, Math.PI);
  view.render(0, 0);
  view.camera.left = -5.2;
  view.camera.right = 5.2;
  view.camera.top = 3.47;
  view.camera.bottom = -3.47;
  view.camera.position.set(6, 5, 8);
  view.camera.lookAt(0, 0.7, 0);
  view.camera.updateProjectionMatrix();
  view.renderer.render(view.scene, view.camera);
  return output;
});
await page.screenshot({ path: ".local/runtime-dozer.png" });
assert.equal(result.animated, true);
assert.equal(result.beltAnimated, true);
assert.equal(result.beltPaused, true);
assert.equal(result.hologramAnimated, true);
assert.equal(result.hologramPaused, true);
const gate = await page.evaluate(() => {
  const { sim, view } = window.inspection;
  sim.progress.money = sim.progress.earned = 350;
  sim.teleport(0, -345, 0);
  for (let i = 0; i < 300; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  view.render(1 / 60, 0);
  const halfway = view.gates[0].position.y;
  const key = view.platforms.group.children[4].children.find(
    (c) => c.type === "Group",
  );
  let color;
  key.traverse((o) => {
    if (o.isMesh) color = o.material.color.getHex();
  });
  for (let i = 0; i < 120; i++)
    sim.update({ throttle: 0, steer: 0, brake: true });
  view.render(1 / 60, 0);
  return { halfway, hidden: !view.gates[0].visible, color };
});
assert.ok(gate.halfway < 0 && gate.halfway > -2.6);
assert.equal(gate.hidden, true);
assert.equal(gate.color, 0x66eda9);
assert.equal(result.pausedStable, true);
assert.deepEqual(result.trackInstances, [40, 40]);
assert.ok(result.collected >= 60);
assert.deepEqual(errors, []);
await writeFile(
  ".local/machinery-result.json",
  JSON.stringify({ ...result, errors }, null, 2),
);
console.log(JSON.stringify({ ...result, errors }));
await browser.close();
