import * as THREE from "three";
import { ACTIVITY_PADS } from "./activities";
import { overtimeContract } from "./overtime";
import { Simulation, UNIT } from "./simulation";

export class ActivityPlatforms {
  group = new THREE.Group();
  private pads = ACTIVITY_PADS.map((pad) => {
    const root = new THREE.Group();
    root.name = pad.id;
    root.position.set(pad.x / UNIT, 0, pad.y / UNIT);
    const color = pad.id === "assay" ? 0xf1be61 : 0xa8d9be;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.08, 6),
      new THREE.MeshStandardMaterial({ color: 0x334e43 }),
    );
    base.position.y = 0.06;
    root.add(base);
    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(base.geometry),
      new THREE.LineBasicMaterial({ color }),
    );
    rim.position.y = 0.11;
    root.add(rim);
    const icon = new THREE.Group();
    icon.position.y = 2.7;
    root.add(icon);
    const gold = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
    });
    if (pad.id === "assay") {
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), gold);
      die.rotation.z = 0.2;
      icon.add(die);
      const dot = new THREE.SphereGeometry(0.07, 8, 6),
        dark = new THREE.MeshBasicMaterial({ color: 0x314c40 });
      for (const face of [0, 1, 2]) {
        for (let i = 0; i <= face; i++) {
          const pip = new THREE.Mesh(dot, dark);
          const offset = (i - face / 2) * 0.27;
          if (face === 0) pip.position.set(0, 0, 0.45);
          if (face === 1) pip.position.set(0.45, offset, offset);
          if (face === 2) pip.position.set(offset, 0.45, offset);
          die.add(pip);
        }
      }
    } else {
      icon.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1.3, 0.14), gold));
      const ink = new THREE.MeshBasicMaterial({ color: 0x345345 });
      for (let i = 0; i < 3; i++) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 0.08, 0.02),
          ink,
        );
        line.position.set(0, 0.25 - i * 0.25, 0.08);
        icon.add(line);
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 160;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthWrite: false }),
    );
    sign.position.y = 4.2;
    sign.scale.set(5.4, 1.35, 1);
    root.add(sign);
    this.group.add(root);
    return { pad, icon, base, rim, canvas, texture, lastText: "" };
  });
  render(sim: Simulation, time: number) {
    for (const item of this.pads) {
      const { pad, icon, canvas } = item;
      const active = sim.activeActivity === pad.id;
      icon.rotation.y = time * 0.65;
      icon.position.y = (active ? 4 : 2.7) + Math.sin(time * 2) * 0.13;
      item.base.scale.setScalar(active ? 1.15 : 1);
      item.rim.scale.copy(item.base.scale);
      const detail =
        pad.id === "assay"
          ? "PARK TO PLAY · FROM $10"
          : !sim.progress.victory
            ? "CLEAR ALL THREE SECTORS"
            : sim.progress.overtime.active
              ? "CONTRACT IN PROGRESS"
              : `FREE JOB · ${overtimeContract(sim.progress.overtime.completed).count} GEMS`;
      if (detail === item.lastText) continue;
      item.lastText = detail;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, 640, 160);
      ctx.fillStyle = "#243f35";
      ctx.fillRect(0, 0, 640, 160);
      ctx.fillStyle = pad.id === "assay" ? "#ffd482" : "#b8f4d4";
      ctx.textAlign = "center";
      ctx.font = "600 46px Barlow Condensed";
      ctx.fillText(pad.name, 320, 62);
      ctx.font = "600 24px DM Sans";
      ctx.fillText(detail, 320, 116);
      item.texture.needsUpdate = true;
    }
  }
}
