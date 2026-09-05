type Point = { x: number; y: number };

/** Cosmetic, bounded batches: gem volume never creates one DOM node per gem. */
export class CoinEffects {
  private flights = new Map<Animation, HTMLElement>();
  private paused = false;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  constructor(
    private host: HTMLElement,
    private bank: HTMLElement,
  ) {}

  transfer(point: Point, value: number, deposit: boolean, arrive: () => void) {
    if (this.flights.size + 3 > 30) return;
    const bounds = this.bank.getBoundingClientRect();
    const bank = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
    const from = deposit ? point : bank,
      to = deposit ? bank : point;
    for (let i = 0; i < 3; i++) {
      const coin = document.createElement("span");
      coin.className = "flying-coin " + (deposit ? "deposit" : "payment");
      coin.setAttribute("aria-hidden", "true");
      coin.textContent = i === 0 ? (deposit ? "+$" : "−$") + value : "$";
      if (i === 0) coin.classList.add("amount");
      this.host.append(coin);
      const at = (x: number, y: number, scale: number) =>
        `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${scale})`;
      const reduced = this.reducedMotion.matches;
      const flight = coin.animate(
        [
          { transform: at(from.x, from.y, 0.65), opacity: 0 },
          {
            transform: at(
              reduced ? to.x : (from.x + to.x) / 2 + (i - 1) * 25,
              reduced ? to.y : Math.min(from.y, to.y) - 60,
              1,
            ),
            opacity: 1,
            offset: 0.5,
          },
          { transform: at(to.x, to.y, 0.65), opacity: 0 },
        ],
        {
          fill: "both",
          duration: reduced ? 160 : 620,
          delay: i * 35,
          easing: "cubic-bezier(.2,.55,.5,1)",
        },
      );
      this.flights.set(flight, coin);
      if (this.paused) flight.pause();
      flight.onfinish = () => {
        coin.remove();
        this.flights.delete(flight);
        if (i === 0) arrive();
      };
    }
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    for (const flight of this.flights.keys())
      paused ? flight.pause() : flight.play();
  }

  clear() {
    for (const [flight, coin] of this.flights) {
      flight.cancel();
      coin.remove();
    }
    this.flights.clear();
  }
}
