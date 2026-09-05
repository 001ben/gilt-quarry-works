import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/vacuum-review", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><script type="module">
  import {Simulation} from '/src/simulation.ts'; import {QuarryView} from '/src/world.ts';
  import {generateGemLayout} from '/src/gems.ts'; import {SECTORS} from '/src/progression.ts';
  const save=new Simulation().snapshot();save.progress.sector=3;
  save.progress.levels={engine:5,blade:5,intake:5,magnet:5,refinery:3,vacuum:1};
  save.progress.collected=[1800,2100,2350];save.progress.bonuses=[true,true,true];
  save.machine={x:0,y:-1200,angle:0};
  save.gems=generateGemLayout().slice(3900,3950).map((g,i)=>({id:g.id,x:((i%8)-3.5)*7.5,y:-1365+(Math.floor(i/8)-3)*7.5,angle:0}));
  const sim=new Simulation(save);const view=new QuarryView(document.querySelector('canvas'),sim);await view.load();view.zoom=1.35;view.resize();
  const step=n=>{for(let i=0;i<n;i++){sim.update({throttle:0,steer:0,brake:true});view.render(1/60,0);}};
  for(let i=0;i<100;i++)view.render(1/60,0);window.review={sim,view,step};</script>`,
    }),
  );
  await page.goto("http://127.0.0.1:5173/vacuum-review");
  await page.waitForFunction(() => window.review);
  await page.evaluate(() => window.review.step(26));
  await page.screenshot({ path: ".local/vacuum-intake.png" });
  const intake = await page.evaluate(() => ({
    flights: window.review.sim.vacuum.flights.length,
    cargo: window.review.sim.vacuum.cargo.length,
    money: window.review.sim.progress.money,
  }));
  assert.ok(intake.flights > 0);
  assert.equal(intake.money, 0);
  await page.evaluate(() => window.review.step(190));
  await page.screenshot({ path: ".local/vacuum-small-full.png" });
  assert.equal(
    await page.evaluate(() => window.review.sim.vacuum.cargo.length),
    40,
  );
  await page.evaluate(() => {
    window.review.sim.progress.levels.vacuum = 3;
    window.review.step(55);
  });
  await page.screenshot({ path: ".local/vacuum-large.png" });
  await page.evaluate(() => {
    const { sim, view } = window.review;
    sim.teleport(0, -1200, Math.PI);
    for (let i = 0; i < 100; i++) view.render(1 / 60, 0);
  });
  await page.screenshot({ path: ".local/vacuum-front.png" });
  await page.evaluate(() => {
    const { sim, view } = window.review;
    sim.teleport(0, -1200, 0);
    for (let i = 0; i < 100; i++) view.render(1 / 60, 0);
  });
  const save = await page.evaluate(() => window.review.sim.snapshot());
  assert.ok(save.cargo.length > 40);
  await page.evaluate(() => {
    const { sim, view, step } = window.review;
    sim.teleport(0, 245 - 2.95 * 30 * 1.34, 0);
    for (let i = 0; i < 100; i++) view.render(1 / 60, 0);
    step(20);
  });
  await page.screenshot({ path: ".local/vacuum-unload.png" });
  const unloading = await page.evaluate(() => {
    const { sim, view } = window.review;
    return {
      door: view.vacuum.model.getObjectByName("VacuumDoor").rotation.y,
      tip: view.vacuum.model.getObjectByName("VacuumHopper").rotation.x,
      money: sim.progress.money,
      flights: sim.vacuum.flights.length,
    };
  });
  assert.ok(unloading.door < -0.8 && unloading.tip > 0.15);
  assert.equal(unloading.money, 0);
  assert.ok(unloading.flights > 0);
  const paused = await page.evaluate(() => {
    const { sim, view } = window.review;
    const before = JSON.stringify(sim.snapshot());
    for (let i = 0; i < 10; i++) view.render(0, 0);
    return before === JSON.stringify(sim.snapshot());
  });
  assert.ok(paused);
  await page.evaluate(() => window.review.step(300));
  assert.equal(
    await page.evaluate(() => window.review.sim.progress.money),
    save.cargo.length * 7,
  );
  assert.equal(
    await page.evaluate(() => window.review.sim.vacuum.cargo.length),
    0,
  );
  await page.addInitScript(
    (s) => localStorage.setItem("gilt-quarry-v1", JSON.stringify(s)),
    save,
  );
  await page.goto("http://127.0.0.1:5173/");
  await page.locator("#start").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: ".local/vacuum-mobile.png" });
  assert.equal(
    await page.locator("#cargo-count").innerText(),
    save.cargo.length + " / 180",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: visible intake flights, full-bin stop, larger tier, tipping hopper/rear door, paused animation, physical discharge payment, mobile cargo HUD.",
  );
} finally {
  await browser.close();
}
