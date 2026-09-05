import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./style.css";
import { GameAudio } from "./audio";
import {
  gateCost,
  SECTORS,
  stats,
  TOTAL_GEMS,
  Upgrade,
  upgradeCost,
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
  <div class="sector-tag"><span class="diamond">◆</span><span id="mineral">QUARTZ</span><span id="gem-value">$12 / GEM</span></div>
  <section class="contract" id="contract">
    <div class="eyebrow"><span>YOUR FIRST CONTRACT</span><span id="contract-number">01—03</span></div>
    <h2 id="contract-title">Make room for more.</h2>
    <p id="contract-copy">Push quartz onto the striped deposit belt.</p>
    <div class="progress-line"><span id="collected">0 / 60 collected</span><span id="percent">0%</span></div>
    <div class="progress-track"><span id="progress-fill"></span></div>
    <div class="contract-footer"><span id="bonus">HALFWAY BONUS</span><strong id="bonus-value">+$120</strong></div>
  </section>
  <div class="bottom-center"><span class="direction-tip" id="tip">Hold W to push the first heap onto the deposit.</span><div class="key-guide"><kbd>W</kbd><kbd>S</kbd><span>forward / reverse</span><i></i><kbd>←</kbd><kbd>→</kbd><span>steer</span><i></i><kbd>SPACE</kbd><span>brake</span></div></div>
  <button id="workshop" class="workshop-button"><span class="workshop-icon">⚒</span><span><small>BUILD SOMETHING BIGGER</small><strong>Workshop <span>↗</span></strong></span><kbd>E</kbd></button>
  <div id="touch-controls" aria-label="Touch driving controls"><button data-dir="up" aria-label="Drive forward">↑</button><button data-dir="left" aria-label="Steer left">←</button><button data-dir="down" aria-label="Reverse">↓</button><button data-dir="right" aria-label="Steer right">→</button><button data-dir="brake" aria-label="Brake">■</button></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <div id="loading"><span class="loader"></span><strong>Opening the quarry</strong><span>Unloading your machine…</span></div>
  <div class="welcome" id="welcome" hidden><div class="eyebrow">A LITTLE MACHINE. A LOT OF POSSIBILITY.</div><h1>Your quarry.<br>Your rules.</h1><p>Push gems. Grow your machine.<br>Turn a quiet patch of dirt into an empire.</p><button class="primary" id="start">${restored ? "Continue your shift" : "Start your shift"} <span>→</span></button><small>W / S FORWARD & REVERSE · ← / → STEER</small></div>
  <dialog id="panel"><div id="panel-content"></div></dialog>
`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("world");
let view: QuarryView;
let started = false,
  paused = true,
  modal: "shop" | "help" | "pause" | "victory" | "reset" | null = null;
let keys = new Set<string>(),
  touch = new Set<string>();
let last = performance.now(),
  accumulator = 0,
  lastHud = 0,
  lastSave = 0,
  toastTimer = 0;
let pendingPayout = { value: 0, x: 0, y: 0 },
  lastPayout = 0;
const dialog = $<HTMLDialogElement>("panel");
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
  $("location").textContent = `0${sector + 1} / ${zone.name.toUpperCase()}`;
  $("mineral").textContent = zone.mineral.toUpperCase();
  $("gem-value").textContent = `$${zone.value} / GEM`;
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
        ? "Open the next sector in the workshop."
        : "Every gem counts. Finish the remaining sectors."
      : `Push ${zone.mineral.toLowerCase()} onto the striped deposit belt.`;
  $("collected").textContent = `${count} / ${zone.count} collected`;
  $("percent").textContent = `${Math.round((count / zone.count) * 100)}%`;
  $("progress-fill").style.width = `${(count / zone.count) * 100}%`;
  $("bonus").textContent = p.bonuses[sector]
    ? "CONTRACT BONUS EARNED"
    : "HALFWAY BONUS";
  $("bonus-value").textContent = `+$${zone.bonus}`;
  const affordable = (["engine", "blade", "intake"] as Upgrade[]).some((k) => {
    const cost = upgradeCost(p, k);
    return cost !== null && p.money >= cost;
  });
  $("workshop").classList.toggle("affordable", affordable);
  $("tip").textContent =
    p.collected.reduce((a, b) => a + b, 0) === 0
      ? "Hold W to push the first heap onto the deposit."
      : affordable
        ? "An upgrade is ready. Open the workshop with E."
        : sector > 0
          ? "Bring your haul south to the deposit."
          : p.sector > 1
            ? "Head north through the open gate for richer gems."
            : "Sweep wide, then bring your haul to the deposit.";
}
function closePanel() {
  dialog.close();
  modal = null;
  paused = !started;
  keys.clear();
  touch.clear();
  canvas.focus();
}
function openPanel(kind: NonNullable<typeof modal>) {
  if (!started) return;
  modal = kind;
  paused = true;
  keys.clear();
  touch.clear();
  const header = (eyebrow: string, title: string, copy: string) =>
    `<div class="panel-top"><span class="eyebrow">${eyebrow}</span><button class="close" aria-label="Close panel">×</button></div><h2>${title}</h2><p class="panel-copy">${copy}</p>`;
  if (kind === "shop") {
    const p = sim.progress;
    const descriptions: Record<
      Upgrade,
      { icon: string; name: string; copy: string; metric: string }
    > = {
      engine: {
        icon: "↗",
        name: "Engine & chassis",
        copy: "More pulling power. A bigger machine.",
        metric: `${stats(p).maxSpeed.toFixed(1)} → ${(stats(p).maxSpeed + 0.62).toFixed(1)} top speed`,
      },
      blade: {
        icon: "⊔",
        name: "Wide sweep blade",
        copy:
          p.levels.blade === 2
            ? "Add flared wings to keep your haul together."
            : "A wider bite with matching physical reach.",
        metric: `${stats(p).bladeWidth.toFixed(1)} m working width`,
      },
      intake: {
        icon: "⇥",
        name: "Collector conveyors",
        copy:
          p.levels.intake === 3
            ? "Add a forward conveyor to catch more gems."
            : "Longer belts carry gems into the hopper.",
        metric: `${(stats(p).intakeWidth / 30).toFixed(1)} m receiving span`,
      },
    };
    $("panel-content").innerHTML =
      header(
        "THE WORKSHOP",
        "Make it yours.",
        `Every upgrade earns its place. <strong class="shop-balance">${money(p.money)} available</strong>`,
      ) +
      `<div class="upgrade-list">${(["engine", "blade", "intake"] as Upgrade[])
        .map((k) => {
          const d = descriptions[k],
            cost = upgradeCost(p, k);
          return `<button class="upgrade" data-buy="${k}" ${cost === null || cost > p.money ? "disabled" : ""}><span class="upgrade-icon">${d.icon}</span><span class="upgrade-info"><span class="upgrade-name">${d.name}<small>LV ${p.levels[k]} / 5</small></span><span>${d.copy}</span><small class="metric">${cost === null ? "Fully upgraded" : d.metric}</small></span><strong>${cost === null ? "MAX" : money(cost)}<small>${cost === null ? "COMPLETE" : cost > p.money ? "SAVE UP" : "UPGRADE ↗"}</small></strong></button>`;
        })
        .join("")}</div>` +
      `<div class="gate-card"><span class="eyebrow">THE NEXT HORIZON</span><h3>${p.sector === 3 ? "The whole quarry is yours." : SECTORS[p.sector].name}</h3><p>${p.sector === 3 ? "Clear every sector to earn your victory lap." : `Richer ${SECTORS[p.sector].mineral.toLowerCase()} · $${SECTORS[p.sector].value} per gem. Opens free when you clear the current sector.`}</p><button class="primary" data-buy="gate" ${gateCost(p) === null || (gateCost(p) ?? Infinity) > p.money ? "disabled" : ""}>${gateCost(p) === null ? "ALL SECTORS OPEN" : `Open sector 0${p.sector + 1} <span>${money(gateCost(p)!)}</span>`}</button></div><small class="panel-note">Purchases are deliberate. Your shift pauses while you choose.</small>`;
  } else if (kind === "help") {
    $("panel-content").innerHTML =
      header(
        "OPERATOR’S MANUAL",
        "A good day’s work.",
        "The blade does the gathering. The deposit does the selling.",
      ) +
      `<div class="instructions"><p><b>01 / Sweep</b>W drives forward and S reverses without turning around. Left / right arrows steer; A / D also work. Space brakes.</p><p><b>02 / Deliver</b>Push gems onto the striped belt near the south end. Belts pull them into the dark hopper and pay you immediately.</p><p><b>03 / Grow</b>Press E for the workshop. Upgrade your engine, widen the blade, extend your conveyors, then open richer sectors.</p><p><b>04 / Finish</b>Clear all ${TOTAL_GEMS.toLocaleString()} gems to earn a fully upgraded victory lap. Every sector awards a halfway bonus.</p></div><div class="shortcut-list">C · camera &nbsp; / &nbsp; Scroll · zoom &nbsp; / &nbsp; M · sound &nbsp; / &nbsp; Esc · pause</div><p class="panel-note">Progress saves on this browser. On touch screens, use the directional pad.</p><button class="primary resume">Back to the quarry →</button>`;
  } else if (kind === "victory") {
    $("panel-content").innerHTML =
      header(
        `${TOTAL_GEMS.toLocaleString()} GEMS. ONE MIGHTY MACHINE.`,
        "You moved mountains.",
        `All three sectors cleared. ${money(sim.progress.earned)} earned. Time to enjoy what you built.`,
      ) +
      `<div class="victory-gem">◇</div><button class="primary" id="victory-lap">Take a victory lap →</button><p class="panel-note">A fresh quarry with every gate open and all equipment at level five.</p><button class="text-button resume">Stay in my finished quarry</button>`;
  } else if (kind === "reset") {
    $("panel-content").innerHTML =
      header(
        "START FRESH",
        "A new shift?",
        "This replaces your saved quarry, funds and upgrades on this browser.",
      ) +
      `<button class="primary" id="confirm-reset">Start a new quarry →</button><button class="text-button resume">Keep my progress</button>`;
  } else {
    $("panel-content").innerHTML =
      header(
        "TAKE A BREATHER",
        "Shift paused.",
        "Your machine and every gem will be right here.",
      ) +
      `<button class="primary resume">Back to work →</button><button class="text-button" id="open-manual">Operator’s manual</button><button class="text-button" id="reset">Start a new quarry</button><p class="panel-note">${storageAvailable ? "Your progress is saved locally." : "Browser storage is unavailable. Keep this tab open to preserve your shift."}</p>`;
  }
  if (!dialog.open) dialog.showModal();
  dialog.querySelector(".close")?.addEventListener("click", closePanel);
  dialog
    .querySelectorAll(".resume")
    .forEach((b) => b.addEventListener("click", closePanel));
  dialog.querySelectorAll<HTMLButtonElement>("[data-buy]").forEach((b) =>
    b.addEventListener("click", () => {
      const kind = b.dataset.buy as Upgrade | "gate";
      if (sim.purchase(kind)) {
        audio.upgrade();
        save();
        updateHud();
        openPanel("shop");
      }
    }),
  );
  $("reset")?.addEventListener("click", () => openPanel("reset"));
  $("confirm-reset")?.addEventListener("click", () => newShift(false));
  $("victory-lap")?.addEventListener("click", () => newShift(true));
  $("open-manual")?.addEventListener("click", () => openPanel("help"));
}
function newShift(sandbox: boolean) {
  pendingPayout.value = 0;
  sim = new Simulation();
  if (sandbox) {
    sim.progress.levels = { engine: 5, blade: 5, intake: 5 };
    sim.progress.sector = 3;
    sim.progress.sandbox = true;
    sim.rebuildDozer();
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
  if (sim.progress.victory) openPanel("victory");
});
$("workshop").addEventListener("click", () => openPanel("shop"));
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
  if (e.code === "KeyE") {
    if (modal === "shop") closePanel();
    else openPanel("shop");
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
  if (started && !modal) {
    save();
    openPanel("pause");
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    touch.clear();
    save();
    if (started && !modal) openPanel("pause");
  }
});
window.addEventListener("pagehide", save);
window.addEventListener("resize", () => view?.resize());
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
function coinEffect(x: number, y: number, value: number) {
  const pos = view.project(x, y),
    coin = document.createElement("span");
  coin.className = "flying-coin";
  coin.textContent = `+$${value}`;
  coin.style.left = pos.x + "px";
  coin.style.top = pos.y + "px";
  app.append(coin);
  const target = $("money").getBoundingClientRect();
  coin.animate(
    [
      { transform: "translate(-50%,0) scale(1)", opacity: 1 },
      {
        transform: "translate(-50%,-30px) scale(1.2)",
        opacity: 1,
        offset: 0.3,
      },
      {
        transform: `translate(${target.x - pos.x}px,${target.y - pos.y}px) scale(.5)`,
        opacity: 0,
      },
    ],
    { duration: 850, easing: "cubic-bezier(.2,.65,.4,1)" },
  ).onfinish = () => coin.remove();
}
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.08);
  last = now;
  if (!paused) {
    accumulator = Math.min(accumulator + dt, 0.1);
    const down = (...codes: string[]) => codes.some((c) => keys.has(c));
    const input = {
      steer:
        Number(down("KeyD", "ArrowRight") || touch.has("right")) -
        Number(down("KeyA", "ArrowLeft") || touch.has("left")),
      throttle:
        Number(down("KeyW", "ArrowUp") || touch.has("up")) -
        Number(down("KeyS", "ArrowDown") || touch.has("down")),
      brake: down("Space") || touch.has("brake"),
    };
    while (accumulator >= 1 / 60) {
      sim.update(input);
      accumulator -= 1 / 60;
    }
  } else accumulator = 0;
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
    if (event.type === "notice") toast(event.text);
    if (event.type === "upgrade")
      toast(
        event.kind === "gate"
          ? "The gate is open. Head north."
          : "Upgrade fitted. Back to work.",
      );
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
  if (pendingPayout.value > 0 && now - lastPayout >= 120) {
    coinEffect(pendingPayout.x, pendingPayout.y, pendingPayout.value);
    audio.coin();
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
