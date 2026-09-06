import type { Progress } from "./progression";

export const ASSAY_BETS = [10, 50, 100, 500] as const;
export const ASSAY_TRIPLE_RETURN = 6.8;
export const ASSAY_RTP_PERCENT = ((ASSAY_TRIPLE_RETURN * 4 + 36) / 64) * 100;
export const CRYSTALS = ["Quartz", "Citrine", "Amethyst", "Emerald"] as const;
export type AssayResult = NonNullable<Progress["lastAssay"]>;

export function assayPayout(bet: number, faces: readonly number[]) {
  const distinct = new Set(faces).size;
  return bet * (distinct === 1 ? ASSAY_TRIPLE_RETURN : distinct === 2 ? 1 : 0);
}
export function validAssay(value: unknown): value is AssayResult | null {
  if (value === null) return true;
  if (typeof value !== "object" || !value) return false;
  const r = value as AssayResult;
  return (
    ASSAY_BETS.some((bet) => bet === r.bet) &&
    Array.isArray(r.faces) &&
    r.faces.length === 3 &&
    r.faces.every((f) => Number.isInteger(f) && f >= 0 && f < 4) &&
    // Historical wins are already settled. Keep old 6x results without re-crediting them.
    (r.payout === assayPayout(r.bet, r.faces) ||
      (new Set(r.faces).size === 1 && r.payout === r.bet * 6))
  );
}
function randomFraction() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
/** Settle once, before any reveal animation. Only net wins increase lifetime earnings. */
export function playAssay(
  p: Progress,
  bet: number,
  random = randomFraction,
): AssayResult | null {
  if (!ASSAY_BETS.some((stake) => stake === bet) || p.money < bet) return null;
  const rolls = [random(), random(), random()];
  if (!rolls.every((n) => Number.isFinite(n) && n >= 0 && n < 1)) return null;
  const faces = rolls.map((n) => Math.floor(n * 4)) as AssayResult["faces"];
  const payout = assayPayout(bet, faces);
  p.money += payout - bet;
  p.earned += Math.max(0, payout - bet);
  p.lastAssay = { bet, faces, payout };
  return p.lastAssay;
}
