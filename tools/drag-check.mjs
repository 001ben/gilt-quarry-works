import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir(".local", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/", {
    waitUntil: "networkidle",
  });
  await page.locator("#start").click();
  const cdp = await page.context().newCDPSession(page);
  const point = (id, x, y) => ({ id, x, y, radiusX: 5, radiusY: 5, force: 1 });
  const send = (type, touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const stick = page.locator("#drag-stick");
  const snapshot = async () => {
    await page.locator("#pause").click();
    const saved = JSON.parse(
      await page.evaluate(() => localStorage.getItem("gilt-quarry-v1")),
    );
    await page.locator(".resume").click();
    return saved;
  };
  const before = await snapshot();
  // Screen-down-left is the initial dozer's forward direction in this camera.
  await send("touchStart", [point(1, 195, 430)]);
  await send("touchMove", [point(1, 159, 480)]);
  await page.waitForTimeout(1000);
  await stick.waitFor({ state: "visible" });
  assert.equal(
    await stick.evaluate((e) => e.classList.contains("reversing")),
    false,
  );
  await page.screenshot({ path: ".local/drag-mobile.png" });
  await send("touchEnd", []);
  await stick.waitFor({ state: "hidden" });
  await page.waitForTimeout(650);
  const forward = await snapshot();
  assert.ok(
    forward.machine.y > before.machine.y + 20,
    "touch drag physically drives forward",
  );
  // Opposite drag reverses without a U-turn.
  await send("touchStart", [point(1, 195, 430)]);
  await send("touchMove", [point(1, 231, 380)]);
  await page.waitForTimeout(650);
  assert.equal(
    await stick.evaluate((e) => e.classList.contains("reversing")),
    true,
  );
  await page.screenshot({ path: ".local/drag-reverse-mobile.png" });
  await send("touchEnd", []);
  await page.waitForTimeout(800);
  const reverse = await snapshot();
  assert.ok(
    reverse.machine.y < forward.machine.y - 10,
    "opposite drag physically reverses",
  );
  assert.ok(
    Math.abs(reverse.machine.angle - forward.machine.angle) < 0.4,
    "reverse preserves the machine heading",
  );
  // Release applies the brake, rather than leaving an old gesture steering.
  await page.waitForTimeout(1200);
  const stopped = await snapshot();
  assert.ok(
    Math.hypot(
      stopped.machine.x - reverse.machine.x,
      stopped.machine.y - reverse.machine.y,
    ) < 1,
  );
  // The owning finger may lift while another remains; the second cannot take over.
  await send("touchStart", [point(1, 195, 430)]);
  await send("touchMove", [point(1, 159, 480)]);
  await send("touchStart", [point(1, 159, 480), point(2, 280, 470)]);
  // A partial CDP touchEnd names the finger being released.
  await send("touchEnd", [point(1, 159, 480)]);
  await stick.waitFor({ state: "hidden" });
  await send("touchMove", [point(2, 285, 420)]);
  assert.equal(await stick.isVisible(), false);
  await send("touchEnd", []);
  await send("touchStart", [point(1, 195, 430)]);
  await send("touchMove", [point(1, 159, 480)]);
  await send("touchCancel", []);
  await stick.waitFor({ state: "hidden" });
  // Opening a panel and resizing cancel gestures too.
  await send("touchStart", [point(1, 195, 430)]);
  await page.locator("#tools-toggle").click();
  await page.locator("#help").click();
  await stick.waitFor({ state: "hidden" });
  await send("touchEnd", []);
  await page.locator(".resume").click();
  await send("touchStart", [point(1, 195, 430)]);
  await page.setViewportSize({ width: 844, height: 390 });
  await stick.waitFor({ state: "hidden" });
  await send("touchEnd", []);
  await send("touchStart", [point(1, 400, 220)]);
  await send("touchMove", [point(1, 440, 240)]);
  await page.waitForTimeout(500);
  await stick.waitFor({ state: "visible" });
  await page.screenshot({ path: ".local/drag-landscape.png" });
  await send("touchEnd", []);
  const turned = await snapshot();
  assert.ok(
    Math.abs(turned.machine.angle - stopped.machine.angle) > 0.2,
    "landscape drag steers the machine",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      forwardDistance: forward.machine.y - before.machine.y,
      reverseDistance: forward.machine.y - reverse.machine.y,
      errors,
    }),
  );
  await writeFile(
    ".local/drag-result.json",
    JSON.stringify(
      {
        before: before.machine,
        forward: forward.machine,
        reverse: reverse.machine,
        stopped: stopped.machine,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
