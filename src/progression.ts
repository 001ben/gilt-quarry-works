export type Upgrade = "engine" | "blade" | "intake" | "magnet";
export type PadId = Upgrade | "gate1" | "gate2";
export const PADS: { id: PadId; name: string; x: number; y: number }[] = [
  { id: "engine", name: "ENGINE", x: -350, y: 40 },
  { id: "blade", name: "PLOW", x: -350, y: -250 },
  { id: "intake", name: "CONVEYOR", x: 350, y: 40 },
  { id: "magnet", name: "MAGNET", x: 350, y: -250 },
  { id: "gate1", name: "CITRINE KEY", x: 0, y: -345 },
  { id: "gate2", name: "AMETHYST KEY", x: 0, y: -915 },
];
export const emptyFunding = (): Record<PadId, number> => ({
  engine: 0,
  blade: 0,
  intake: 0,
  magnet: 0,
  gate1: 0,
  gate2: 0,
});
export interface Progress {
  money: number;
  earned: number;
  levels: Record<Upgrade, number>;
  funding: Record<PadId, number>;
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
    levels: { engine: 1, blade: 1, intake: 1, magnet: 0 },
    funding: emptyFunding(),
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
        { engine: 90, blade: 100, intake: 120, magnet: 85 }[kind] *
          1.75 ** (p.levels[kind] - (kind === "magnet" ? 0 : 1)),
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
    intakeWidth: [90, 240, 420, 630, 840][p.levels.intake - 1],
    intakeDepth: 56 + (p.levels.intake - 1) * 10,
    feederLength: Math.max(0, p.levels.intake - 2) * 110,
    magnetRange: p.levels.magnet ? 55 + p.levels.magnet * 24 : 0,
    magnetStrength: p.levels.magnet * 0.045,
  };
}
export function padCost(p: Progress, id: PadId): number | null {
  if (id === "gate1" || id === "gate2") {
    return p.sector === (id === "gate1" ? 1 : 2) ? gateCost(p) : null;
  }
  return upgradeCost(p, id);
}
export function padDetail(p: Progress, id: PadId): string {
  if (id === "gate1" || id === "gate2")
    return "Open richer ground · free after clearing the sector";
  const next = structuredClone(p);
  next.levels[id] = Math.min(5, next.levels[id] + 1);
  const s = stats(next);
  return {
    engine: `Level ${next.levels.engine} · more power & a larger chassis`,
    blade: `${s.bladeWidth.toFixed(1)} m plow${s.wings ? " with retaining wings" : " working width"}`,
    intake: `${(s.intakeWidth / 30).toFixed(0)} m belt · ${(s.feederLength / 30).toFixed(0)} m feeder`,
    magnet: `Level ${next.levels.magnet} · ${(s.magnetRange / 30).toFixed(1)} m magnetic reach`,
  }[id];
}
