import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Blender's procedural plate has no UVs; primitive meshes do. Normalize before batching. */
export function bakeModelPart(source: THREE.Object3D): THREE.Group {
  source.updateWorldMatrix(true, true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (!geometry.getAttribute("uv")) {
      geometry.setAttribute(
        "uv",
        new THREE.BufferAttribute(
          new Float32Array(geometry.getAttribute("position").count * 2),
          2,
        ),
      );
    }
    const geometries = buckets.get(material) ?? [];
    geometries.push(geometry);
    buckets.set(material, geometries);
  });
  const group = new THREE.Group();
  group.name = source.name;
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    if (!merged)
      throw new Error(`Cannot combine ${source.name}: ${material.name}`);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach((geometry) => geometry.dispose());
  }
  return group;
}
