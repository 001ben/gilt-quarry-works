import { SECTORS } from "./progression";
import type { GemSeed } from "./gems";

export function overtimeContract(completed: number) {
  const sector = completed % SECTORS.length;
  return {
    number: completed + 1,
    sector,
    count: 600 + Math.min(completed, 5) * 60,
    value: SECTORS[sector].value + 2 + Math.min(completed, 10),
    bonus: 250 + Math.min(completed, 10) * 100,
  };
}
/** Reuse the cleared sector's render slots; every new job has at most 900 bodies. */
export function generateOvertimeLayout(completed: number): GemSeed[] {
  const job = overtimeContract(completed),
    zone = SECTORS[job.sector];
  const offset = SECTORS.slice(0, job.sector).reduce((n, s) => n + s.count, 0);
  return Array.from({ length: job.count }, (_, i) => {
    const heap = i % 3,
      slot = Math.floor(i / 3),
      row = Math.floor(slot / 20);
    return {
      id: offset + i,
      sector: job.sector,
      radius: 3.3 + (i % 3) * 0.1,
      value: job.value,
      x: (heap - 1) * 205 + ((slot % 20) - 9.5 + (row % 2) * 0.5) * 8.2,
      y:
        (zone.minY + zone.maxY) / 2 +
        (((heap + completed) % 3) - 1) * 65 +
        (row - 7) * 7.15,
      angle: (i * 0.73 + completed) % Math.PI,
    };
  });
}
