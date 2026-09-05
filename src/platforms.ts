import * as THREE from "three";
import {
  PADS,
  padCost,
  padLockedSector,
  upgradeCost,
  UPGRADE_MAX,
  stats,
  Upgrade,
} from "./progression";
import { Simulation, UNIT } from "./simulation";
import {
  createConveyor,
  createKey,
  createMagnet,
  createRefinery,
} from "./equipment";

export class UpgradePlatforms {
  group = new THREE.Group();
  private lastTime = 0;
  private dummy = new THREE.Object3D();
  private dark = new THREE.Color(0x304f43);
  private gold = new THREE.Color(0x71b99a);
  private lit = new THREE.Color(0xffd46b);
  private unlit = new THREE.Color(0x3f7666);
  private pads = PADS.map((pad) => {
    const root = new THREE.Group();
    root.name = pad.id;
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
    const rim = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.05, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      48,
    );
    rim.name = "FundingRim";
    rim.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    rim.frustumCulled = false;
    root.add(rim);
    const preview = new THREE.Group();
    preview.name = "Hologram";
    preview.position.y = 2.5;
    root.add(preview);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 180;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthWrite: false }),
    );
    sign.position.set(0, 4.1, 0);
    sign.scale.set(5, 1.4, 1);
    root.add(sign);
    this.group.add(root);
    return {
      pad,
      root,
      base,
      rim,
      expansion: 0,
      lift: 2.4,
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
    const dt = Math.max(0, time - this.lastTime);
    this.lastTime = time;
    const ease = 1 - Math.exp(-dt * 7);
    for (const item of this.pads) {
      const { pad, preview, bar } = item;
      const gate = pad.id === "gate1" || pad.id === "gate2";
      const gateSector = pad.id === "gate1" ? 1 : 2;
      const complete = gate
        ? sim.progress.sector > gateSector
        : sim.progress.levels[pad.id as Upgrade] >=
          UPGRADE_MAX[pad.id as Upgrade];
      const level = gate
        ? Number(complete)
        : sim.progress.levels[pad.id as Upgrade];
      const active = sim.activePad === pad.id;
      const fitted = active && sim.padCompleted;
      const locked = fitted ? null : padLockedSector(sim.progress, pad.id);
      const displayLevel = gate
        ? level
        : Math.min(UPGRADE_MAX[pad.id as Upgrade], level + (fitted ? 0 : 1));
      if (item.level !== displayLevel) {
        item.level = displayLevel;
        preview.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
            if (o instanceof THREE.InstancedMesh) o.dispose();
          }
        });
        preview.clear();
        const next = structuredClone(sim.progress);
        if (!gate) next.levels[pad.id as Upgrade] = displayLevel;
        const s = stats(next);
        let model: THREE.Group;
        if (gate) model = createKey();
        else if (pad.id === "refinery") model = createRefinery(displayLevel);
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
      const retreat = gate && complete ? sim.gateOpening[gateSector - 1] : 0;
      item.root.visible = retreat < 1;
      item.root.scale.setScalar(1 - retreat * retreat * (3 - 2 * retreat));
      item.expansion +=
        ((active && locked === null ? 1 : 0) - item.expansion) * ease;
      item.lift += ((active ? 4.8 : 2.4) - item.lift) * ease;
      preview.rotation.y = time * 0.65;
      preview.position.y = item.lift + Math.sin(time * 1.7) * 0.12;
      item.sign.position.y = preview.position.y + 1.7;
      const cost = gate
        ? padCost(sim.progress, pad.id)
        : upgradeCost(sim.progress, pad.id as Upgrade);
      const funded = sim.progress.funding[pad.id];
      const fraction = complete || fitted ? 1 : cost ? funded / cost : 0;
      const width =
        3.4 +
        ((gate
          ? 5.2
          : Math.min(
              6.5,
              Math.max(4.8, stats(sim.progress).bladeWidth + 0.7),
            )) -
          3.4) *
          item.expansion;
      const depth = 3.4 + 2.2 * item.expansion;
      item.base.scale.set(width / 3.4, 1, depth / 3.4);
      (item.base.material as THREE.MeshStandardMaterial).color.lerpColors(
        this.dark,
        this.gold,
        fraction * 0.8,
      );
      item.border.scale.set(width / 3.5, 1, depth / 3.5);
      bar.scale.x = (Math.max(0.005, fraction) * (width - 0.5)) / 2.9;
      bar.position.set(-(width - 0.5) / 2, 0.1, depth / 2 - 0.25);
      for (let i = 0; i < 48; i++) {
        const edge = Math.floor(i / 12),
          t = ((i % 12) + 0.5) / 12 - 0.5;
        this.dummy.position.set(
          edge === 0
            ? t * width
            : edge === 1
              ? width / 2
              : edge === 2
                ? -t * width
                : -width / 2,
          0.14,
          edge === 0
            ? -depth / 2
            : edge === 1
              ? t * depth
              : edge === 2
                ? depth / 2
                : -t * depth,
        );
        this.dummy.scale.set(
          edge % 2 === 0 ? (width / 12) * 0.88 : 0.13,
          1,
          edge % 2 === 0 ? 0.13 : (depth / 12) * 0.88,
        );
        this.dummy.updateMatrix();
        item.rim.setMatrixAt(i, this.dummy.matrix);
        item.rim.setColorAt(i, i < fraction * 48 ? this.lit : this.unlit);
      }
      item.rim.instanceMatrix.needsUpdate = true;
      item.rim.instanceColor!.needsUpdate = true;
      (item.border.material as THREE.LineBasicMaterial).color.setHex(
        active ? 0xffd16b : complete ? 0x66eda9 : 0x8cf4da,
      );
      const text =
        pad.name +
        (gate ? "" : " · " + (complete ? "MAX" : "LV " + displayLevel));
      const detail =
        locked !== null
          ? "SECTOR 0" + locked + " REQUIRED"
          : fitted
            ? "FITTED - DRIVE OFF TO CONTINUE"
            : complete
              ? gate
                ? "UNLOCKED"
                : "FULLY FITTED"
              : cost === null
                ? "OPEN PREVIOUS GATE"
                : cost === 0
                  ? "DRIVE ON · FREE"
                  : "$" + funded + " / $" + cost;
      if (item.lastText !== text + detail + fraction) {
        item.lastText = text + detail + fraction;
        const ctx = item.canvas.getContext("2d")!;
        ctx.clearRect(0, 0, 640, 180);
        ctx.fillStyle = "#213b35ee";
        ctx.beginPath();
        ctx.roundRect(4, 4, 632, 172, 20);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff3d7";
        ctx.font = "bold 38px sans-serif";
        ctx.fillText(text, 320, 59);
        ctx.fillStyle = complete ? "#8cf4bd" : "#a8f5e4";
        ctx.font = "27px sans-serif";
        ctx.fillText(detail, 320, 112);
        ctx.fillStyle = "#587469";
        ctx.fillRect(26, 140, 588, 12);
        ctx.fillStyle = "#ffd46b";
        ctx.fillRect(26, 140, 588 * fraction, 12);
        item.texture.needsUpdate = true;
      }
    }
  }
}
