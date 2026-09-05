import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const label = process.argv[2] ?? "current";
await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/late-game", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">import Matter from "/node_modules/.vite/deps/matter-js.js";import { Simulation } from "/src/simulation.ts";import { QuarryView } from "/src/world.ts";const view=new QuarryView(document.querySelector("canvas"),new Simulation());await view.load();window.bench={Matter,Simulation,view};</script>',
    }),
  );
  await page.goto("http://127.0.0.1:5173/late-game");
  await page.waitForFunction(() => window.bench);
  const results = [];
  for (const magnet of [0, 5]) {
    const result = await page.evaluate(
      async ({ magnet, solver, vacuum }) => {
        const { Matter, Simulation, view } = window.bench;
        const sim = new Simulation();
        view.sim = sim;
        sim.progress.levels = {
          engine: 5,
          blade: 5,
          intake: 5,
          magnet,
          refinery: 3,
          vacuum,
        };
        sim.progress.sector = 3;
        sim.gateOpening = [1, 1];
        sim.rebuildGates();
        sim.rebuildDozer();
        if (solver) {
          const [p, v] = solver.split(",").map(Number);
          sim.engine.positionIterations = p;
          sim.engine.velocityIterations = v;
        }
        sim.teleport(0, -950, 0);
        let i = 0;
        for (const gem of sim.gems.values()) {
          if (gem.sector !== 2) continue;
          const row = Math.floor(i / 40);
          Matter.Body.setPosition(gem.body, {
            x: ((i % 40) - 19.5 + (row % 2) * 0.5) * 8.2,
            y: -1090 - row * 7.15,
          });
          Matter.Body.setVelocity(gem.body, { x: 0, y: 0 });
          Matter.Sleeping.set(gem.body, true);
          i++;
        }
        const measurements = [];
        const motion = [];
        for (let frame = 0; frame < 420; frame++) {
          await new Promise(requestAnimationFrame);
          const input =
            frame < 240
              ? { throttle: 1, steer: 0, brake: false }
              : frame < 300
                ? { throttle: 0.5, steer: 1, brake: false }
                : { throttle: 0, steer: 0, brake: true };
          const start = performance.now();
          sim.update(input);
          const physics = performance.now() - start;
          sim.events.length = 0;
          const renderStart = performance.now();
          view.render(1 / 60, frame / 60);
          const render = performance.now() - renderStart;
          if (frame >= 60)
            measurements.push({
              phase: frame < 240 ? "push" : frame < 300 ? "turn" : "brake",
              physics,
              render,
              total: physics + render,
              awake: [...sim.gems.values()].filter((g) => !g.body.isSleeping)
                .length,
              contacts: sim.engine.pairs.list.filter((p) => p.isActive).length,
            });
          if ([239, 299, 419].includes(frame))
            motion.push({
              ...sim.position,
              angle: sim.dozer.angle,
              speed: sim.dozer.speed,
            });
        }
        const pct = (rows, key, q) =>
          +rows
            .map((m) => m[key])
            .sort((a, b) => a - b)
            [Math.floor(rows.length * q)].toFixed(2);
        const phases = ["push", "turn", "brake"].map((phase) => {
          const rows = measurements.filter((m) => m.phase === phase);
          return {
            phase,
            physicsP50: pct(rows, "physics", 0.5),
            physicsP95: pct(rows, "physics", 0.95),
            totalP50: pct(rows, "total", 0.5),
            totalP95: pct(rows, "total", 0.95),
            awakeP50: pct(rows, "awake", 0.5),
            contactsP50: pct(rows, "contacts", 0.5),
          };
        });
        const escaped = [...sim.gems.values()].filter(
          (g) =>
            Math.abs(g.body.position.x) > 454 ||
            g.body.position.y < -1564 ||
            g.body.position.y > 364,
        ).length;
        return {
          magnet,
          solver: [
            sim.engine.positionIterations,
            sim.engine.velocityIterations,
          ],
          phases,
          motion,
          escaped,
          gems: sim.gems.size,
          cargo: sim.vacuum.cargo.length,
          vacuum,
        };
      },
      {
        magnet,
        solver: process.env.GILT_SOLVER,
        vacuum: Number(process.env.GILT_BENCH_VACUUM ?? 0),
      },
    );
    results.push(result);
    await page.screenshot({
      path: ".local/late-" + label + "-magnet-" + magnet + ".png",
    });
    assert.equal(result.escaped, 0);
  }
  assert.deepEqual(errors, []);
  const output = { label, results, errors };
  await writeFile(
    ".local/late-" + label + ".json",
    JSON.stringify(output, null, 2),
  );
  console.log(JSON.stringify(output));
} finally {
  await browser.close();
}
