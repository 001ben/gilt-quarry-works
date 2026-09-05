export const ACTIVITY_PADS = [
  { id: "assay", name: "LUCKY ASSAY", x: 350, y: -235 },
  { id: "contracts", name: "OVERTIME", x: -350, y: -250 },
] as const;
export type Activity = (typeof ACTIVITY_PADS)[number]["id"];
export function activityAt(position: {
  x: number;
  y: number;
}): Activity | null {
  return (
    ACTIVITY_PADS.find(
      (p) => Math.abs(p.x - position.x) < 47 && Math.abs(p.y - position.y) < 47,
    )?.id ?? null
  );
}
