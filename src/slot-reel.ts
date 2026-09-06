import { crystalArt } from "./crystal-art";
import { CRYSTALS } from "./assay";

/** Two copies of the four-symbol ring cover every wrap without replacing visible nodes. */
export class SlotReel {
  private strip: HTMLElement;
  private symbols: HTMLElement[];
  private position: number;
  private frame = 0;

  constructor(
    private root: HTMLElement,
    face: number,
  ) {
    root.innerHTML =
      '<div class="reel-window"><div class="reel-strip">' +
      Array.from({ length: 8 }, (_, i) => {
        const crystal = (i + 3) % 4;
        return (
          '<div class="reel-symbol" aria-hidden="true">' +
          crystalArt(crystal) +
          "<span>" +
          CRYSTALS[crystal] +
          "</span></div>"
        );
      }).join("") +
      "</div></div>";
    this.strip = root.querySelector<HTMLElement>(".reel-strip")!;
    this.symbols = [...root.querySelectorAll<HTMLElement>(".reel-symbol")];
    this.position = face;
    this.render(face, true);
  }

  spin(face: number, turns: number, duration: number, onStop: () => void) {
    this.cancel();
    const start = this.position;
    const distance = turns * 4 + ((face - start + 4) % 4);
    const began = performance.now();
    this.root.classList.add("turning");
    this.render(start, false);
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - began) / duration));
      // Smooth acceleration and braking, ending exactly on the chosen symbol.
      const eased = t * t * (3 - 2 * t);
      this.position = t === 1 ? face : (start + distance * eased) % 4;
      this.render(this.position, t === 1);
      if (t < 1) this.frame = requestAnimationFrame(tick);
      else {
        this.frame = 0;
        this.root.classList.remove("turning");
        onStop();
      }
    };
    this.frame = requestAnimationFrame(tick);
  }

  private render(phase: number, stopped: boolean) {
    // Percentage of the eight-symbol belt stays correct across mobile resizes.
    this.strip.style.transform = `translateY(${(-phase * 100) / 8}%)`;
    this.symbols.forEach((symbol, i) => {
      const distance = Math.abs(i - phase - 1);
      symbol.style.setProperty(
        "--reel-focus",
        String(Math.max(0, 1 - distance)),
      );
      const center = stopped && distance < 0.01;
      symbol.classList.toggle("reel-symbol-center", center);
      symbol.classList.toggle(
        "reel-neighbor",
        stopped && Math.abs(distance - 1) < 0.01,
      );
      symbol.setAttribute("aria-hidden", String(!center));
    });
    if (stopped) {
      this.root.dataset.crystal = String(phase);
      this.root.setAttribute(
        "aria-label",
        CRYSTALS[phase] + ", center payline",
      );
    }
  }

  cancel() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
