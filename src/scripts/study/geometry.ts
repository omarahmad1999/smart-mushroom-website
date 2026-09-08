import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeParts(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const transform = inverse.clone().multiply(object.matrixWorld);
    let geometry = object.geometry.clone();
    geometry.applyMatrix4(transform);
    if (geometry.index) {
      const nonIndexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = nonIndexed;
    }
    const bucket = buckets.get(object.material) ?? [];
    bucket.push(geometry);
    buckets.set(object.material, bucket);
    object.geometry.dispose();
  });
  group.clear();
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = !(material instanceof THREE.MeshBasicMaterial);
    mesh.receiveShadow = true;
    mesh.name = `${group.name}: ${material.type}`;
    group.add(mesh);
    geometries.forEach(part => part.dispose());
  }
}
