import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
import { mountAssayPanel } from "./assay-panel";
import { ACTIVITY_PADS } from "./activities";
import { overtimeContract } from "./overtime";
import { DragControls } from "./drag-controls";
import { CoinEffects } from "./coin-effects";
import { GameAudio } from "./audio";
import {
  PADS,
  padCost,
  padDetail,
  padLockedSector,
  stats,
  SECTORS,
  TOTAL_GEMS,
} from "./progression";
import { parseSave, Simulation } from "./simulation";
import { QuarryView } from "./world";

const SAVE_KEY = "gilt-quarry-v1";
let saved: string | null = null,
  storageAvailable = true;
try {
  saved = localStorage.getItem(SAVE_KEY);
} catch {
  storageAvailable = false;
}
const restored = parseSave(saved);
let sim = new Simulation(restored);
const audio = new GameAudio();
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <canvas id="world" aria-label="3D quarry. W forward, S reverse. Left and right arrows steer. Push gems into the deposit conveyor." tabindex="0"></canvas>
  <div class="vignette"></div>
  <header class="topbar">
    <a class="brand" href="#" aria-label="GILT Quarry Works"><span class="brand-mark">◇</span><strong>GILT<span>QUARRY WORKS</span></strong></a>
    <div class="location"><span class="status-dot"></span><span id="location">01 / QUARTZ FLATS</span><small>OPERATION IN PROGRESS</small></div>
    <div class="account"><span>AVAILABLE FUNDS</span><strong id="money">$0</strong><small id="save-state">LOCAL SAVE READY</small></div>
  </header>
  <nav class="tools" aria-label="Game controls">
    <button id="sound" title="Toggle sound (M)" aria-label="Mute sound">♫</button>
    <button id="camera" title="Change camera (C)" aria-label="Change camera">⌖</button>
    <button id="help" title="Controls (?)" aria-label="Show controls">?</button>
    <button id="pause" title="Pause (Escape)" aria-label="Pause game">Ⅱ</button>
  </nav>
  <div class="sector-tag"><span class="diamond">◆</span><span id="mineral">QUARTZ</span><span id="gem-value">$1 / GEM</span></div>
  <section class="contract" id="contract">
    <div class="eyebrow"><span id="contract-label">YOUR FIRST CONTRACT</span><span id="contract-number">01—03</span></div>
    <h2 id="contract-title">Make room for more.</h2>
    <p id="contract-copy">Push quartz onto the striped deposit belt.</p>
    <div class="progress-line"><span id="collected">0 / 1800 collected</span><span id="percent">0%</span></div>
    <div class="progress-track"><span id="progress-fill"></span></div>
    <div class="contract-footer"><span id="bonus">HALFWAY BONUS</span><strong id="bonus-value">+$120</strong></div>
  </section>
  <div class="bottom-center"><span class="direction-tip" id="tip">Drag toward the deposit, or hold W to push the first heap.</span><div class="key-guide"><kbd>W</kbd><kbd>S</kbd><span>forward / reverse</span><i></i><kbd>←</kbd><kbd>→</kbd><span>steer</span><i></i><kbd>SPACE</kbd><span>brake</span></div></div>
  <aside class="pad-guide" id="pad-guide"><div class="eyebrow" id="pad-status">DRIVE-ON UPGRADES</div><strong id="pad-name">Find a glowing platform</strong><p id="pad-detail">Park on a pad to fund your next part.</p><div class="progress-track"><span id="pad-fill"></span></div><div class="pad-payment"><span id="pad-paid"></span><span id="pad-distance"></span></div></aside>
  <button id="activity-open" class="activity-open" hidden></button>
  <div id="touch-controls" aria-label="Touch driving controls"><button data-dir="up" aria-label="Drive forward">↑</button><button data-dir="left" aria-label="Steer left">←</button><button data-dir="down" aria-label="Reverse">↓</button><button data-dir="right" aria-label="Steer right">→</button><button data-dir="brake" aria-label="Brake">■</button></div>
  <aside id="cargo-hud" hidden><span>VACUUM HOLD</span><strong id="cargo-count"></strong><div class="progress-track"><span id="cargo-fill"></span></div><small id="cargo-copy"></small></aside>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="loading"><span class="loader"></span><strong>Opening the quarry</strong><span>Unloading your machine…</span></div>
  <div class="welcome" id="welcome" hidden><div class="eyebrow">A LITTLE MACHINE. A LOT OF POSSIBILITY.</div><h1>Your quarry.<br>Your rules.</h1><p>Push gems. Grow your machine.<br>Turn a quiet patch of dirt into an empire.</p><button class="primary" id="start">${restored ? "Continue your shift" : "Start your shift"} <span>→</span></button><small>DRAG TO DRIVE · W / S & ← / → ALSO WORK</small></div>
  <dialog id="panel"><div id="panel-content"></div></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("world");
let view: QuarryView;
let started = false,
  paused = true,
  modal: "help" | "pause" | "victory" | "reset" | "assay" | "contracts" | null =
    null;
let keys = new Set<string>(),
  touch = new Set<string>();
let last = performance.now(),
  accumulator = 0,
  lastHud = 0,
  lastSave = 0,
  toastTimer = 0;
let pendingPayout = { value: 0, x: 0, y: 0 },
  lastPayout = 0;
let panelCleanup = () => {};
const dialog = $<HTMLDialogElement>("panel");
const drag = new DragControls(canvas, () => started && !paused);
const coins = new CoinEffects(app, $("money"));
const money = (v: number) => "$" + Math.floor(v).toLocaleString("en-US");
function toast(text: string) {
  $("toast").textContent = text;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => $("toast").classList.remove("visible"),
    4200,
  );
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(sim.snapshot()));
    storageAvailable = true;
    $("save-state").textContent = "PROGRESS SAVED";
  } catch {
    storageAvailable = false;
    $("save-state").textContent = "SAVE UNAVAILABLE";
  }
}
function activeSector() {
  return sim.position.y < -990 ? 2 : sim.position.y < -420 ? 1 : 0;
}
function updateHud() {
  const p = sim.progress,
    sector = activeSector(),
    zone = SECTORS[sector],
    count = p.collected[sector];
  $("money").textContent = money(p.money);
  const capacity = stats(p).vacuumCapacity,
    cargo = sim.vacuum.cargo.length;
  $("cargo-hud").hidden = !capacity;
  $("cargo-count").textContent = cargo + " / " + capacity;
  $("cargo-fill").style.width = (capacity ? (cargo / capacity) * 100 : 0) + "%";
  $("cargo-copy").textContent = sim.vacuum.unloading
    ? "REAR GATE OPEN · UNLOADING"
    : cargo === capacity
      ? "FULL · RETURN TO THE BELT"
      : "Rear chute over belt to unload";

  $("location").textContent = `0${sector + 1} / ${zone.name.toUpperCase()}`;
  $("mineral").textContent = zone.mineral.toUpperCase();
  $("gem-value").textContent = `$${zone.value + stats(p).gemBonus} / GEM`;
  $("contract-number").textContent = `0${sector + 1}—03`;
  $("contract-title").textContent = p.victory
    ? "A quarry well cleared."
    : count === zone.count
      ? "Nothing left behind."
      : sector === 0
        ? "Make room for more."
        : sector === 1
          ? "A golden opportunity."
          : "The deeper reward.";
  $("contract-copy").textContent =
    count === zone.count
      ? p.sector < 3
        ? "Drive onto the key platform by the next gate."
        : "Every gem counts. Finish the remaining sectors."
      : `Push ${zone.mineral.toLowerCase()} onto the striped deposit belt.`;
  $("collected").textContent = `${count} / ${zone.count} collected`;
  $("percent").textContent = `${Math.round((count / zone.count) * 100)}%`;
  $("progress-fill").style.width = `${(count / zone.count) * 100}%`;
  $("bonus").textContent = p.bonuses[sector]
    ? "CONTRACT BONUS EARNED"
    : "HALFWAY BONUS";
  $("bonus-value").textContent = `+$${zone.bonus}`;
  $("contract-label").textContent = p.victory
    ? "THE NEXT SHIFT"
    : "SECTOR CONTRACT";
  if (p.victory) {
    const job = overtimeContract(p.overtime.completed);
    const active = p.overtime.active;
    $("contract-number").textContent =
      "OT / " + job.number.toString().padStart(2, "0");
    $("contract-title").textContent = active
      ? "Overtime " + job.number + "."
      : "More ground. Same machine.";
    $("contract-copy").textContent = active
      ? SECTORS[job.sector].name +
        ": deliver " +
        job.count +
        " richer gems to the south belt."
      : "Visit the Overtime pad in Quartz Flats, or accept your next free job from Pause.";
    $("collected").textContent = active
      ? p.overtime.collected + " / " + job.count + " collected"
      : p.overtime.completed + " overtime jobs completed";
    const percent = active ? (p.overtime.collected / job.count) * 100 : 100;
    $("percent").textContent = Math.round(percent) + "%";
    $("progress-fill").style.width = percent + "%";
    $("bonus").textContent = active ? "COMPLETION BONUS" : "NEXT JOB BONUS";
    $("bonus-value").textContent = money(job.bonus);
    if (active && sector === job.sector)
      $("gem-value").textContent =
        money(job.value + stats(p).gemBonus) + " / GEM";
  }
  const activity = ACTIVITY_PADS.find((pad) => pad.id === sim.activeActivity);
  $("activity-open").hidden = !activity;
  if (activity) $("activity-open").textContent = activity.name + " · OPEN →";
  const nearest = PADS.filter((pad) => padCost(p, pad.id) !== null).sort(
    (a, b) =>
      Math.hypot(a.x - sim.position.x, a.y - sim.position.y) -
      Math.hypot(b.x - sim.position.x, b.y - sim.position.y),
  )[0];
  const pad = PADS.find((pad) => pad.id === sim.activePad) ?? nearest;
  $("pad-guide").hidden = !pad;
  if (pad) {
    const cost = padCost(p, pad.id),
      paid = p.funding[pad.id];
    const onPad = sim.activePad === pad.id;
    const fitted = onPad && sim.padCompleted;
    const locked = fitted ? null : padLockedSector(p, pad.id);
    $("pad-status").textContent =
      locked !== null
        ? "OPEN SECTOR 0" + locked + " TO UPGRADE"
        : onPad
          ? cost === null || sim.padCompleted
            ? "FITTED - DRIVE OFF TO CONTINUE"
            : p.money
              ? "FUNDING - STAY ON THE PLATFORM"
              : "FUNDING SAVED - BRING MORE GEMS"
          : "NEAREST UPGRADE PLATFORM";
    $("pad-name").textContent = pad.name;
    $("pad-detail").textContent = padDetail(p, pad.id, fitted);
    $("pad-paid").textContent = fitted
      ? "Upgrade installed"
      : locked !== null
        ? "Funding held: " + money(paid)
        : cost === null
          ? "Complete"
          : cost === 0
            ? "Free unlock"
            : money(paid) + " / " + money(cost);
    $("pad-fill").style.width =
      (fitted
        ? 100
        : locked !== null
          ? 0
          : cost === null
            ? 100
            : cost
              ? (paid / cost) * 100
              : 0) + "%";
    const dx = pad.x - sim.position.x,
      dy = pad.y - sim.position.y;
    $("pad-distance").textContent = onPad
      ? "ON PLATFORM"
      : Math.round(Math.hypot(dx, dy) / 30) +
        " m / " +
        (Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "EAST"
            : "WEST"
          : dy > 0
            ? "SOUTH"
            : "NORTH");
    $("pad-guide").classList.toggle("funding", onPad);
  }
  $("tip").textContent = sim.padCompleted
    ? "Upgrade fitted. Drive off and return for the next level."
    : sim.activePad
      ? "Brake to stay on the pad. Partial payments are saved."
      : sector > 0
        ? "Bring your haul south to the deposit."
        : p.collected[0] === 0
          ? "Drag toward the deposit, or hold W to push the first heap."
          : "Park on a glowing platform to build your next upgrade.";
  if (activity)
    $("tip").textContent =
      "Park to open " + activity.name + ". No coins are spent automatically.";
  else if (p.victory)
    $("tip").textContent = p.overtime.active
      ? "Fresh overtime gems are waiting. Bring your haul south to the deposit."
      : "Keep your machine. Accept a free overtime job from Pause or the office pad.";
}
function closePanel() {
  panelCleanup();
  panelCleanup = () => {};
  dialog.close();
  modal = null;
  paused = !started;
  keys.clear();
  touch.clear();
  drag.cancel();
  canvas.focus();
}
function openPanel(kind: NonNullable<typeof modal>) {
  if (!started) return;
  panelCleanup();
  panelCleanup = () => {};
  modal = kind;
  paused = true;
  keys.clear();
  touch.clear();
  drag.cancel();
  const header = (eyebrow: string, title: string, copy: string) =>
    `<div class="panel-top"><span class="eyebrow">${eyebrow}</span><button class="close" aria-label="Close panel">×</button></div><h2>${title}</h2><p class="panel-copy">${copy}</p>`;
  if (kind === "assay") {
    $("panel-content").innerHTML = header(
      "QUARRY COINS · OPTIONAL SIDE GAME",
      "Lucky Assay.",
      "Three crystals. A little luck. Choose your stake below.",
    );
    panelCleanup = mountAssayPanel(
      $("panel-content"),
      sim.progress,
      () => {
        save();
        updateHud();
      },
      (win) => (win ? audio.upgrade() : audio.coin()),
    );
  } else if (kind === "contracts") {
    const p = sim.progress,
      job = overtimeContract(p.overtime.completed);
    const active = p.overtime.active;
    $("panel-content").innerHTML =
      header(
        "OVERTIME OFFICE · KEEP WHAT YOU BUILT",
        !p.victory
          ? "Finish the first big job."
          : active
            ? "Your contract is underway."
            : "There's always another seam.",
        !p.victory
          ? "Clear all three sectors to unlock repeatable jobs with your current machine, upgrades and bank balance."
          : active
            ? "Your new haul is waiting in " +
              SECTORS[job.sector].name +
              ". Bring it south to the deposit."
            : p.overtime.completed +
              " overtime jobs completed. Accept a fresh delivery without resetting your quarry.",
      ) +
      (p.victory
        ? '<div class="overtime-ticket"><span>CONTRACT ' +
          job.number.toString().padStart(2, "0") +
          "</span><h3>" +
          SECTORS[job.sector].name +
          "</h3><p><b>" +
          job.count +
          " gems</b> · " +
          money(job.value + stats(p).gemBonus) +
          " each</p><p>Completion bonus <b>" +
          money(job.bonus) +
          "</b></p><small>" +
          (active
            ? p.overtime.collected + " / " + job.count + " delivered"
            : "FREE TO ACCEPT · NO UPGRADES LOST") +
          "</small></div>"
        : "") +
      (p.victory && !active
        ? '<button class="primary" id="start-overtime">Accept free contract →</button>'
        : "") +
      '<button class="text-button resume">Back to the quarry</button>';
  } else if (kind === "help") {
    $("panel-content").innerHTML =
      header(
        "OPERATOR’S MANUAL",
        "A good day’s work.",
        "The blade does the gathering. The deposit does the selling.",
      ) +
      `<div class="instructions"><p><b>01 / Sweep</b>W drives forward and S reverses without turning around. Left / right arrows steer; A / D also work. Space brakes.</p><p><b>02 / Deliver</b>Push gems onto the striped belt near the south end. Belts pull them into the dark hopper and pay you immediately.</p><p><b>03 / Grow</b>Park on a glowing platform to fund the rotating part above it. Money transfers gradually; partial funding is saved. Drive off and return for the next level. Find the key pads beside the gates. Find the magnet in Citrine Cut to gather stragglers, and the refinery in Amethyst Reach to increase every gem’s sale value. The vacuum pad in Amethyst fits a front suction hose and a rear storage bin. Its three tiers hold 40, 90 or 180 gems. Drive your rear chute over the striped conveyor or its feeder to unload; coins arrive when the belt sells the gems. Opening sectors also unlocks stronger engine, plow and conveyor tiers.</p><p><b>04 / Finish</b>Clear all ${TOTAL_GEMS.toLocaleString()} gems to unlock repeatable overtime contracts without losing your machine, or take a fully upgraded victory lap. Every sector awards a halfway bonus. Find Lucky Assay on the gold pad in Quartz Flats for an optional coin wager; the Overtime office is on the opposite side.</p></div><div class="shortcut-list">C · camera &nbsp; / &nbsp; Scroll · zoom &nbsp; / &nbsp; M · sound &nbsp; / &nbsp; Esc · pause</div><p class="panel-note">Progress saves on this browser. Drag on the quarry to drive toward your finger; drag farther for more speed. Pull behind the machine to reverse; the stick turns coral. Release to brake. Direction buttons also work.</p><button class="primary resume">Back to the quarry →</button>`;
  } else if (kind === "victory") {
    $("panel-content").innerHTML =
      header(
        `${TOTAL_GEMS.toLocaleString()} GEMS. ONE MIGHTY MACHINE.`,
        "You moved mountains.",
        `All three sectors cleared. ${money(sim.progress.earned)} earned. Time to enjoy what you built.`,
      ) +
      `<div class="victory-gem">◇</div><button class="primary" id="open-overtime">Keep building · overtime contracts →</button><p class="panel-note">New deliveries. Richer gems. Keep your machine, upgrades and funds.</p><button class="text-button" id="victory-lap">Take a victory lap →</button><p class="panel-note">A fresh quarry with every gate open and all equipment fully upgraded.</p><button class="text-button resume">Stay in my finished quarry</button>`;
  } else if (kind === "reset") {
    $("panel-content").innerHTML =
      header(
        "START FRESH",
        "A new shift?",
        "This clears this game’s saved quarry, coins, upgrades, Lucky Assay result and overtime history on this browser. You will start from zero.",
      ) +
      `<button class="primary" id="confirm-reset">Clear save & start again →</button><button class="text-button resume">Keep my progress</button>`;
  } else {
    $("panel-content").innerHTML =
      header(
        "TAKE A BREATHER",
        "Shift paused.",
        "Your machine and every gem will be right here.",
      ) +
      `<button class="primary resume">Back to work →</button><button class="text-button" id="open-manual">Operator’s manual</button><button class="text-button" id="open-overtime">Overtime contracts</button><button class="text-button" id="reset">Clear save & start again</button><p class="panel-note">${storageAvailable ? "Your progress is saved locally." : "Browser storage is unavailable. Keep this tab open to preserve your shift."}</p>`;
  }
  if (!dialog.open) dialog.showModal();
  dialog.querySelector(".close")?.addEventListener("click", closePanel);
  dialog
    .querySelectorAll(".resume")
    .forEach((b) => b.addEventListener("click", closePanel));
  $("reset")?.addEventListener("click", () => openPanel("reset"));
  $("confirm-reset")?.addEventListener("click", () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* newShift reports storage failures. */
    }
    newShift(false);
  });
  $("open-overtime")?.addEventListener("click", () => openPanel("contracts"));
  $("start-overtime")?.addEventListener("click", () => {
    const next = sim.startOvertime();
    if (!next) return;
    pendingPayout.value = 0;
    coins.clear();
    sim = next;
    view.sim = sim;
    closePanel();
    save();
    updateHud();
    audio.upgrade();
    toast(
      "Contract accepted. Fresh heaps in " +
        SECTORS[overtimeContract(sim.progress.overtime.completed).sector].name +
        ".",
    );
  });
  $("victory-lap")?.addEventListener("click", () => newShift(true));
  $("open-manual")?.addEventListener("click", () => openPanel("help"));
}
function newShift(sandbox: boolean) {
  pendingPayout.value = 0;
  coins.clear();
  sim = new Simulation();
  if (sandbox) {
    sim.progress.levels = {
      engine: 5,
      blade: 5,
      intake: 5,
      magnet: 5,
      refinery: 3,
      vacuum: 3,
    };
    sim.progress.sector = 3;
    sim.progress.sandbox = true;
    sim.rebuildDozer();
    sim.gateOpening = [1, 1];
    sim.rebuildGates();
  }
  view.sim = sim;
  closePanel();
  save();
  updateHud();
  toast(
    sandbox
      ? "Victory lap. The whole quarry is yours."
      : "A new shift. A fresh start.",
  );
}
function toggleSound() {
  audio.start();
  audio.muted = !audio.muted;
  $("sound").textContent = audio.muted ? "♪̸" : "♫";
  $("sound").setAttribute(
    "aria-label",
    audio.muted ? "Unmute sound" : "Mute sound",
  );
}
function toggleCamera() {
  view.cameraMode = view.cameraMode === "follow" ? "overview" : "follow";
  view.zoom = view.cameraMode === "overview" ? 0.55 : 1;
  view.resize();
}
$("start").addEventListener("click", () => {
  started = true;
  paused = false;
  $("welcome").hidden = true;
  app.classList.add("playing");
  audio.start();
  canvas.focus();
  if (saved && !restored)
    toast("The previous save could not be read. A fresh quarry is ready.");
  else if (saved && JSON.parse(saved).version === 1)
    toast(
      "Denser heaps are ready. Your funds, upgrades and clearance progress are kept.",
    );
  if (sim.progress.victory && !sim.progress.overtime.active)
    openPanel(sim.progress.overtime.completed ? "contracts" : "victory");
});
$("activity-open").addEventListener("click", () => {
  if (sim.activeActivity) openPanel(sim.activeActivity);
});
$("help").addEventListener("click", () => openPanel("help"));
$("pause").addEventListener("click", () => {
  if (modal) closePanel();
  else {
    save();
    openPanel("pause");
  }
});
$("sound").addEventListener("click", toggleSound);
$("camera").addEventListener("click", () => {
  if (view) toggleCamera();
});
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closePanel();
});
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) closePanel();
});
window.addEventListener("keydown", (e) => {
  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
      e.code,
    ) &&
    e.target === canvas
  )
    e.preventDefault();
  if (e.repeat) return;
  if (e.code === "Escape") {
    e.preventDefault();
    if (modal) closePanel();
    else {
      save();
      openPanel("pause");
    }
    return;
  }
  if (e.code === "KeyM") {
    toggleSound();
    return;
  }
  if (e.code === "KeyC" && view) {
    toggleCamera();
    return;
  }
  if (e.code === "Slash") {
    openPanel("help");
    return;
  }
  if (!paused && started) keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  touch.clear();
  drag.cancel();
  if (started && !modal) {
    save();
    openPanel("pause");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    touch.clear();
    drag.cancel();
    save();
    if (started && !modal) openPanel("pause");
  }
});
window.addEventListener("pagehide", () => {
  drag.cancel();
  save();
});
window.addEventListener("resize", () => {
  drag.cancel();
  view?.resize();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    view.zoom = Math.max(0.55, Math.min(1.7, view.zoom - e.deltaY * 0.001));
    view.resize();
  },
  { passive: false },
);
for (const button of document.querySelectorAll<HTMLButtonElement>(
  "[data-dir]",
)) {
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!started || paused) return;
    drag.cancel();
    button.setPointerCapture(e.pointerId);
    touch.add(button.dataset.dir!);
    button.classList.add("held");
  });
  const release = () => {
    touch.delete(button.dataset.dir!);
    button.classList.remove("held");
  };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.08);
  last = now;
  if (!paused) {
    accumulator = Math.min(accumulator + dt, 0.1);
    const down = (...codes: string[]) => codes.some((c) => keys.has(c));
    const keyboardInput = {
      steer:
        Number(down("KeyD", "ArrowRight") || touch.has("right")) -
        Number(down("KeyA", "ArrowLeft") || touch.has("left")),
      throttle:
        Number(down("KeyW", "ArrowUp") || touch.has("up")) -
        Number(down("KeyS", "ArrowDown") || touch.has("down")),
      brake: down("Space") || touch.has("brake"),
    };
    if (keyboardInput.throttle || keyboardInput.steer || keyboardInput.brake)
      drag.cancel();
    while (accumulator >= 1 / 60) {
      const input =
        drag.read(sim.dozer.angle, (x, y) =>
          view.headingFromScreenDrag(x, y),
        ) ?? keyboardInput;
      sim.update(input);
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
  coins.setPaused(paused);
  let collectedValue = 0,
    collectedX = 0,
    collectedY = 0;
  for (const event of sim.events.splice(0)) {
    if (event.type === "collect") {
      view.burst(event.x, event.y, event.color);
      collectedValue += event.value;
      collectedX = event.x;
      collectedY = event.y;
    }
    if (event.type === "fund") {
      const pad = PADS.find((p) => p.id === event.pad)!;
      coins.transfer(
        view.project(pad.x, pad.y + 65, 0.4),
        event.value,
        false,
        () => audio.payment(event.ratio),
      );
    }
    if (event.type === "notice") toast(event.text);
    if (event.type === "upgrade") {
      audio.upgrade();
      save();
      toast(
        event.kind === "gate"
          ? "Key unlocked. The gate is lowering."
          : "Upgrade fitted. Back to work.",
      );
    }
    if (event.type === "activity") openPanel(event.activity);
    if (event.type === "overtime-complete") {
      audio.upgrade();
      save();
      toast("Overtime complete · " + money(event.bonus) + " bonus.");
      openPanel("contracts");
    }
    if (event.type === "victory") {
      audio.upgrade();
      save();
      openPanel("victory");
    }
  }
  if (collectedValue > 0) {
    pendingPayout.value += collectedValue;
    pendingPayout.x = collectedX;
    pendingPayout.y = collectedY;
  }
  if (!paused && pendingPayout.value > 0 && now - lastPayout >= 120) {
    coins.transfer(
      view.project(pendingPayout.x, pendingPayout.y),
      pendingPayout.value,
      true,
      () => audio.coin(),
    );
    pendingPayout.value = 0;
    lastPayout = now;
  }
  audio.update(sim.dozer.speed, paused);
  view.render(paused ? 0 : dt, now / 1000);
  if (now - lastHud > 150) {
    updateHud();
    lastHud = now;
  }
  if (started && now - lastSave > 5000) {
    save();
    lastSave = now;
  }
  requestAnimationFrame(frame);
}
async function boot() {
  try {
    view = new QuarryView(canvas, sim);
    await view.load();
    await document.fonts.ready;
    $("loading").hidden = true;
    $("welcome").hidden = false;
    updateHud();
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    $("loading").innerHTML =
      '<strong>The quarry couldn’t open.</strong><span>Check that WebGL is enabled, then reload to try again.</span><button class="primary" onclick="location.reload()">Try again →</button>';
  }
}
void boot();
