import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createConveyor,
  animateConveyor,
  createMagnet,
  createRefinery,
} from "./equipment";
import { UpgradePlatforms } from "./platforms";
import { bakeModelPart } from "./model";
import { sampleTrack, TRACK_LENGTH, TRACK_LINK_COUNT } from "./tracks";
import { COLLECTOR, Simulation, UNIT } from "./simulation";
import { GATES, SECTORS, stats, TOTAL_GEMS } from "./progression";

const C = {
  sand: 0xcda37b,
  edge: 0x8f6650,
  pine: 0x304f43,
  dark: 0x273b35,
  cream: 0xf4e7c9,
  yellow: 0xf4ba49,
};
const material = (color: number, roughness = 0.8, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export class QuarryView {
  scene = new THREE.Scene();
  renderer: THREE.WebGLRenderer;
  camera = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 220);
  machine = new THREE.Group();
  model: THREE.Group | null = null;
  intake = new THREE.Group();
  gates: THREE.Group[] = [];
  gemBatches: THREE.InstancedMesh[] = [];
  tracks: { mesh: THREE.InstancedMesh; side: "left" | "right" }[] = [];
  dust: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] = [];
  belts: THREE.InstancedMesh[] = [];
  private renderedSim: Simulation | null = null;
  private gemTransforms = new Float64Array(TOTAL_GEMS * 4);
  private shownGems = new Set<number>();
  private emptyGem = new THREE.Matrix4().makeScale(0, 0, 0);
  private sectorOffsets = [
    0,
    SECTORS[0].count,
    SECTORS[0].count + SECTORS[1].count,
  ];
  platforms!: UpgradePlatforms;
  private elapsed = 0;
  private magnet = createMagnet();
  private field = new THREE.Group();
  zoom = 1;
  cameraMode: "follow" | "overview" = "follow";
  ready = false;
  private target = new THREE.Vector3(0, 0, -1.5);
  private statsKey = "";
  private shadow: THREE.DirectionalLight;
  private gemGeometry = new THREE.OctahedronGeometry(1, 0);
  private dummy = new THREE.Object3D();
  private density = new Float32Array(48 * 100);
  private gemMaterials = SECTORS.map(
    (s) =>
      new THREE.MeshStandardMaterial({
        color: s.color,
        metalness: 0.28,
        roughness: 0.24,
        flatShading: true,
      }),
  );
  private dustGeometry = new THREE.IcosahedronGeometry(0.12, 0);
  private dustMaterial = material(0xe4c89b);
  constructor(
    public canvas: HTMLCanvasElement,
    public sim: Simulation,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.scene.background = new THREE.Color(0xc8b293);
    this.scene.fog = new THREE.Fog(0xc8b293, 75, 130);
    this.scene.add(new THREE.HemisphereLight(0xfff3d5, 0x82715e, 2.5));
    const sun = (this.shadow = new THREE.DirectionalLight(0xffe8c1, 3.5));
    sun.position.set(-22, 40, 18);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, {
      left: -34,
      right: 34,
      top: 34,
      bottom: -34,
      near: 1,
      far: 100,
    });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.045;
    this.scene.add(sun, sun.target);
    this.buildQuarry();
    this.buildIntake();
    this.scene.add(this.machine);
    for (const [i, sector] of SECTORS.entries()) {
      const batch = new THREE.InstancedMesh(
        this.gemGeometry,
        this.gemMaterials[i],
        sector.count,
      );
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.frustumCulled = false;
      const color = new THREE.Color();
      for (let index = 0; index < sector.count; index++)
        batch.setColorAt(index, color.setScalar(0.78 + (index % 7) * 0.055));
      this.gemBatches.push(batch);
      this.scene.add(batch);
    }
    this.resize();
  }
  async load() {
    const gltf = await new GLTFLoader().loadAsync(
      `${import.meta.env.BASE_URL}models/gilt-dozer.glb`,
    );
    // Static paintwork is batched separately from the moving track links.
    for (const name of ["Chassis", "Blade", "Wing_L", "Wing_R"]) {
      const source = gltf.scene.getObjectByName(name)!;
      this.machine.add(bakeModelPart(source));
    }
    const shoe = bakeModelPart(gltf.scene.getObjectByName("TrackShoe")!);
    for (const side of ["left", "right"] as const) {
      for (const part of shoe.children as THREE.Mesh[]) {
        const mesh = new THREE.InstancedMesh(
          part.geometry,
          part.material,
          TRACK_LINK_COUNT,
        );
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        this.tracks.push({ mesh, side });
        this.machine.add(mesh);
      }
    }
    this.machine.add(this.magnet, this.field);
    for (let i = 0; i < 3; i++) {
      const arc = new THREE.Mesh(
        new THREE.RingGeometry(0.97, 1, 48, 1, 0, Math.PI),
        new THREE.MeshBasicMaterial({
          color: 0x9effef,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      arc.rotation.x = -Math.PI / 2;
      this.field.add(arc);
    }
    this.platforms = new UpgradePlatforms(this.machine);
    this.scene.add(this.platforms.group);
    this.model = this.machine;
    this.ready = true;
    this.statsKey = "";
  }
  box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
    cast = true,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  label(
    text: string,
    x: number,
    y: number,
    z: number,
    size = 3,
    color = "#f8edcf",
    background = "",
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 768, 128);
    }
    ctx.fillStyle = color;
    ctx.font = 'bold 58px "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 384, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size / 6),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    return mesh;
  }
  buildQuarry() {
    this.box(this.scene, 0, -1.1, -20, 32, 2.1, 66, C.edge);
    this.box(this.scene, 0, -0.1, -20, 30, 0.2, 64, C.sand, false);
    // Low terraced cliffs frame the playable floor without obscuring its edges.
    let seed = 422;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let side of [-1, 1])
      for (let z = -53; z < 15; z += 2.8) {
        const h = 1.1 + random() * 1.3;
        const rock = this.box(
          this.scene,
          side * (16.3 + random() * 0.7),
          h / 2 - 0.15,
          z,
          2.7 + random(),
          h,
          3.6,
          random() > 0.5 ? 0xb28261 : 0xa8795c,
        );
        rock.rotation.y = random() * 0.25;
        this.box(
          this.scene,
          side * 18.2,
          h * 0.7 - 0.2,
          z,
          2.7,
          h * 1.4,
          3.7,
          0xbf9472,
        );
      }
    for (let i = 0; i < 200; i++) {
      const x = -14.4 + random() * 28.8,
        z = -51 + random() * 62;
      const pebble = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.035 + random() * 0.1, 0),
        material(random() > 0.5 ? 0xb98e67 : 0xe2bb8d),
      );
      pebble.position.set(x, 0.018, z);
      pebble.scale.y = 0.25;
      this.scene.add(pebble);
    }
    // Survey stripes, sector markings and thin route guides establish a working quarry.
    for (let i = 0; i < 3; i++) {
      const z = (SECTORS[i].maxY + SECTORS[i].minY) / 60;
      this.label(
        `0${i + 1}  /  ${SECTORS[i].name.toUpperCase()}`,
        0,
        0.015,
        z - 4.6,
        12,
        "#9b7356",
      );
      for (let side of [-1, 1])
        for (let k = 0; k < 10; k++)
          this.box(
            this.scene,
            side * 14.55,
            0.025,
            z - 7 + k * 1.4,
            0.1,
            0.02,
            0.65,
            0xe6c49d,
            false,
          );
    }
    for (const [i, y] of GATES.entries()) {
      const gate = new THREE.Group();
      gate.position.z = y / UNIT;
      for (let x = -14; x <= 14; x += 2) {
        this.box(gate, x, 0.56, 0, 1.85, 0.64, 0.36, C.yellow);
        const stripe = this.box(gate, x, 0.56, -0.2, 0.36, 0.65, 0.035, C.dark);
        stripe.rotation.z = -0.4;
      }
      for (let x of [-14.6, 14.6]) {
        this.box(gate, x, 1, 0, 0.38, 2, 0.5, C.pine);
        this.box(gate, x, 2.06, 0, 0.5, 0.14, 0.55, C.cream);
      }
      this.gates.push(gate);
      this.scene.add(gate);
      this.label(
        `SECTOR 0${i + 2}  /  ${i === 0 ? "CITRINE" : "AMETHYST"}`,
        0,
        0.02,
        y / UNIT + 1.4,
        8,
        "#765640",
      );
    }
    // Field workshop, utility tanks and a small depot on the safe rear edge.
    const shop = new THREE.Group();
    shop.position.set(-11.3, 0, 10.7);
    this.box(shop, 0, 0.05, 0, 5.8, 0.1, 5, 0xb59576, false);
    this.box(shop, 0, 1.3, 1.2, 4.6, 2.6, 2.3, C.pine);
    this.box(shop, 0, 2.7, 1.05, 5, 0.22, 2.9, C.cream);
    this.box(shop, 0, 1.15, -0.02, 2.7, 2.1, 0.08, C.dark);
    for (let x of [-1.65, 1.65])
      this.box(shop, x, 1.7, -0.05, 0.46, 0.55, 0.1, C.yellow);
    for (let x of [-1.05, 1.05])
      this.box(shop, x, 0.025, -1.5, 0.09, 0.04, 1.6, C.cream, false);
    this.scene.add(shop);
    this.label("WORKSHOP", -11.3, 2.84, 11.6, 4.3, "#304f43");
    for (let i = 0; i < 3; i++) {
      this.box(this.scene, 10.5 + i * 1.25, 0.55, 11.25, 1, 1.1, 1, C.pine);
      this.box(
        this.scene,
        10.5 + i * 1.25,
        1.12,
        11.25,
        1.04,
        0.1,
        1.04,
        C.cream,
      );
    }
    // Crane silhouette at the depot, deliberately outside the driving surface.
    this.box(this.scene, 17, 3.6, 8, 0.3, 7.2, 0.3, C.dark);
    this.box(this.scene, 15.3, 7.3, 8, 4, 0.3, 0.3, C.yellow);
    this.box(this.scene, 13.4, 5.7, 8, 0.035, 3.2, 0.035, C.dark);
    this.box(this.scene, 13.4, 4.05, 8, 0.3, 0.15, 0.3, C.dark);
    this.label("GILT  /  QUARRY WORKS", 0, 0.03, 11.5, 10, "#86664e");
  }
  buildIntake() {
    this.intake.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
        if (o instanceof THREE.InstancedMesh) o.dispose();
      }
    });
    this.intake.clear();
    this.belts = [];
    const s = stats(this.sim.progress);
    const belt = createConveyor(
      s.intakeWidth / UNIT,
      s.intakeDepth / UNIT,
      s.feederLength / UNIT,
    );
    this.intake.add(belt.group);
    if (this.sim.progress.levels.refinery > 0) {
      const refinery = createRefinery(this.sim.progress.levels.refinery);
      refinery.position.z = 2.2;
      this.intake.add(refinery);
    }
    this.belts = belt.slats;
    this.intake.position.set(0, 0, COLLECTOR.y / UNIT);
    this.scene.add(this.intake);
    if (!this.scene.getObjectByName("intake-label"))
      this.label("↓  DEPOSIT  ↓", 0, 0.022, 6.9, 4.4, "#f8edcf").name =
        "intake-label";
  }
  resize() {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    const viewHeight = (h < 500 ? 19 : w < 700 ? 37 : 28) / this.zoom,
      aspect = w / h;
    this.camera.left = (-viewHeight * aspect) / 2;
    this.camera.right = (viewHeight * aspect) / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }
  headingFromScreenDrag(x: number, y: number) {
    // Invert the camera's ground-plane projection so dragging up means up on screen.
    const e = this.camera.matrixWorld.elements;
    const determinant = e[0] * e[6] - e[2] * e[4];
    const groundX = (x * e[6] + y * e[2]) / determinant;
    const groundY = (-y * e[0] - x * e[4]) / determinant;
    return Math.atan2(groundX, -groundY);
  }
  project(x: number, y: number, height = 0.5) {
    const v = new THREE.Vector3(x / UNIT, height, y / UNIT).project(
      this.camera,
    );
    return {
      x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight,
    };
  }
  burst(x: number, y: number, color: number) {
    const mat =
      this.gemMaterials[SECTORS.findIndex((s) => s.color === color)] ??
      this.dustMaterial;
    for (let i = 0; i < 3 && this.dust.length < 200; i++) {
      const mesh = new THREE.Mesh(this.dustGeometry, mat);
      mesh.position.set(x / UNIT, 0.4, y / UNIT);
      this.scene.add(mesh);
      this.dust.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 2,
        ),
        life: 0.7,
      });
    }
  }
  render(dt: number, _time: number) {
    this.elapsed += dt;
    const time = this.elapsed;
    const p = this.sim.position,
      s = stats(this.sim.progress);
    this.machine.position.set(
      p.x / UNIT,
      Math.sin(time * 18) * Math.min(this.sim.dozer.speed * 0.008, 0.018),
      p.y / UNIT,
    );
    this.machine.rotation.y = -this.sim.dozer.angle;
    this.machine.scale.setScalar(s.scale);
    const key = JSON.stringify(this.sim.progress.levels);
    if (key !== this.statsKey && this.ready) {
      this.statsKey = key;
      this.machine.getObjectByName("Blade")!.scale.x =
        s.bladeWidth / (3.3 * s.scale);
      for (const [name, side] of [
        ["Wing_L", -1],
        ["Wing_R", 1],
      ] as const) {
        const wing = this.machine.getObjectByName(name)!;
        wing.visible = s.wings;
        wing.position.x = (side * (s.bladeWidth / s.scale - 3.3)) / 2;
      }
      this.buildIntake();
    }
    this.gates.forEach((g, i) => {
      const t = this.sim.gateOpening[i];
      g.position.y = -2.6 * (t * t * (3 - 2 * t));
      g.visible = t < 1;
    });
    animateConveyor(this.belts, time);
    this.intake.getObjectByName("Refinery")?.children.forEach((drum) => {
      if (drum.name === "PolishingDrum") drum.rotation.y = time * 2;
    });
    this.platforms?.render(this.sim, time);
    this.magnet.visible = this.sim.progress.levels.magnet > 0;
    this.field.visible = this.magnet.visible;
    this.field.children.forEach((arc, i) => {
      const phase = (time * 0.55 + i / 3) % 1;
      arc.position.set(0, 0.16, -2.85);
      arc.scale.setScalar(((1 - phase) * s.magnetRange) / (UNIT * s.scale));
      ((arc as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
        Math.sin(phase * Math.PI) * 0.28;
    });
    for (const track of this.tracks) {
      for (let i = 0; i < TRACK_LINK_COUNT; i++) {
        const point = sampleTrack(
          (i * TRACK_LENGTH) / TRACK_LINK_COUNT -
            this.sim.trackTravel[track.side],
        );
        this.dummy.position.set(
          track.side === "left" ? -1 : 1,
          point.y,
          point.z,
        );
        this.dummy.rotation.set(point.angle, 0, 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        track.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      track.mesh.instanceMatrix.needsUpdate = true;
    }
    // Packing adds a little jostling without lifting loose gems away from the ground.
    // Collision remains planar rather than vertical rigid-body stacking.
    // Stable slots avoid shifting every later gem when one is collected.
    // Only changed poses or pile heights need new matrices and GPU uploads.
    if (this.renderedSim !== this.sim) {
      this.renderedSim = this.sim;
      this.gemTransforms.fill(NaN);
      this.shownGems.clear();
      for (const batch of this.gemBatches) {
        for (let i = 0; i < batch.instanceMatrix.count; i++)
          batch.setMatrixAt(i, this.emptyGem);
        batch.instanceMatrix.clearUpdateRanges();
        batch.instanceMatrix.addUpdateRange(0, batch.instanceMatrix.count * 16);
        batch.instanceMatrix.needsUpdate = true;
      }
    }
    for (const id of this.shownGems) {
      if (this.sim.gems.has(id)) continue;
      const sector =
        id < this.sectorOffsets[1] ? 0 : id < this.sectorOffsets[2] ? 1 : 2;
      const index = id - this.sectorOffsets[sector];
      const batch = this.gemBatches[sector];
      batch.setMatrixAt(index, this.emptyGem);
      batch.instanceMatrix.addUpdateRange(index * 16, 16);
      batch.instanceMatrix.needsUpdate = true;
      this.shownGems.delete(id);
      this.gemTransforms[id * 4] = NaN;
    }
    this.density.fill(0);
    for (const gem of this.sim.gems.values()) {
      const cellX = Math.floor((gem.body.position.x + 480) / 24),
        cellY = Math.floor((gem.body.position.y + 1600) / 24);
      this.density[cellY * 48 + cellX]++;
    }
    const counts = [0, 0, 0];
    for (const [id, gem] of this.sim.gems) {
      const r = gem.radius / UNIT;
      const cellX = Math.floor((gem.body.position.x + 480) / 24),
        cellY = Math.floor((gem.body.position.y + 1600) / 24);
      let density = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          density +=
            ((this.density[(cellY + dy) * 48 + cellX + dx] ?? 0) *
              (dx === 0 ? 2 : 1) *
              (dy === 0 ? 2 : 1)) /
            16;
        }
      const mound = Math.max(0, Math.min(r * 0.4, (density - 1) * 0.008));
      const layer = (id * 0.61803398875) % 1;
      const height = r * 0.85 + mound * layer;
      const position = gem.body.position;
      const cached = id * 4;
      const index = id - this.sectorOffsets[gem.sector];
      counts[gem.sector] = Math.max(counts[gem.sector], index + 1);
      if (
        this.gemTransforms[cached] === position.x &&
        this.gemTransforms[cached + 1] === position.y &&
        this.gemTransforms[cached + 2] === gem.body.angle &&
        this.gemTransforms[cached + 3] === height
      )
        continue;
      this.shownGems.add(id);
      this.gemTransforms[cached] = position.x;
      this.gemTransforms[cached + 1] = position.y;
      this.gemTransforms[cached + 2] = gem.body.angle;
      this.gemTransforms[cached + 3] = height;
      this.dummy.position.set(position.x / UNIT, height, position.y / UNIT);
      this.dummy.rotation.set(0.2 + id * 0.13, gem.body.angle, id * 0.19);
      this.dummy.scale.set(r * 1.15, r * (1.3 + (id % 3) * 0.15), r * 1.15);
      this.dummy.updateMatrix();
      const batch = this.gemBatches[gem.sector];
      batch.setMatrixAt(index, this.dummy.matrix);
      batch.instanceMatrix.addUpdateRange(index * 16, 16);
      batch.instanceMatrix.needsUpdate = true;
    }
    this.gemBatches.forEach((batch, i) => {
      batch.count = counts[i];
    });
    if (this.sim.dozer.speed > 0.7 && Math.random() < dt * 15) {
      const mesh = new THREE.Mesh(this.dustGeometry, this.dustMaterial);
      mesh.position.set(
        p.x / UNIT + (Math.random() - 0.5) * 2,
        0.12,
        p.y / UNIT,
      );
      this.scene.add(mesh);
      this.dust.push({
        mesh,
        velocity: new THREE.Vector3(0, 0.15, 0),
        life: 0.5,
      });
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const particle = this.dust[i];
      particle.life -= dt;
      particle.velocity.y -= dt * 3;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.scale.setScalar(Math.max(0, particle.life * 2));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.dust.splice(i, 1);
      }
    }
    const mobile =
      this.canvas.clientWidth < 700 || matchMedia("(pointer: coarse)").matches;
    const follow = new THREE.Vector3(
      (p.x / UNIT) * (mobile ? 1 : 0.36),
      0,
      mobile ? p.y / UNIT - 2.3 : Math.min(1, p.y / UNIT - 2.3),
    );
    if (this.cameraMode === "overview") {
      follow.set(0, 0, -19);
    }
    this.target.lerp(follow, 1 - Math.exp(-dt * 3));
    const offset =
      this.cameraMode === "overview"
        ? new THREE.Vector3(18, 56, 40)
        : new THREE.Vector3(10, 24, 18);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
    this.shadow.position.copy(this.target).add(new THREE.Vector3(-22, 40, 18));
    this.shadow.target.position.copy(this.target);
    this.renderer.render(this.scene, this.camera);
  }
}
