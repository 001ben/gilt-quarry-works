import * as THREE from "three";

export const hoseCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0.65, -4.1),
  new THREE.Vector3(1.5, 1.2, -3.5),
  new THREE.Vector3(1.7, 2.8, -1),
  new THREE.Vector3(1.1, 3.5, 0.8),
  new THREE.Vector3(0.4, 3.35, 1.7),
]);
/** Editable, dimensioned attachment. Hopper pivots and rear door are independent parts. */
export function createVacuum(level: number) {
  const root = new THREE.Group();
  root.name = "Vacuum";
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe9b94f,
    metalness: 0.35,
    roughness: 0.4,
  });
  const pine = new THREE.MeshStandardMaterial({
    color: 0x304f43,
    metalness: 0.3,
    roughness: 0.45,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0xd1dfd7,
    metalness: 0.7,
    roughness: 0.3,
  });
  const box = (
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat = gold,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box(root, 0, 0.5, -4.1, 1.9, 0.45, 0.45);
  box(root, 0, 0.49, -4.34, 1.55, 0.25, 0.025, pine);
  for (const x of [-0.65, -0.32, 0, 0.32, 0.65])
    box(root, x, 0.49, -4.36, 0.035, 0.24, 0.04, steel);
  box(root, 0, 1.35, 1.2, 1.6, 0.22, 1.9, pine);
  box(root, 0, 1.3, 2.2, 1.6, 0.22, 1.8, pine);
  const width = 1.45 + (level - 1) * 0.28,
    height = 0.7 + (level - 1) * 0.34;
  const hopper = new THREE.Group();
  hopper.name = "VacuumHopper";
  hopper.position.set(0, 1.6, 2.7);
  root.add(hopper);
  box(hopper, 0, 0, -0.45, width, 0.12, 1.55, steel);
  box(hopper, 0, height / 2, -1.2, width, height, 0.12);
  for (const side of [-1, 1]) {
    box(hopper, (side * width) / 2, height / 2, -0.45, 0.1, height, 1.6);
    box(hopper, (side * width) / 2, height, -0.45, 0.16, 0.12, 1.7, pine);
    box(
      hopper,
      side * (width / 2 + 0.055),
      height * 0.48,
      -0.45,
      0.025,
      0.15,
      1.25,
      pine,
    );
  }
  for (const side of [-1, 1]) {
    const door = new THREE.Group();
    door.name = side === -1 ? "VacuumDoor" : "VacuumDoorRight";
    door.position.set((side * width) / 2, 0, 0.32);
    hopper.add(door);
    box(door, (-side * width) / 4, height / 2, 0, width / 2, height, 0.12);
    box(
      door,
      (-side * width) / 4,
      height * 0.45,
      0.08,
      width * 0.35,
      0.15,
      0.035,
      pine,
    );
  }
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve, 32, 0.19, 8, false),
    new THREE.MeshStandardMaterial({
      color: 0x98d8cf,
      transparent: true,
      opacity: 0.65,
      roughness: 0.25,
      depthWrite: false,
    }),
  );
  root.add(hose);
  const rings = new THREE.InstancedMesh(
    new THREE.TorusGeometry(0.2, 0.035, 5, 12),
    pine,
    25,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 25; i++) {
    const t = i / 24;
    dummy.position.copy(hoseCurve.getPoint(t));
    dummy.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      hoseCurve.getTangent(t),
    );
    dummy.updateMatrix();
    rings.setMatrixAt(i, dummy.matrix);
  }
  root.add(rings);
  const fan = new THREE.Group();
  fan.name = "VacuumFan";
  fan.position.set(-0.75, 1.85, 0.7);
  root.add(fan);
  for (let i = 0; i < 4; i++) {
    const blade = box(fan, 0, 0, 0, 0.55, 0.1, 0.08, steel);
    blade.rotation.z = (i * Math.PI) / 4;
  }
  const ore = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.25,
    }),
    96,
  );
  ore.name = "VacuumFill";
  ore.count = 0;
  ore.frustumCulled = false;
  hopper.add(ore);
  root.userData.width = width;
  root.userData.height = height;
  return root;
}
