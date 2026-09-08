import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const up = new THREE.Vector3(0, 1, 0);

export function roundedBox(w: number, h: number, d: number, radius: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function rod(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, from.distanceTo(to), segments), material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function tube(points: number[][], radius: number, material: THREE.Material, segments = 40) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p as [number, number, number])));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function inscription(text: string, color: string, width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.font = '500 42px "DM Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 512, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
}

export function createStage() {
  const group = new THREE.Group();
  group.name = 'Display plinth';
  const wood = new THREE.MeshStandardMaterial({ color: '#c9b98e', roughness: 0.88 });
  const edge = new THREE.MeshStandardMaterial({ color: '#e6d9b7', roughness: 0.76 });
  const surface = new THREE.MeshStandardMaterial({ color: '#dddfca', roughness: 0.93 });
  const base = roundedBox(7.75, 0.12, 3.42, 0.055, wood);
  base.position.set(-.55, 0.025, 0);
  group.add(base);
  const rim = roundedBox(7.78, 0.035, 3.45, 0.045, edge);
  rim.position.set(-.55, 0.084, 0);
  group.add(rim);
  const top = roundedBox(7.69, 0.04, 3.36, 0.045, surface);
  top.position.set(-.55, 0.12, 0);
  group.add(top);
  // A quiet inlay gives the small platform a finished edge without a busy grid.
  const inlayMaterial = new THREE.MeshStandardMaterial({ color: '#b8bea3', roughness: 0.95 });
  for (const x of [-4.23, 3.13]) {
    const strip = roundedBox(0.008, 0.001, 3.03, 0.0004, inlayMaterial);
    strip.position.set(x, 0.141, 0);
    group.add(strip);
  }
  const plate = roundedBox(1.18, 0.004, 0.20, 0.018, new THREE.MeshStandardMaterial({ color: '#eee9d9', roughness: 0.8 }));
  plate.position.set(0.18, 0.148, 1.22);
  group.add(plate);
  const label = inscription('SMART MUSHROOM HUB', '#78806c', 1.02, 0.126);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0.18, 0.151, 1.22);
  group.add(label);
  return group;
}

export function createFrame() {
  const group = new THREE.Group();
  group.name = 'PVC frame';
  group.userData.component = 'frame';
  const ivory = new THREE.MeshStandardMaterial({ color: '#eeeadd', roughness: 0.49, metalness: 0.0 });
  const sage = new THREE.MeshStandardMaterial({ color: '#788c7e', roughness: 0.58 });
  const seam = new THREE.MeshStandardMaterial({ color: '#a5b09b', roughness: 0.73 });
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const z = -0.19;
  // Two upright pipes and a smoothly bent lintel form one small hanging bay.
  for (const x of [-0.94, 0.94]) {
    group.add(rod(V(x, 0.25, z), V(x, 2.64, z), 0.047, ivory, 28));
    group.add(rod(V(x, 0.19, -0.62), V(x, 0.19, 0.39), 0.047, ivory, 24));
    group.add(rod(V(x, 0.14, z), V(x, 0.37, z), 0.059, sage, 28));
    group.add(rod(V(x, 0.19, z - 0.13), V(x, 0.19, z + 0.13), 0.059, sage));
    for (const end of [-0.63, 0.40]) {
      group.add(rod(V(x, 0.19, end - 0.033), V(x, 0.19, end + 0.033), 0.052, sage));
    }
    for (const y of [0.85, 1.91]) {
      group.add(rod(V(x, y - 0.05, z), V(x, y + 0.05, z), 0.053, ivory, 28));
      group.add(rod(V(x, y - 0.052, z), V(x, y - 0.045, z), 0.0535, seam));
      group.add(rod(V(x, y + 0.045, z), V(x, y + 0.052, z), 0.0535, seam));
    }
  }
  group.add(rod(V(-0.80, 2.78, z), V(0.80, 2.78, z), 0.047, ivory, 28));
  for (const sign of [-1, 1]) {
    const path = new THREE.CatmullRomCurve3([
      V(sign * 0.94, 2.57, z), V(sign * 0.94, 2.69, z),
      V(sign * 0.915, 2.755, z), V(sign * 0.85, 2.78, z), V(sign * 0.74, 2.78, z),
    ]);
    const elbow = new THREE.Mesh(new THREE.TubeGeometry(path, 24, 0.060, 16, false), sage);
    elbow.castShadow = true;
    elbow.receiveShadow = true;
    group.add(elbow);
    group.add(rod(V(sign * 0.94, 2.565, z), V(sign * 0.94, 2.61, z), 0.063, sage));
    group.add(rod(V(sign * 0.73, 2.78, z), V(sign * 0.78, 2.78, z), 0.063, sage));
  }
  // Twisted-looking hemp suspension, routed around the upper pipe.
  const hemp = new THREE.MeshStandardMaterial({ color: '#b4a27c', roughness: 0.94 });
  const ropePoints = [
    [-0.24, 2.22, 0.03], [-0.24, 2.50, -0.025], [-0.25, 2.76, -0.12],
    [-0.24, 2.83, -0.175], [-0.23, 2.81, -0.235], [-0.23, 2.74, -0.24],
    [-0.22, 2.5, -0.025], [-0.22, 2.22, 0.03],
  ];
  group.add(tube(ropePoints, 0.009, hemp));
  return group;
}

export function createSensor() {
  const group = new THREE.Group();
  group.name = 'SCD41 vented sensor enclosure';
  group.userData.component = 'sensor';
  // Proportions and vent arrangement follow the supplied SCD enclosure image.
  const shell = new THREE.MeshStandardMaterial({ color: '#eeeee5', roughness: 0.57 });
  const recess = new THREE.MeshStandardMaterial({ color: '#566057', roughness: 0.87 });
  const tabMaterial = new THREE.MeshStandardMaterial({ color: '#b76e56', roughness: 0.64 });
  const metal = new THREE.MeshStandardMaterial({ color: '#a4aaa0', roughness: 0.4, metalness: 0.55 });
  const body = roundedBox(0.25, 0.39, 0.09, 0.023, shell);
  body.position.z = -0.005;
  group.add(body);
  const darkFace = roundedBox(0.213, 0.351, 0.003, 0.018, recess);
  darkFace.position.z = 0.043;
  group.add(darkFace);
  const grilleParts: THREE.BufferGeometry[] = [];
  const grille = (w: number, h: number, x: number, y: number) => {
    const geo = new RoundedBoxGeometry(w, h, 0.012, 2, 0.003);
    geo.translate(x, y, 0.05);
    grilleParts.push(geo);
  };
  for (const x of [-0.112, 0.112]) grille(0.023, 0.359, x, 0);
  for (const y of [-0.179, -0.099, 0.099, 0.179]) grille(0.235, 0.016, 0, y);
  grille(0.235, 0.063, 0, 0);
  for (let col = -5; col <= 5; col++) {
    for (const y of [-0.136, -0.061, 0.061, 0.136]) grille(0.012, 0.071, col * 0.019, y);
  }
  const combined = mergeGeometries(grilleParts);
  const grilleMesh = new THREE.Mesh(combined, shell);
  grilleMesh.castShadow = true;
  grilleMesh.receiveShadow = true;
  group.add(grilleMesh);
  grilleParts.forEach(geo => geo.dispose());
  const tab = roundedBox(0.12, 0.062, 0.05, 0.015, tabMaterial);
  tab.position.set(0, 0.21, -0.025);
  group.add(tab);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.009, 18), metal);
  screw.rotation.x = Math.PI / 2;
  screw.position.set(0, 0.216, 0.004);
  group.add(screw);
  const screwSlot = roundedBox(0.014, 0.0025, 0.001, 0.001, recess);
  screwSlot.position.set(0, 0.216, 0.009);
  screwSlot.rotation.z = 0.38;
  group.add(screwSlot);
  const label = inscription('SCD41', '#818a7a', 0.15, 0.02);
  label.position.set(0, 0, 0.057);
  group.add(label);
  group.position.set(0.94, 1.42, -0.072);
  const assembly = new THREE.Group();
  assembly.name = 'Sensor and illustrative cable';
  assembly.userData.component = 'sensor';
  assembly.add(group);
  const cableMaterial = new THREE.MeshStandardMaterial({ color: '#777c63', roughness: 0.82 });
  assembly.add(tube([
    [0.94, 1.22, -0.06], [0.985, 1.13, -0.04], [1.055, 1.16, -0.13],
    [1.005, 1.32, -0.215], [0.994, 1.72, -0.235], [0.992, 2.10, -0.235],
    [0.995, 2.53, -0.235], [0.91, 2.81, -0.255], [0.55, 2.82, -0.258],
  ], 0.011, cableMaterial, 72));
  const tieMaterial = new THREE.MeshStandardMaterial({ color: '#dad8c8', roughness: 0.8 });
  for (const y of [1.16, 1.78, 2.34]) {
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.005, 6, 24), tieMaterial);
    tie.position.set(0.945, y, -0.195);
    tie.rotation.x = Math.PI / 2;
    assembly.add(tie);
  }
  return assembly;
}
