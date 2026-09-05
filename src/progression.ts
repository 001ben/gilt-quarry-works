export type Upgrade = "engine" | "blade" | "intake";
export interface Progress {
  money: number;
  earned: number;
  levels: Record<Upgrade, number>;
  sector: number;
  collected: number[];
  bonuses: boolean[];
  victory: boolean;
  sandbox: boolean;
}
export const SECTORS = [
  {
    name: "Quartz flats",
    mineral: "Quartz",
    count: 1800,
    value: 1,
    color: 0x6ed8cf,
    minY: -340,
    maxY: 115,
    bonus: 120,
  },
  {
    name: "Citrine cut",
    mineral: "Citrine",
    count: 2100,
    value: 2,
    color: 0xf3bd51,
    minY: -920,
    maxY: -500,
    bonus: 260,
  },
  {
    name: "Amethyst reach",
    mineral: "Amethyst",
    count: 2400,
    value: 4,
    color: 0xb099e9,
    minY: -1490,
    maxY: -1070,
    bonus: 500,
  },
] as const;
export const TOTAL_GEMS = SECTORS.reduce(
  (sum, sector) => sum + sector.count,
  0,
);
export const GATES = [-420, -990];
export function freshProgress(): Progress {
  return {
    money: 0,
    earned: 0,
    levels: { engine: 1, blade: 1, intake: 1 },
    sector: 1,
    collected: [0, 0, 0],
    bonuses: [false, false, false],
    victory: false,
    sandbox: false,
  };
}
export function upgradeCost(p: Progress, kind: Upgrade): number | null {
  return p.levels[kind] >= 5
    ? null
    : Math.round(
        { engine: 90, blade: 100, intake: 120 }[kind] *
          1.75 ** (p.levels[kind] - 1),
      );
}
export function gateCost(p: Progress): number | null {
  if (p.sector >= 3) return null;
  if (p.collected[p.sector - 1] === SECTORS[p.sector - 1].count) return 0;
  return p.sector === 1 ? 350 : 1100;
}
export function stats(p: Progress) {
  const scale = 1 + (p.levels.engine - 1) * 0.085;
  return {
    scale,
    bladeWidth: (3.3 + (p.levels.blade - 1) * 0.57) * scale,
    maxSpeed: 2.7 + (p.levels.engine - 1) * 0.62,
    acceleration: 0.1 + (p.levels.engine - 1) * 0.018,
    wings: p.levels.blade >= 3,
    intakeWidth: 90 + (p.levels.intake - 1) * 48,
    intakeDepth: 56 + (p.levels.intake - 1) * 10,
  };
}
