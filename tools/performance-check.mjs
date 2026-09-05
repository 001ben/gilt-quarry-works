import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Identical deterministic scenes before/after changes; fixtures never touch player saves.
const label = process.argv[2] ?? "current";
await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/performance", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<style>body{margin:0}canvas{width:100vw;height:100vh;display:block}</style><canvas></canvas>
    <script type="module">
      import Matter from '/node_modules/.vite/deps/matter-js.js';
      import { Simulation } from '/src/simulation.ts';
      import { QuarryView } from '/src/world.ts';
      const view = new QuarryView(document.querySelector('canvas'),new Simulation());
      await view.load();
      window.bench = { Matter, Simulation, view };
    </script>`,
    }),
  );
  await page.goto("http://127.0.0.1:5173/performance");
  await page.waitForFunction(() => window.bench);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
  const results = [];
  for (const scenario of [
    "idle",
    "parked-conveyor",
    "conveyor-600",
    "sweep-600",
  ]) {
    results.push(
      await page.evaluate(async (scenario) => {
        const { Matter, Simulation, view } = window.bench;
        const sim = new Simulation();
        view.sim = sim;
        sim.progress.levels = {
          engine: 5,
          blade: 5,
          intake: 5,
          magnet: 5,
          refinery: 0,
        };
        sim.rebuildDozer();
        sim.teleport(
          scenario === "idle" ? -300 : 0,
          scenario === "idle" ? 20 : scenario === "sweep-600" ? 40 : 245,
          Math.PI,
        );
        if (scenario.endsWith("600")) {
          let i = 0;
          for (const gem of sim.gems.values()) {
            if (i >= 600) break;
            Matter.Body.setPosition(gem.body, {
              x: ((i % 90) - 44.5) * 8.2,
              y: 213 + Math.floor(i / 90) * 8.2,
            });
            Matter.Body.setVelocity(gem.body, { x: 0, y: 0 });
            Matter.Sleeping.set(gem.body, false);
            i++;
          }
        }
        view.render(0, 0);
        const measurements = [];
        const input = {
          throttle: scenario === "sweep-600" ? 1 : 0,
          steer: 0,
          brake: scenario !== "sweep-600",
        };
        for (let frame = 0; frame < 360; frame++) {
          await new Promise(requestAnimationFrame);
          const start = performance.now();
          sim.update(input);
          const physics = performance.now() - start;
          for (const event of sim.events.splice(0)) {
            if (event.type === "collect")
              view.burst(event.x, event.y, event.color);
          }
          const renderStart = performance.now();
          view.render(1 / 60, frame / 60);
          const render = performance.now() - renderStart;
          if (frame >= 60)
            measurements.push({
              physics,
              render,
              total: performance.now() - start,
            });
        }
        const percentile = (key, q) => {
          const values = measurements.map((m) => m[key]).sort((a, b) => a - b);
          return +values[Math.floor(values.length * q)].toFixed(2);
        };
        return {
          scenario,
          physicsP50: percentile("physics", 0.5),
          physicsP95: percentile("physics", 0.95),
          renderP50: percentile("render", 0.5),
          renderP95: percentile("render", 0.95),
          totalP50: percentile("total", 0.5),
          totalP95: percentile("total", 0.95),
          awake: [...sim.gems.values()].filter((g) => !g.body.isSleeping)
            .length,
          pairs: sim.engine.pairs.list.length,
          collected: sim.progress.collected[0],
          calls: view.renderer.info.render.calls,
        };
      }, scenario),
    );
    await page.screenshot({
      path: ".local/perf-" + label + "-" + scenario + ".png",
    });
  }
  const { profile } = await cdp.send("Profiler.stop");
  const names = new Map(
    profile.nodes.map((n) => [
      n.id,
      n.callFrame.functionName + " / " + n.callFrame.url.split("/").at(-1),
    ]),
  );
  const samples = new Map();
  for (const id of profile.samples ?? [])
    samples.set(names.get(id), (samples.get(names.get(id)) ?? 0) + 1);
  const top = [...samples].sort((a, b) => b[1] - a[1]).slice(0, 25);
  const output = { label, results, top, errors };
  await writeFile(
    ".local/performance-" + label + ".json",
    JSON.stringify(output, null, 2),
  );
  await writeFile(
    ".local/performance-" + label + ".cpuprofile",
    JSON.stringify(profile),
  );
  console.log(JSON.stringify(output));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
