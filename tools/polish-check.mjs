import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/polish", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `
    <style>body{margin:0}canvas{width:100vw;height:100vh}</style><canvas></canvas><div id="bank"></div>
    <script type="module">
      import { Simulation } from '/src/simulation.ts';
      import { QuarryView } from '/src/world.ts';
      import { CoinEffects } from '/src/coin-effects.ts';
      const sim = new Simulation();
      const view = new QuarryView(document.querySelector('canvas'), sim);
      await view.load(); view.render(0,0);
      window.polish = { sim, view, CoinEffects };
    </script>`,
    }),
  );
  await page.goto("http://127.0.0.1:5173/polish");
  await page.waitForFunction(() => window.polish);
  const result = await page.evaluate(async () => {
    const { sim, view, CoinEffects } = window.polish;
    const { PADS } = await import("/src/progression.ts");
    const step = (count) => {
      for (let i = 0; i < count; i++) {
        sim.update({ throttle: 0, steer: 0, brake: true });
        view.render(1 / 60, 0);
      }
    };
    sim.progress.money = sim.progress.earned = 10000;
    sim.progress.sector = 2;
    sim.gateOpening = [1, 0];
    sim.rebuildGates();
    const magnet = PADS.find((p) => p.id === "magnet");
    sim.teleport(magnet.x, magnet.y, 0);
    step(90);
    const root = view.platforms.group.getObjectByName("magnet");
    const expanding = root.children[0].scale.z > 1.5;
    const overhead = root.getObjectByName("Hologram").position.y > 4.5;
    const funding = sim.progress.funding.magnet;
    step(240);
    const magnetFitted = sim.progress.levels.magnet === 1;
    const finishedKeyHidden =
      !view.platforms.group.getObjectByName("gate1").visible;
    sim.progress.sector = 3;
    sim.gateOpening = [1, 1];
    sim.rebuildGates();
    const refinery = PADS.find((p) => p.id === "refinery");
    sim.teleport(refinery.x, refinery.y, 0);
    step(90);
    const refineryFunding = sim.progress.funding.refinery;
    const fixture = sim.snapshot();
    step(240);
    const installed = view.intake.getObjectByName("Refinery");
    const drum = installed?.getObjectByName("PolishingDrum");
    const before = drum?.rotation.y;
    view.render(1 / 60, 0);
    const drumAnimated = before !== drum?.rotation.y;
    const coins = new CoinEffects(
      document.body,
      document.querySelector("#bank"),
    );
    let arrivals = 0;
    for (let i = 0; i < 50; i++)
      coins.transfer({ x: 100, y: 200 }, 6, i % 2 === 0, () => arrivals++);
    const bounded = document.querySelectorAll(".flying-coin").length === 30;
    coins.setPaused(true);
    const paused = document
      .getAnimations()
      .every((a) => a.playState === "paused");
    await new Promise((resolve) => setTimeout(resolve, 750));
    const held = arrivals === 0;
    coins.setPaused(false);
    await new Promise((resolve) => setTimeout(resolve, 850));
    const cleaned =
      document.querySelectorAll(".flying-coin").length === 0 && arrivals === 10;
    coins.transfer({ x: 100, y: 200 }, 6, true, () => arrivals++);
    coins.clear();
    return {
      expanding,
      overhead,
      funding,
      magnetFitted,
      finishedKeyHidden,
      refineryFunding,
      refineryFitted: sim.progress.levels.refinery === 1,
      drumAnimated,
      bounded,
      paused,
      held,
      cleaned,
      cleared: document.querySelectorAll(".flying-coin").length === 0,
      fixture,
    };
  });
  for (const [key, value] of Object.entries(result)) {
    if (key === "fixture") continue;
    if (key === "funding" || key === "refineryFunding")
      assert.ok(value > 0, key);
    else assert.equal(value, true, key);
  }
  await page.evaluate(() => {
    const { view } = window.polish;
    view.camera.left = -5.8;
    view.camera.right = 5.8;
    view.camera.top = 3.87;
    view.camera.bottom = -3.87;
    view.camera.position.set(6, 8, 17);
    view.camera.lookAt(0, 0.6, 9.3);
    view.camera.updateProjectionMatrix();
    view.renderer.render(view.scene, view.camera);
  });
  await page.screenshot({ path: ".local/refinery-machine.png" });
  await page.evaluate(
    (save) => localStorage.setItem("gilt-quarry-v1", JSON.stringify(save)),
    result.fixture,
  );
  await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await page.locator("#start").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".flying-coin.payment").length > 0,
  );
  await page.screenshot({ path: ".local/refinery-funding.png" });
  await page.waitForFunction(
    () =>
      document.querySelector("#pad-paid").textContent === "Upgrade installed",
  );
  assert.match(await page.locator("#pad-detail").innerText(), /Level 1.*\+\$1/);
  await page.keyboard.press("Escape");
  const saved = JSON.parse(
    await page.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
  );
  assert.equal(saved.progress.levels.refinery, 1);
  assert.equal(saved.progress.levels.magnet, 1);
  await page.locator(".resume").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".local/refinery-mobile.png" });
  assert.deepEqual(errors, []);
  delete result.fixture;
  await writeFile(
    ".local/polish-result.json",
    JSON.stringify({ ...result, errors }, null, 2),
  );
  console.log(JSON.stringify({ ...result, errors }));
} finally {
  await browser.close();
}
