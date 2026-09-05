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
await page.goto(process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/", {
  waitUntil: "networkidle",
});
await page.locator("#start").waitFor({ state: "visible", timeout: 30000 });
await page.screenshot({ path: ".local/start-desktop.png" });
await page.locator("#start").click();
await page.locator("#world").focus();
await page.keyboard.down("s");
await page.waitForTimeout(1750);
await page.keyboard.up("s");
await page.keyboard.down("Space");
await page.waitForTimeout(1500);
await page.keyboard.up("Space");
await page.waitForTimeout(1000);
await page.screenshot({ path: ".local/play-desktop.png" });
const collected = await page.locator("#collected").innerText();
assert.ok(
  Number.parseInt(collected) >= 4,
  `Expected physical delivery, saw ${collected}`,
);
await page.keyboard.press("e");
await page.locator("#panel").waitFor({ state: "visible" });
await page.screenshot({ path: ".local/workshop-desktop.png" });
const buy = page.locator('[data-buy="engine"]');
if (await buy.isEnabled()) {
  await buy.click();
  assert.match(await page.locator('[data-buy="engine"]').innerText(), /LV 2/);
}
await page.locator(".close").click();
await page.keyboard.press("Escape");
const before = JSON.parse(
  await page.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
);
await page.waitForTimeout(500);
await page.reload({ waitUntil: "networkidle" });
await page.locator("#start").waitFor({ state: "visible" });
assert.match(await page.locator("#start").innerText(), /Continue/);
await page.locator("#start").click();
assert.equal(
  await page.locator("#money").innerText(),
  "$" + before.progress.money.toLocaleString("en-US"),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const up = await page.locator('[data-dir="up"]').boundingBox();
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
await page.locator("#workshop").click();
await page.screenshot({ path: ".local/workshop-mobile.png" });
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
await victory.keyboard.press("e");
assert.match(await victory.locator('[data-buy="engine"]').innerText(), /LV 5/);
assert.match(
  await victory.locator('[data-buy="gate"]').innerText(),
  /ALL SECTORS OPEN/,
);
await victory.screenshot({ path: ".local/victory-workshop.png" });
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
