import * as THREE from "three";
import { PADS, padCost, stats, Upgrade } from "./progression";
import { Simulation, UNIT } from "./simulation";
import { createConveyor, createKey, createMagnet } from "./equipment";

export class UpgradePlatforms {
  group = new THREE.Group();
  private pads = PADS.map((pad) => {
    const root = new THREE.Group();
    root.position.set(pad.x / UNIT, 0, pad.y / UNIT);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.06, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x304f43 }),
    );
    base.position.y = 0.04;
    root.add(base);
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.5, 0.08, 3.5)),
      new THREE.LineBasicMaterial({ color: 0x8cf4da }),
    );
    border.position.y = 0.08;
    root.add(border);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.035, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x8cf4da }),
    );
    bar.position.set(-1.45, 0.1, 1.35);
    bar.geometry.translate(1.45, 0, 0);
    root.add(bar);
    const preview = new THREE.Group();
    preview.position.y = 2.5;
    root.add(preview);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 150;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthWrite: false }),
    );
    sign.position.set(0, 4.1, 0);
    sign.scale.set(5, 1.17, 1);
    root.add(sign);
    this.group.add(root);
    return {
      pad,
      root,
      bar,
      preview,
      sign,
      canvas,
      texture,
      lastText: "",
      level: -1,
      border,
    };
  });
  constructor(private machine: THREE.Group) {}
  render(sim: Simulation, time: number) {
    for (const item of this.pads) {
      const { pad, preview, bar } = item;
      const gate = pad.id === "gate1" || pad.id === "gate2";
      const gateSector = pad.id === "gate1" ? 1 : 2;
      const complete = gate
        ? sim.progress.sector > gateSector
        : sim.progress.levels[pad.id as Upgrade] >= 5;
      const level = gate
        ? Number(complete)
        : sim.progress.levels[pad.id as Upgrade];
      if (item.level !== level) {
        item.level = level;
        preview.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
            if (o instanceof THREE.InstancedMesh) o.dispose();
          }
        });
        preview.clear();
        const next = structuredClone(sim.progress);
        if (!gate) next.levels[pad.id as Upgrade] = Math.min(5, level + 1);
        const s = stats(next);
        let model: THREE.Group;
        if (gate) model = createKey();
        else if (pad.id === "magnet") model = createMagnet();
        else if (pad.id === "intake")
          model = createConveyor(
            s.intakeWidth / UNIT,
            s.intakeDepth / UNIT,
            s.feederLength / UNIT,
          ).group;
        else {
          model = this.machine
            .getObjectByName(pad.id === "blade" ? "Blade" : "Chassis")!
            .clone(true) as THREE.Group;
          model.scale.setScalar(1);
          if (pad.id === "blade") {
            model.scale.x = s.bladeWidth / (3.3 * s.scale);
            if (s.wings)
              for (const name of ["Wing_L", "Wing_R"]) {
                const wing = this.machine.getObjectByName(name)!.clone(true);
                wing.visible = true;
                // Wing coordinates are already baked in machine space.
                wing.position.x =
                  ((name === "Wing_L" ? -1 : 1) *
                    (s.bladeWidth / s.scale - 3.3)) /
                  2;
                const assembly = new THREE.Group();
                assembly.add(model, wing);
                model = assembly;
              }
          }
        }
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry = o.geometry.clone();
            o.material = new THREE.MeshStandardMaterial({
              color: gate ? (complete ? 0x66eda9 : 0xf37164) : 0x82f8e3,
              emissive: gate ? (complete ? 0x28a466 : 0xbb382e) : 0x20a69d,
              emissiveIntensity: 0.7,
              transparent: true,
              opacity: 0.72,
              roughness: 0.3,
              metalness: 0.1,
            });
            o.castShadow = false;
            o.receiveShadow = false;
          }
        });
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const scale = 2.4 / Math.max(size.x, size.y, size.z);
        const pivot = new THREE.Group();
        pivot.add(model);
        model.position.sub(center);
        pivot.scale.setScalar(scale);
        preview.add(pivot);
      }
      preview.rotation.y = time * 0.65;
      preview.position.y =
        (sim.activePad === pad.id ? 4.8 : 2.4) + Math.sin(time * 1.7) * 0.12;
      item.sign.position.y = preview.position.y + 1.7;
      const cost = padCost(sim.progress, pad.id);
      const funded = sim.progress.funding[pad.id];
      bar.scale.x = complete ? 1 : Math.max(0.005, cost ? funded / cost : 0);
      (item.border.material as THREE.LineBasicMaterial).color.setHex(
        sim.activePad === pad.id ? 0xffd16b : complete ? 0x66eda9 : 0x8cf4da,
      );
      const text =
        pad.name +
        (gate ? "" : " · " + (complete ? "MAX" : "LV " + (level + 1)));
      const detail = complete
        ? gate
          ? "UNLOCKED"
          : "FULLY FITTED"
        : cost === null
          ? "OPEN PREVIOUS GATE"
          : cost === 0
            ? "DRIVE ON · FREE"
            : "$" + funded + " / $" + cost;
      if (item.lastText !== text + detail) {
        item.lastText = text + detail;
        const ctx = item.canvas.getContext("2d")!;
        ctx.clearRect(0, 0, 640, 150);
        ctx.fillStyle = "#213b35ee";
        ctx.beginPath();
        ctx.roundRect(4, 4, 632, 142, 20);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff3d7";
        ctx.font = "bold 38px sans-serif";
        ctx.fillText(text, 320, 59);
        ctx.fillStyle = complete ? "#8cf4bd" : "#a8f5e4";
        ctx.font = "32px sans-serif";
        ctx.fillText(detail, 320, 112);
        item.texture.needsUpdate = true;
      }
    }
  }
}
