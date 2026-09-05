import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await page.goto(process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await page.locator("#start").waitFor({ state: "visible", timeout: 30000 });
await page.screenshot({ path: ".local/start-desktop.png" });
await page.locator("#start").click();
await page.locator("#world").focus();
await page.keyboard.down("w");
await page.waitForTimeout(650);
await page.screenshot({ path: ".local/heap-push.png" });
await page.waitForTimeout(1100);
await page.keyboard.up("w");
await page.keyboard.down("Space");
await page.waitForTimeout(1500);
await page.keyboard.up("Space");
await page.waitForTimeout(1000);
await page.screenshot({ path: ".local/play-desktop.png" });
const collected = await page.locator("#collected").innerText();
assert.ok(
  Number.parseInt(collected) >= 60,
  `Expected physical delivery, saw ${collected}`,
);
await page.keyboard.press("Escape");
const before = JSON.parse(
  await page.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
);
assert.equal(before.version, 5);
assert.equal(
  before.gems.length,
  6300 - before.progress.collected.reduce((a, b) => a + b, 0),
);
await page.waitForTimeout(500);
await page.reload({ waitUntil: "networkidle" });
await page.locator("#start").waitFor({ state: "visible" });
assert.match(await page.locator("#start").innerText(), /Continue/);
await page.locator("#start").click();
assert.equal(
  await page.locator("#money").innerText(),
  "$" + Math.floor(before.progress.money).toLocaleString("en-US"),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const up = await page.locator('[data-dir="down"]').boundingBox();
await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2);
await page.mouse.down();
await page.waitForTimeout(1300);
await page.mouse.up();
await page.keyboard.press("Escape");
const afterTouch = JSON.parse(
  await page.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
);
assert.ok(
  Math.hypot(
    afterTouch.machine.x - before.machine.x,
    afterTouch.machine.y - before.machine.y,
  ) > 10,
  "Directional pad moves the machine",
);
await page.locator(".resume").click();
await page.screenshot({ path: ".local/play-mobile.png" });
await page.locator("#help").click();
await page.screenshot({ path: ".local/help-mobile.png" });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.locator(".close").click();
// Reopen a completed saved campaign and exercise the actual victory-lap UI.
const victory = await browser.newPage({
  viewport: { width: 1440, height: 960 },
});
victory.on("pageerror", (e) => errors.push(e.message));
victory.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
await victory.addInitScript(() => {
  localStorage.setItem(
    "gilt-quarry-v1",
    JSON.stringify({
      version: 1,
      progress: {
        money: 9550,
        earned: 9550,
        levels: { engine: 5, blade: 5, intake: 5 },
        sector: 3,
        collected: [60, 75, 90],
        bonuses: [true, true, true],
        victory: true,
        sandbox: false,
      },
      machine: { x: 0, y: 40, angle: Math.PI },
      gems: [],
    }),
  );
});
await victory.goto(process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await victory.locator("#start").click();
await victory.locator("#victory-lap").click();
await victory.keyboard.press("Escape");
const lap = JSON.parse(
  await victory.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
);
assert.equal(lap.progress.levels.magnet, 5);
assert.equal(lap.progress.levels.refinery, 3);
assert.equal(lap.progress.levels.engine, 5);
assert.equal(lap.progress.sector, 3);
await victory.locator(".resume").click();
await victory.screenshot({ path: ".local/victory-quarry.png" });

// Seed a valid saved shift approaching the engine pad, then drive and fund through actual input.
const upgrade = await browser.newPage({
  viewport: { width: 1440, height: 960 },
});
upgrade.on("pageerror", (e) => errors.push(e.message));
upgrade.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const fixture = structuredClone(before);
fixture.progress.money = 240;
fixture.progress.earned = 240;
fixture.machine = { x: -350, y: 125, angle: 0 };
await upgrade.addInitScript(
  (save) => localStorage.setItem("gilt-quarry-v1", JSON.stringify(save)),
  fixture,
);
await upgrade.goto(process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await upgrade.locator("#start").click();
await upgrade.keyboard.down("w");
await upgrade.waitForTimeout(600);
await upgrade.keyboard.up("w");
await upgrade.keyboard.down("Space");
await upgrade.waitForTimeout(1200);
assert.match(await upgrade.locator("#pad-status").innerText(), /FUNDING/);
await upgrade.waitForFunction(
  () => document.querySelectorAll(".flying-coin.payment").length > 0,
);
await upgrade.screenshot({ path: ".local/platform-funding.png" });
await upgrade.waitForTimeout(4500);
assert.match(await upgrade.locator("#pad-status").innerText(), /FITTED/);
await upgrade.keyboard.up("Space");
await upgrade.keyboard.press("Escape");
const fitted = JSON.parse(
  await upgrade.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
);
assert.equal(fitted.progress.levels.engine, 2);
assert.equal(fitted.progress.money, 150);
await upgrade.locator(".resume").click();
await upgrade.setViewportSize({ width: 2560, height: 1440 });
await upgrade.waitForTimeout(500);
await upgrade.screenshot({ path: ".local/play-large-desktop.png" });
await upgrade.setViewportSize({ width: 390, height: 844 });
await upgrade.waitForTimeout(500);
await upgrade.screenshot({ path: ".local/platform-mobile.png" });
const mobileTargets = await upgrade
  .locator("#touch-controls button, .tools button")
  .evaluateAll((buttons) =>
    buttons.map((b) => ({
      width: b.getBoundingClientRect().width,
      height: b.getBoundingClientRect().height,
    })),
  );
assert.ok(mobileTargets.every((b) => b.width >= 44 && b.height >= 44));
await upgrade.setViewportSize({ width: 844, height: 390 });
await upgrade.waitForTimeout(500);
await upgrade.screenshot({ path: ".local/play-landscape.png" });
assert.equal(
  await upgrade.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  ),
  false,
);
const phone = await browser.newPage({
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
phone.on("pageerror", (e) => errors.push(e.message));
await phone.goto(process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await phone.locator("#start").click();
await phone.locator('[data-dir="up"]').waitFor({ state: "visible" });
await phone.waitForTimeout(500);
await phone.screenshot({ path: ".local/touch-landscape.png" });
assert.equal(
  await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
assert.deepEqual(errors, []);
await writeFile(
  ".local/browser-result.json",
  JSON.stringify(
    { collected, progress: before.progress, errors, mobileOverflow: false },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    collected,
    progress: before.progress,
    errors,
    mobileOverflow: false,
  }),
);
await browser.close();
