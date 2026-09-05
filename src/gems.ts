import { SECTORS } from "./progression";

export interface GemSeed {
  id: number;
  sector: number;
  radius: number;
  value: number;
  x: number;
  y: number;
  angle: number;
}

/** Close-packed individual stones, arranged in heaps rather than random scatter. */
export function generateGemLayout(): GemSeed[] {
  let seed = 7159;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const slots: { x: number; y: number; order: number }[] = [];
  for (let row = -20; row <= 20; row++) {
    for (let col = -20; col <= 20; col++) {
      const x = (col + (row % 2) * 0.5) * 8.2;
      const y = row * 7.15;
      slots.push({ x, y, order: x * x + y * y * 1.15 });
    }
  }
  slots.sort((a, b) => a.order - b.order);
  const result: GemSeed[] = [];
  for (const [sector, zone] of SECTORS.entries()) {
    const middle = (zone.minY + zone.maxY) / 2;
    const centers = [
      { x: -230, y: middle + 80 },
      { x: 215, y: middle + 95 },
      { x: -100, y: middle - 110 },
      { x: 165, y: middle - 125 },
    ];
    const starterCount = sector === 0 ? 180 : 0;
    for (let i = 0; i < zone.count; i++) {
      let x: number, y: number;
      if (i < starterCount) {
        x = ((i % 12) - 5.5) * 8.2;
        y = 112 + Math.floor(i / 12) * 7.15;
      } else {
        const index = i - starterCount,
          center = centers[index % 4];
        const slot = slots[Math.floor(index / 4)];
        x = center.x + slot.x;
        y = center.y + slot.y;
      }
      result.push({
        id: result.length,
        sector,
        x: x + (random() - 0.5) * 0.25,
        y: y + (random() - 0.5) * 0.25,
        radius: 3.1 + random() * 0.6,
        angle: random() * Math.PI,
        value: zone.value,
      });
    }
  }
  return result;
}
