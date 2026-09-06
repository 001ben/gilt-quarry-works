import { crystalArt } from "./crystal-art";
import { ASSAY_BETS, CRYSTALS, playAssay, type AssayResult } from "./assay";
import type { Progress } from "./progression";

/** The panel owns reveal timers; the domain owns the already-settled wager. */
export function mountAssayPanel(
  root: HTMLElement,
  p: Progress,
  onSettled: () => void,
  sound: (win: boolean) => void,
) {
  const area = document.createElement("section");
  area.className = "assay-game";
  const symbol = (face: number, center = false) =>
    '<div class="reel-symbol' +
    (center ? " reel-symbol-center" : "") +
    '">' +
    crystalArt(face) +
    "<span>" +
    CRYSTALS[face] +
    "</span></div>";
  const restingReel = (face: number) =>
    '<div class="reel-window"><div class="reel-neighbor" aria-hidden="true">' +
    symbol((face + 3) % 4) +
    "</div>" +
    symbol(face, true) +
    '<div class="reel-neighbor" aria-hidden="true">' +
    symbol((face + 1) % 4) +
    "</div></div>";
  const initialReels = [0, 1, 2]
    .map(
      (face) =>
        '<div class="assay-reel" data-crystal="' +
        face +
        '" aria-label="' +
        CRYSTALS[face] +
        ', center payline">' +
        restingReel(face) +
        "</div>",
    )
    .join("");
  const celebration = Array.from(
    { length: 8 },
    (_, i) => '<i style="--coin:' + i + '">✦</i>',
  ).join("");
  area.innerHTML = `<div class="assay-machine" aria-label="Three crystal reels"><div class="assay-marquee"><span>◇ LUCKY ASSAY ◇</span><strong>TRIPLE CRYSTALS · 6× RETURN</strong></div><div class="assay-reels">${initialReels}</div><div class="assay-line-label">CENTER LINE PAYS</div><div class="assay-lights">● ● ● ● ● ● ● ● ●</div><div class="assay-celebration" aria-hidden="true">${celebration}</div></div>
    <div class="assay-bank">QUARRY COINS <strong id="assay-balance"></strong></div>
    <div class="assay-bets" role="group" aria-label="Choose your stake">${ASSAY_BETS.map((bet) => `<button data-bet="${bet}" aria-pressed="false">$${bet}</button>`).join("")}</div>
    <button class="primary" id="assay-spin"></button>
    <p id="assay-result" role="status" aria-live="polite"></p>
    <div class="assay-odds"><b>EVERY SPIN · SAME ODDS</b><p><span>Three matching crystals</span><strong>6× · 6.25%</strong></p><p><span>Exactly one pair</span><strong>Stake back · 56.25%</strong></p><p><span>Three different crystals</span><strong>$0 · 37.5%</strong></p></div>
    <p class="panel-note">Payouts include your stake. Four equally likely crystals per reel. Average return: 93.75% of stakes over many plays. Quarry coins only; no purchases or cash-out.</p>`;
  root.append(area);
  const spin = area.querySelector<HTMLButtonElement>("#assay-spin")!;
  const result = area.querySelector<HTMLElement>("#assay-result")!;
  const buttons = [...area.querySelectorAll<HTMLButtonElement>("[data-bet]")];
  const reels = [...area.querySelectorAll<HTMLElement>(".assay-reel")];
  let bet: number = 10,
    busy = false,
    balanceDuringSpin = 0;
  const timers: number[] = [];
  const animations: Animation[] = [];
  const refresh = () => {
    area.querySelector("#assay-balance")!.textContent =
      "$" + (busy ? balanceDuringSpin : p.money).toLocaleString("en-US");
    for (const b of buttons) {
      b.disabled = busy || Number(b.dataset.bet) > p.money;
      b.setAttribute("aria-pressed", String(Number(b.dataset.bet) === bet));
    }
    spin.disabled = busy || bet > p.money;
    spin.textContent = busy
      ? "Crystals turning…"
      : bet > p.money
        ? "Collect more gems to play"
        : `Bet $${bet} & spin →`;
  };
  const showFace = (r: AssayResult, i: number) => {
    const face = r.faces[i];
    reels[i].classList.remove("turning");
    reels[i].dataset.crystal = String(face);
    reels[i].innerHTML = restingReel(face);
    reels[i].setAttribute("aria-label", CRYSTALS[face] + ", center payline");
  };
  const highlightMatches = (r: AssayResult) => {
    const matching = r.faces.map(
      (face) => r.faces.filter((other) => other === face).length > 1,
    );
    reels.forEach((reel, i) =>
      reel.classList.toggle("reel-match", matching[i]),
    );
    area.classList.toggle("assay-match", matching.some(Boolean));
    area.classList.toggle("assay-win", r.payout > r.bet);
    area.querySelector(".assay-line-label")!.textContent =
      r.payout > r.bet
        ? "TRIPLE MATCH · 6× RETURN"
        : r.payout
          ? "PAIR MATCH · STAKE BACK"
          : "CENTER LINE · NO MATCH";
  };
  const describe = (r: AssayResult) =>
    r.payout > r.bet
      ? `Triple! $${r.payout} returned · +$${r.payout - r.bet} net win.`
      : r.payout
        ? `A pair. Your $${r.bet} stake is returned.`
        : `No match. $${r.bet} spent; $0 returned.`;
  if (p.lastAssay) {
    reels.forEach((_, i) => showFace(p.lastAssay!, i));
    result.textContent = "Last spin: " + describe(p.lastAssay);
    highlightMatches(p.lastAssay);
  } else result.textContent = "Choose a stake. Every spin is your call.";
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      if (busy) return;
      bet = Number(b.dataset.bet);
      refresh();
    }),
  );
  spin.addEventListener("click", () => {
    if (busy) return;
    balanceDuringSpin = p.money - bet;
    const settled = playAssay(p, bet);
    if (!settled) return;
    busy = true;
    onSettled();
    refresh();
    result.textContent = "Revealing your crystals…";
    area.classList.remove("assay-win", "assay-match");
    area.querySelector(".assay-line-label")!.textContent = "CENTER LINE PAYS";
    reels.forEach((reel, i) => {
      reel.classList.remove("reel-match");
      reel.classList.add("turning");
      const startFace = Number(reel.dataset.crystal);
      const sequence = Array.from(
        { length: 16 + i * 4 },
        (_, j) => (startFace + 3 + j) % 4,
      );
      sequence.push(
        (settled.faces[i] + 3) % 4,
        settled.faces[i],
        (settled.faces[i] + 1) % 4,
      );
      reel.innerHTML =
        '<div class="reel-window"><div class="reel-strip">' +
        sequence.map((face) => symbol(face)).join("") +
        "</div></div>";
      const strip = reel.querySelector<HTMLElement>(".reel-strip")!;
      const height = reel
        .querySelector<HTMLElement>(".reel-symbol")!
        .getBoundingClientRect().height;
      const duration = matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 100
        : 1100 + i * 350;
      animations.push(
        strip.animate(
          [
            { transform: "translateY(0)" },
            {
              transform:
                "translateY(-" + (sequence.length - 3) * height + "px)",
            },
          ],
          { duration, easing: "cubic-bezier(.12,.7,.12,1)", fill: "forwards" },
        ),
      );
      timers.push(
        window.setTimeout(() => {
          showFace(settled, i);
          sound(false);
          if (i === 2) {
            busy = false;
            timers.length = 0;
            animations.forEach((a) => a.cancel());
            animations.length = 0;
            result.textContent = describe(settled);
            highlightMatches(settled);
            if (settled.payout > settled.bet) sound(true);
            refresh();
          }
        }, duration),
      );
    });
  });
  refresh();
  return () => {
    timers.forEach(clearTimeout);
    animations.forEach((a) => a.cancel());
  };
}
