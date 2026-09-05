/** Faceted, resolution-independent reel art in the quarry's mineral palette. */
export function crystalArt(face: number) {
  const colors = [
    ["#b5fff3", "#3fbdad", "#15736e"],
    ["#fff1a4", "#f0b33b", "#af671f"],
    ["#eddbff", "#a583e0", "#674695"],
    ["#c9ffb6", "#6fca7a", "#237a59"],
  ][face];
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="reel-crystal"><ellipse cx="50" cy="86" rx="25" ry="5" fill="#142c31" opacity=".14"/><path d="M50 8 80 28 87 58 50 85 13 58 20 28Z" fill="${colors[1]}" stroke="${colors[2]}" stroke-width="1.5"/><path d="M50 8 63 35 80 28ZM20 28 37 35 50 8ZM13 58 37 35 32 65ZM63 35 87 58 68 65Z" fill="${colors[0]}"/><path d="M37 35 63 35 68 65 32 65Z" fill="${colors[1]}"/><path d="M32 65 68 65 50 85ZM63 35 80 28 87 58Z" fill="${colors[2]}"/><path d="M50 8 37 35 63 35Z" fill="white" opacity=".65"/><path d="M23 34 26 40 33 43 26 46 23 53 20 46 13 43 20 40Z" fill="white" opacity=".9"/></svg>`;
}
