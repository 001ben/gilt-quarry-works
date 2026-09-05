import * as THREE from "three";

const paint = (color: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25 });
function block(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function createMagnet() {
  const group = new THREE.Group();
  group.name = "Magnet";
  block(group, 0, 1.55, -0.9, 0.65, 0.45, 0.7, 0x304f43);
  const arm = block(group, 0, 1.85, -2.15, 0.18, 0.2, 2.9, 0xf4ba49);
  arm.rotation.x = -0.13;
  block(group, 0, 1.4, -3.5, 0.12, 0.85, 0.12, 0xdee6d8);
  block(group, 0, 0.96, -3.5, 1.2, 0.3, 0.35, 0xc85543);
  for (const x of [-0.45, 0.45]) {
    block(group, x, 0.76, -3.5, 0.3, 0.42, 0.35, 0xc85543);
    block(group, x, 0.49, -3.5, 0.3, 0.16, 0.35, 0xeaf9ef);
  }
  return group;
}
export function createConveyor(width: number, depth: number, feeder: number) {
  const group = new THREE.Group();
  const slats: THREE.InstancedMesh[] = [];
  const section = (
    length: number,
    breadth: number,
    axis: "x" | "z",
    side: number,
  ) => {
    const part = new THREE.Group();
    if (axis === "x") part.position.x = (side * length) / 2;
    else part.position.z = -length / 2;
    block(
      part,
      0,
      0.025,
      0,
      axis === "x" ? length : breadth + 0.2,
      0.05,
      axis === "x" ? breadth + 0.2 : length,
      0xf4ba49,
    );
    block(
      part,
      0,
      0.075,
      0,
      axis === "x" ? length : breadth,
      0.05,
      axis === "x" ? breadth : length,
      0x273b35,
    );
    const count = Math.ceil(length / 0.36);
    const slat = new THREE.InstancedMesh(
      new THREE.BoxGeometry(
        axis === "x" ? 0.065 : breadth - 0.12,
        0.025,
        axis === "x" ? breadth - 0.12 : 0.065,
      ),
      paint(0xffffff),
      count,
    );
    slat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    slat.receiveShadow = true;
    slat.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      slat.setColorAt(i, new THREE.Color(i % 4 === 0 ? 0xe3c274 : 0x84988b));
    }
    slat.userData = { axis, length, direction: axis === "x" ? -side : 1 };
    part.add(slat);
    slats.push(slat);
    group.add(part);
  };
  for (const side of [-1, 1]) section(width / 2, depth, "x", side);
  if (feeder > 0) section(feeder, 1.8, "z", 1);
  block(group, 0, 0.16, 0, 2.25, 0.1, 1.5, 0x172c29);
  for (const x of [-1.17, 1.17])
    block(group, x, 0.27, 0, 0.15, 0.3, 1.75, 0xf4e7c9);
  block(group, 0, 0.3, 0.88, 2.5, 0.4, 0.16, 0x304f43);
  animateConveyor(slats, 0);
  return { group, slats };
}
const slatMatrix = new THREE.Matrix4();
export function animateConveyor(slats: THREE.InstancedMesh[], time: number) {
  for (const slat of slats) {
    const { axis, length, direction } = slat.userData;
    for (let i = 0; i < slat.count; i++) {
      const offset = (i * length) / slat.count;
      const position =
        ((((offset + time * 1.5 * direction) % length) + length) % length) -
        length / 2;
      slatMatrix.makeTranslation(
        axis === "x" ? position : 0,
        0.115,
        axis === "z" ? position : 0,
      );
      slat.setMatrixAt(i, slatMatrix);
    }
    slat.instanceMatrix.needsUpdate = true;
  }
}
export function createKey() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.35, 0.1, 8, 24),
    paint(0xe16052),
  );
  ring.position.y = 0.45;
  group.add(ring);
  block(group, 0, -0.2, 0, 0.17, 0.8, 0.18, 0xe16052);
  block(group, 0.17, -0.5, 0, 0.35, 0.14, 0.18, 0xe16052);
  block(group, 0.17, -0.28, 0, 0.35, 0.14, 0.18, 0xe16052);
  return group;
}

export function createRefinery(level = 1) {
  const group = new THREE.Group();
  group.name = "Refinery";
  block(group, 0, 0.25, 0, 2.7, 0.5, 1.25, 0x304f43);
  block(group, 0, 0.95, -0.45, 2.7, 1.3, 0.16, 0xf4ba49);
  block(group, 0, 1.65, -0.4, 2.95, 0.12, 0.45, 0xf4e7c9);
  for (let i = 0; i < level; i++) {
    const roller = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.75, 12),
      paint(0xa7d4cb),
    );
    roller.name = "PolishingDrum";
    roller.rotation.x = Math.PI / 2;
    roller.position.set((i - (level - 1) / 2) * 0.8, 1, 0);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.7, 0.025),
      paint(0xffd470),
    );
    band.position.z = 0.282;
    roller.add(band);
    group.add(roller);
  }
  return group;
}
