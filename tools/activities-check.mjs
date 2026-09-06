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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const base = process.env.GILT_TEST_URL ?? "http://127.0.0.1:5173/";
  const readSave = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("gilt-quarry-v1")));
  await page.addInitScript(() => {
    const next = sessionStorage.getItem("test-next-save");
    if (next) {
      localStorage.setItem("gilt-quarry-v1", next);
      sessionStorage.removeItem("test-next-save");
    }
  });
  const load = async (fixture) => {
    await page.evaluate(
      (s) => sessionStorage.setItem("test-next-save", JSON.stringify(s)),
      fixture,
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#start").click();
  };
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator("#start").click();
  await page.locator("#pause").click();
  const fresh = await readSave();
  const fixture = structuredClone(fresh);
  fixture.progress.money = fixture.progress.earned = 1000;
  // Park just outside the gold pad, then drive across its boundary in the real game.
  fixture.machine = { x: 350, y: -155, angle: 0 };
  await load(fixture);
  await page.locator("#world").focus();
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.up("w");
  await page.keyboard.down("Space");
  await page.waitForTimeout(700);
  await page.keyboard.up("Space");
  await page.screenshot({ path: ".local/assay-approach.png" });

  await page.locator("#assay-spin").waitFor({ state: "visible" });
  assert.equal(await page.locator("#assay-balance").innerText(), "$1,000");
  await page.screenshot({ path: ".local/assay-desktop.png" });
  await page.locator('[data-bet="100"]').click();
  await page.locator("#assay-spin").click();
  const settled = await readSave();
  assert.equal(settled.progress.lastAssay.bet, 100);
  assert.equal(settled.progress.money, 900 + settled.progress.lastAssay.payout);
  assert.equal(await page.locator("#assay-spin").isDisabled(), true);
  // Close during the reveal; reopening must show the settled result without another charge.
  await page.locator("#panel .close").click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("#panel").isVisible(), false);
  await page.locator("#activity-open").click();
  assert.match(await page.locator("#assay-result").innerText(), /Last spin:/);
  assert.equal((await readSave()).progress.money, settled.progress.money);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".local/assay-mobile.png" });
  assert.equal(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth > innerWidth ||
        document.querySelector("#panel").scrollWidth >
          document.querySelector("#panel").clientWidth,
    ),
    false,
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#start").click();
  await page.locator("#activity-open").click();
  assert.match(await page.locator("#assay-result").innerText(), /Last spin:/);
  assert.deepEqual(
    (await readSave()).progress.lastAssay,
    settled.progress.lastAssay,
  );

  // Verify the new rolling strips move, stop at the settled faces, and clean up.
  await page.evaluate(() => {
    window.originalRandom = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      array.fill(0);
      return array;
    };
  });
  await page.locator("#assay-spin").click();
  await page.evaluate(() => {
    crypto.getRandomValues = window.originalRandom;
  });
  const firstTransform = await page
    .locator(".reel-strip")
    .first()
    .evaluate((e) => getComputedStyle(e).transform);
  await page.waitForTimeout(150);
  const nextTransform = await page
    .locator(".reel-strip")
    .first()
    .evaluate((e) => getComputedStyle(e).transform);
  assert.notEqual(firstTransform, nextTransform);
  await page.screenshot({ path: ".local/assay-spinning.png" });
  await page.waitForTimeout(1900);
  assert.match(await page.locator("#assay-result").innerText(), /Triple!/);
  assert.equal(await page.locator(".reel-strip").count(), 0);
  assert.equal(await page.locator("#assay-spin").isEnabled(), true);
  await page.locator("#panel").evaluate((e) => (e.scrollTop = 0));
  await page.screenshot({ path: ".local/assay-win.png" });

  assert.equal(await page.locator(".reel-neighbor").count(), 6);
  assert.equal(await page.locator(".reel-match").count(), 3);
  const centered = await page
    .locator(".reel-symbol-center")
    .evaluateAll((symbols) =>
      symbols.every((symbol) => {
        const row = symbol.getBoundingClientRect(),
          window = symbol.closest(".reel-window").getBoundingClientRect();
        return (
          Math.abs(
            (row.top + row.bottom) / 2 - (window.top + window.bottom) / 2,
          ) < 1
        );
      }),
    );
  assert.ok(centered, "Winning symbols sit on the center payline");
  for (const [faces, matches] of [
    [
      [0, 1, 0],
      [0, 2],
    ],
    [[0, 1, 2], []],
  ]) {
    await page.evaluate((faces) => {
      let index = 0;
      window.originalRandom = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (array) => {
        array.fill(faces[index++] * 1073741824);
        return array;
      };
    }, faces);
    await page.locator("#assay-spin").click();
    await page.evaluate(() => {
      crypto.getRandomValues = window.originalRandom;
    });
    await page.waitForTimeout(1950);
    const highlighted = await page
      .locator(".assay-reel")
      .evaluateAll((reels) =>
        reels.flatMap((r, i) =>
          r.classList.contains("reel-match") ? [i] : [],
        ),
      );
    assert.deepEqual(highlighted, matches);
    assert.equal(await page.locator(".reel-neighbor").count(), 6);
    await page.locator("#panel").evaluate((e) => (e.scrollTop = 0));
    await page.screenshot({
      path: matches.length
        ? ".local/assay-pair.png"
        : ".local/assay-no-match.png",
    });
  }

  // Zero coins still allow another free post-campaign job.
  const victory = structuredClone(fresh);
  victory.gems = [];
  Object.assign(victory.progress, {
    money: 0,
    earned: 16480,
    sector: 3,
    victory: true,
    collected: [1800, 2100, 2400],
    bonuses: [true, true, true],
    levels: {
      engine: 5,
      blade: 5,
      intake: 5,
      magnet: 5,
      refinery: 3,
      vacuum: 0,
    },
  });
  await load(victory);
  await page.locator("#open-overtime").click();
  await page.screenshot({ path: ".local/overtime-mobile.png" });
  await page.locator("#start-overtime").click();
  const overtime = await readSave();
  assert.equal(overtime.gems.length, 600);
  assert.equal(overtime.progress.money, 0);
  assert.deepEqual(overtime.progress.levels, victory.progress.levels);
  assert.equal(overtime.progress.overtime.active, true);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#start").click();
  assert.equal(await page.locator("#panel").isVisible(), false);
  assert.match(await page.locator("#contract-title").innerText(), /Overtime 1/);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".local/overtime-desktop.png" });

  // The final stone physically enters the collector, awards the bonus and opens the next job.
  const lastStone = structuredClone(overtime);
  lastStone.progress.overtime.collected = 599;
  lastStone.gems = [{ ...overtime.gems[0], x: 0, y: 245 }];
  await load(lastStone);
  await page.locator("#start-overtime").waitFor({ state: "visible" });
  const complete = await readSave();
  assert.equal(complete.progress.money, 256);
  assert.equal(complete.progress.overtime.completed, 1);
  await page.locator("#start-overtime").click();
  const second = await readSave();
  assert.equal(second.gems.length, 660);
  assert.ok(second.gems.every((g) => g.id >= 1800 && g.id < 3900));
  assert.equal(second.progress.money, 256);

  // Reset cancel preserves everything, confirm clears only this game's save.
  await page.evaluate(() =>
    localStorage.setItem("unrelated-test-setting", "keep"),
  );
  await page.locator("#pause").click();
  await page.locator("#reset").click();
  await page.locator(".resume").click();
  assert.equal((await readSave()).progress.overtime.active, true);
  await page.locator("#pause").click();
  await page.locator("#reset").click();
  await page.locator("#confirm-reset").click();
  const reset = await readSave();
  assert.equal(reset.gems.length, 6300);
  assert.equal(reset.progress.money, 0);
  assert.equal(reset.progress.lastAssay, null);
  assert.deepEqual(reset.progress.overtime, {
    completed: 0,
    active: false,
    collected: 0,
  });
  assert.equal(
    await page.evaluate(() => localStorage.getItem("unrelated-test-setting")),
    "keep",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: physical pad entry; atomic wager and interrupted reveal; desktop/mobile; free overtime, resume, delivery and next sector; reset cancel/confirm; no browser errors.",
  );
} finally {
  await browser.close();
}
