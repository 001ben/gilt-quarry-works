import * as THREE from "three";
import { createVacuum, hoseCurve } from "./vacuum-model";
import { stats, SECTORS } from "./progression";
import type { Simulation } from "./simulation";

export class VacuumView {
  model = new THREE.Group();
  private level = -1;
  private tip = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private flights = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.12),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0.2,
      emissive: 0x184239,
      emissiveIntensity: 0.3,
    }),
    32,
  );
  constructor(
    private machine: THREE.Group,
    scene: THREE.Scene,
  ) {
    machine.add(this.model);
    this.flights.frustumCulled = false;
    this.flights.count = 0;
    scene.add(this.flights);
  }
  render(sim: Simulation, dt: number, time: number) {
    const level = sim.progress.levels.vacuum;
    if (level !== this.level) {
      this.level = level;
      this.machine.remove(this.model);
      this.model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
          if (o instanceof THREE.InstancedMesh) o.dispose();
        }
      });
      this.model = createVacuum(Math.max(1, level));
      this.machine.add(this.model);
    }
    this.model.visible = level > 0;
    if (!level) {
      this.flights.count = 0;
      return;
    }
    const s = stats(sim.progress),
      v = sim.vacuum;
    this.tip += ((v.unloading ? 1 : 0) - this.tip) * (1 - Math.exp(-dt * 8));
    const hopper = this.model.getObjectByName("VacuumHopper")!;
    hopper.rotation.x = this.tip * 0.3;
    this.model.getObjectByName("VacuumDoor")!.rotation.y = -this.tip * 1.5;
    this.model.getObjectByName("VacuumDoorRight")!.rotation.y = this.tip * 1.5;
    this.model.getObjectByName("VacuumFan")!.rotation.z =
      time * (v.cargo.length < s.vacuumCapacity ? 18 : 2);
    const fill = this.model.getObjectByName(
      "VacuumFill",
    ) as THREE.InstancedMesh;
    const stored = v.cargo.filter(
      (g) => !v.flights.some((f) => f.gem.id === g.id),
    );
    fill.count = Math.min(
      96,
      Math.ceil((stored.length / s.vacuumCapacity) * 96),
    );
    for (let i = 0; i < fill.count; i++) {
      this.dummy.position.set(
        (((i % 6) - 2.5) * this.model.userData.width) / 6,
        0.15 + (Math.floor(i / 24) * this.model.userData.height) / 4,
        -0.99 + (Math.floor(i / 6) % 4) * 0.34,
      );
      this.dummy.rotation.set(i * 0.7, i * 0.4, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      fill.setMatrixAt(i, this.dummy.matrix);
      fill.setColorAt(
        i,
        this.color.setHex(SECTORS[stored[i % stored.length].sector].color),
      );
    }
    fill.instanceMatrix.needsUpdate = true;
    if (fill.instanceColor) fill.instanceColor.needsUpdate = true;
    this.machine.updateMatrixWorld(true);
    this.flights.count = Math.min(32, v.flights.length);
    for (let i = 0; i < this.flights.count; i++) {
      const f = v.flights[i],
        t = f.age / f.duration;
      let point: THREE.Vector3;
      if (f.kind === "intake") {
        if (t < 0.45) {
          const end = this.machine.localToWorld(hoseCurve.getPoint(0));
          point = new THREE.Vector3(f.from.x / 30, 0.13, f.from.y / 30).lerp(
            end,
            1 - (1 - t / 0.45) ** 2,
          );
          point.y += Math.sin((t / 0.45) * Math.PI) * 0.35;
        } else {
          const end = hoseCurve.getPoint(1);
          point =
            t < 0.85
              ? hoseCurve.getPoint((t - 0.45) / 0.4)
              : end.lerp(
                  new THREE.Vector3(
                    0.15,
                    1.85 + this.model.userData.height * 0.4,
                    2.1,
                  ),
                  (t - 0.85) / 0.15,
                );
          point = this.machine.localToWorld(point);
        }
      } else {
        point = new THREE.Vector3(
          f.from.x / 30,
          1.65 * s.scale * (1 - t * t),
          f.from.y / 30,
        );
        point.x += ((f.gem.id % 3) - 1) * 0.12 * Math.sin(t * Math.PI);
      }
      this.dummy.position.copy(point);
      this.dummy.rotation.set(t * 9, i + t * 6, t * 4);
      this.dummy.scale.setScalar(1.25);
      this.dummy.updateMatrix();
      this.flights.setMatrixAt(i, this.dummy.matrix);
      this.flights.setColorAt(
        i,
        this.color.setHex(SECTORS[f.gem.sector].color),
      );
    }
    this.flights.instanceMatrix.needsUpdate = true;
    if (this.flights.instanceColor)
      this.flights.instanceColor.needsUpdate = true;
  }
}
