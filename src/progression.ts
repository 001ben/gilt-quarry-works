export type Upgrade =
  "engine" | "blade" | "intake" | "magnet" | "refinery" | "vacuum";
export const UPGRADE_MAX: Record<Upgrade, number> = {
  engine: 5,
  blade: 5,
  intake: 5,
  magnet: 5,
  refinery: 3,
  vacuum: 3,
};
export type PadId = Upgrade | "gate1" | "gate2";
export const PADS: { id: PadId; name: string; x: number; y: number }[] = [
  { id: "engine", name: "ENGINE", x: -350, y: 40 },
  { id: "blade", name: "PLOW", x: -350, y: -95 },
  { id: "intake", name: "CONVEYOR", x: 350, y: 40 },
  { id: "magnet", name: "MAGNET", x: 350, y: -535 },
  { id: "gate1", name: "CITRINE KEY", x: 335, y: -345 },
  { id: "gate2", name: "AMETHYST KEY", x: 335, y: -915 },
  { id: "vacuum", name: "VACUUM", x: 350, y: -1230 },
  { id: "refinery", name: "REFINERY", x: -350, y: -1090 },
];
export const emptyFunding = (): Record<PadId, number> => ({
  engine: 0,
  blade: 0,
  intake: 0,
  magnet: 0,
  refinery: 0,
  vacuum: 0,
  gate1: 0,
  gate2: 0,
});
export interface Progress {
  lastAssay: {
    bet: number;
    faces: [number, number, number];
    payout: number;
  } | null;
  overtime: { completed: number; active: boolean; collected: number };
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
    lastAssay: null,
    overtime: { completed: 0, active: false, collected: 0 },
    money: 0,
    earned: 0,
    levels: {
      engine: 1,
      blade: 1,
      intake: 1,
      magnet: 0,
      refinery: 0,
      vacuum: 0,
    },
    funding: emptyFunding(),
    sector: 1,
    collected: [0, 0, 0],
    bonuses: [false, false, false],
    victory: false,
    sandbox: false,
  };
}
export function upgradeCost(p: Progress, kind: Upgrade): number | null {
  if (kind === "vacuum") return [700, 1400, 2800][p.levels.vacuum] ?? null;
  if (kind === "refinery") return [450, 900, 1800][p.levels.refinery] ?? null;
  return p.levels[kind] >= UPGRADE_MAX[kind]
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
    gemBonus: p.levels.refinery,
    vacuumCapacity: [0, 40, 90, 180][p.levels.vacuum],
  };
}
export function padCost(p: Progress, id: PadId): number | null {
  if (padLockedSector(p, id) !== null) return null;
  if (id === "gate1" || id === "gate2") {
    return p.sector === (id === "gate1" ? 1 : 2) ? gateCost(p) : null;
  }
  return upgradeCost(p, id);
}
export function padLockedSector(p: Progress, id: PadId): number | null {
  if (id !== "gate1" && id !== "gate2" && p.levels[id] >= UPGRADE_MAX[id])
    return null;
  let required: number;
  if (id === "gate1") required = 1;
  else if (id === "gate2") required = 2;
  else if (id === "refinery" || id === "vacuum") required = 3;
  else {
    const next = p.levels[id] + 1;
    required =
      id === "magnet"
        ? next <= 3
          ? 2
          : 3
        : next <= 3
          ? 1
          : next === 4
            ? 2
            : 3;
  }
  return p.sector < required ? required : null;
}
export function gatePadFinished(p: Progress, id: PadId) {
  return (id === "gate1" && p.sector > 1) || (id === "gate2" && p.sector > 2);
}
export function padDetail(p: Progress, id: PadId, installed = false): string {
  if (id === "gate1" || id === "gate2")
    return "Open richer ground · free after clearing the sector";
  const next = structuredClone(p);
  next.levels[id] = Math.min(
    UPGRADE_MAX[id],
    next.levels[id] + (installed ? 0 : 1),
  );
  const s = stats(next);
  return {
    engine: `Level ${next.levels.engine} · more power & a larger chassis`,
    blade: `${s.bladeWidth.toFixed(1)} m plow${s.wings ? " with retaining wings" : " working width"}`,
    intake: `${(s.intakeWidth / 30).toFixed(0)} m belt · ${(s.feederLength / 30).toFixed(0)} m feeder`,
    magnet: `Level ${next.levels.magnet} · ${(s.magnetRange / 30).toFixed(1)} m magnetic reach`,
    vacuum:
      "Level " +
      next.levels.vacuum +
      " · " +
      s.vacuumCapacity +
      " gems · rear belt unload",
    refinery: `Level ${next.levels.refinery} · +$${s.gemBonus} for every gem sold`,
  }[id];
}
