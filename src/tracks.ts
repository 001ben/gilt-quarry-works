export const TRACK_RADIUS = 0.44;
export const TRACK_LENGTH = 4 + 2 * Math.PI * TRACK_RADIUS;
export const TRACK_LINK_COUNT = 40;

/** Arc-length sampling keeps shoe spacing and ground travel uniform around both sprockets. */
export function sampleTrack(distance: number) {
  let s = ((distance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  if (s < 2) return { y: 0.5 + TRACK_RADIUS, z: -1 + s, angle: 0 };
  s -= 2;
  if (s < Math.PI * TRACK_RADIUS) {
    const angle = s / TRACK_RADIUS;
    return {
      y: 0.5 + TRACK_RADIUS * Math.cos(angle),
      z: 1 + TRACK_RADIUS * Math.sin(angle),
      angle,
    };
  }
  s -= Math.PI * TRACK_RADIUS;
  if (s < 2) return { y: 0.5 - TRACK_RADIUS, z: 1 - s, angle: Math.PI };
  const angle = Math.PI + (s - 2) / TRACK_RADIUS;
  return {
    y: 0.5 + TRACK_RADIUS * Math.cos(angle),
    z: -1 + TRACK_RADIUS * Math.sin(angle),
    angle,
  };
}
