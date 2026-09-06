import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 760 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5173/");
  const fixture = await page.evaluate(async () => {
    const { Simulation, parseSave } = await import("/src/simulation.ts");
    const sim = new Simulation();
    for (const gem of sim.gems.values())
      if (gem.sector < 2 || gem.id % 3 === 0) sim.collect(gem);
    sim.progress.sector = 3;
    sim.progress.levels = {
      engine: 5,
      blade: 5,
      intake: 5,
      magnet: 5,
      refinery: 2,
      vacuum: 3,
    };
    sim.progress.money = 792;
    const save = sim.snapshot();
    save.cargo = save.gems.splice(0, 180).map((g) => g.id);
    save.machine = { x: 0, y: -1180, angle: 0 };
    if (!parseSave(JSON.stringify(save)))
      throw new Error("Invalid HUD fixture");
    return save;
  });
  await page.addInitScript(() => {
    const next = sessionStorage.getItem("hud-fixture");
    if (next) {
      localStorage.setItem("gilt-quarry-v1", next);
      sessionStorage.removeItem("hud-fixture");
    }
  });
  const load = async (save) => {
    await page.evaluate(
      (s) => sessionStorage.setItem("hud-fixture", JSON.stringify(s)),
      save,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#start").click();
    await page.waitForTimeout(600);
  };
  await load(fixture);
  assert.equal(await page.locator("#touch-controls").isVisible(), false);
  assert.equal(await page.locator("#pad-detail").isVisible(), false);
  assert.equal(await page.locator("#cargo-count").innerText(), "180 / 180");
  const checkLayout = async () => {
    const boxes = await page.evaluate(() => {
      const selectors = [
        ".account",
        ".tools",
        ".sector-tag",
        ".contract",
        "#cargo-hud",
        "#pad-guide",
      ];
      return selectors.map((selector) => {
        const e = document.querySelector(selector),
          r = e.getBoundingClientRect();
        return {
          selector,
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      });
    });
    for (const box of boxes) {
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.right <= box.viewportWidth &&
          box.bottom <= box.viewportHeight,
        JSON.stringify(box),
      );
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        assert.ok(
          a.right <= b.x ||
            b.right <= a.x ||
            a.bottom <= b.y ||
            b.bottom <= a.y,
          `Overlap: ${a.selector}, ${b.selector}`,
        );
      }
    const covered =
      boxes.reduce((sum, b) => sum + b.width * b.height, 0) /
      (boxes[0].viewportWidth * boxes[0].viewportHeight);
    assert.ok(covered < 0.23, `HUD coverage ${covered}`);
  };
  for (const viewport of [
    { width: 390, height: 760 },
    { width: 360, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    await checkLayout();
    await page.screenshot({ path: `.local/hud-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 760 });
  await page.locator("#tools-toggle").click();
  assert.equal(await page.locator("#camera").isVisible(), true);
  await page.locator("#camera").click();
  await page.locator("#help").click();
  await page.locator(".resume").click();
  await page.locator("#pause").click();
  await page.locator("#driving-buttons").click();
  await page.locator(".resume").click();
  assert.equal(await page.locator("#touch-controls").isVisible(), true);
  await page.screenshot({ path: ".local/hud-buttons.png" });
  await page.locator("#pause").click();
  await page.locator("#driving-buttons").click();
  await page.locator(".resume").click();
  const near = structuredClone(fixture);
  near.machine = { x: -350, y: -1160, angle: 0 };
  await load(near);
  assert.equal(await page.locator("#pad-detail").isVisible(), true);
  await page.screenshot({ path: ".local/hud-near-platform.png" });
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  await desktop.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await desktop.locator("#start").click();
  assert.equal(await desktop.locator("#help").isVisible(), true);
  assert.equal(await desktop.locator("#tools-toggle").isVisible(), false);
  assert.equal(await desktop.locator("#pad-detail").isVisible(), true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: compact full-cargo HUD, no overlap, under 23% coverage, portrait/landscape, nearby details, toolbar, optional direction buttons, desktop unchanged.",
  );
} finally {
  await browser.close();
}
