import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHangingBag } from './organic';
import { rod, roundedBox } from './hardware';

const LEFT = -.30;
const RIGHT = 1.40;
const BACK = -.69;
const FRONT = .45;
const BOTTOM = .19;
const ROOF = 4.04;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, steps = 32) {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, radius, 6, false), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function materialKey(material: THREE.Material) {
  const m = material as THREE.MeshPhysicalMaterial;
  return JSON.stringify([
    material.type, m.color?.getHex(), m.roughness, m.metalness,
    m.opacity, m.transparent, m.side, m.depthWrite, m.vertexColors,
    m.clearcoat, m.clearcoatRoughness,
  ]);
}

function mushroomPart(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    if (node.name === 'oyster-clusters' || node.userData.mushrooms) return true;
  }
  return false;
}

/** Merge static geometry while retaining grain instancing and the oyster toggle. */
function compact(source: THREE.Group, preserveOysters = false) {
  source.updateMatrixWorld(true);
  const output = new THREE.Group();
  output.name = source.name;
  output.userData = { ...source.userData };
  const oysters = new THREE.Group();
  oysters.name = 'oyster-clusters';
  oysters.userData.mushrooms = true;
  const buckets = new Map<string, {
    geometries: THREE.BufferGeometry[];
    material: THREE.Material;
    mushrooms: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
  }>();
  const keepGeometry = new Set<THREE.BufferGeometry>();
  const keepMaterial = new Set<THREE.Material>();
  const oldGeometry = new Set<THREE.BufferGeometry>();
  const oldMaterial = new Set<THREE.Material>();

  source.traverse(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
    const isOyster = preserveOysters && mushroomPart(object);
    oldGeometry.add(object.geometry);
    oldMaterial.add(object.material);
    if (object instanceof THREE.InstancedMesh) {
      const copy = object.clone();
      copy.matrix.copy(object.matrixWorld);
      copy.matrix.decompose(copy.position, copy.quaternion, copy.scale);
      (isOyster ? oysters : output).add(copy);
      keepGeometry.add(copy.geometry);
      keepMaterial.add(copy.material as THREE.Material);
      return;
    }
    // Attribute lists matter: the vertex-coloured bag surfaces have no UVs.
    const attributes = Object.keys(object.geometry.attributes).sort().join(',');
    const key = `${isOyster}|${object.castShadow}|${object.receiveShadow}|${attributes}|${materialKey(object.material)}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { geometries: [], material: object.material, mushrooms: isOyster, castShadow: object.castShadow, receiveShadow: object.receiveShadow };
      buckets.set(key, bucket);
    }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    bucket.geometries.push(geometry);
  });
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometries, false)!;
    bucket.geometries.forEach(part => part.dispose());
    const mesh = new THREE.Mesh(geometry, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    keepMaterial.add(bucket.material);
    (bucket.mushrooms ? oysters : output).add(mesh);
  }
  if (preserveOysters) output.add(oysters);
  oldGeometry.forEach(geometry => { if (!keepGeometry.has(geometry)) geometry.dispose(); });
  oldMaterial.forEach(material => { if (!keepMaterial.has(material)) material.dispose(); });
  return output;
}

function frameStructure() {
  const frame = new THREE.Group();
  frame.name = 'PVC frame with two internal hanging levels';
  frame.userData.component = 'frame';
  const ivory = new THREE.MeshStandardMaterial({ color: '#e6e2d4', roughness: .63 });
  const sage = new THREE.MeshStandardMaterial({ color: '#788c7e', roughness: .68 });
  const dark = new THREE.MeshStandardMaterial({ color: '#77816f', roughness: .92 });
  const levels = [.35, 1.83, 3.24, ROOF];
  const sideLevels = [.95, 2.52];
  const joint = (x: number, y: number, z: number, axis: 'x' | 'z') => {
    const centre = V(x, y, z);
    const offset = axis === 'x' ? V(.082, 0, 0) : V(0, 0, .082);
    frame.add(rod(centre.clone().sub(offset), centre.clone().add(offset), .051, sage, 14));
  };
  for (const x of [LEFT, RIGHT]) for (const z of [BACK, FRONT]) {
    frame.add(rod(V(x, BOTTOM, z), V(x, ROOF, z), .042, ivory, 18));
    for (const y of [...levels, ...sideLevels]) {
      const join = new THREE.Mesh(new THREE.SphereGeometry(.053, 12, 8), sage);
      join.position.set(x,y,z); frame.add(join);
      frame.add(rod(V(x, y-.078, z),V(x,Math.min(ROOF,y+.078),z),.052,sage,14));
      frame.add(rod(V(x,y,z),V(x,y,z+(z===BACK?.10:-.10)),.052,sage,14));
      if(levels.includes(y)) frame.add(rod(V(x,y,z),V(x+(x===LEFT?.10:-.10),y,z),.052,sage,14));
    }
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(.062,.066,.025,16),dark);
    foot.position.set(x,.155,z); frame.add(foot);
  }
  for (const y of levels) {
    for(const z of [BACK,FRONT]) frame.add(rod(V(LEFT,y,z),V(RIGHT,y,z),.042,ivory,18));
    for(const x of [LEFT,RIGHT]) frame.add(rod(V(x,y,BACK),V(x,y,FRONT),.042,ivory,18));
  }
  for(const y of sideLevels) for(const x of [LEFT,RIGHT]) frame.add(rod(V(x,y,BACK),V(x,y,FRONT),.042,ivory,18));
  // Internal depth rails and a central transverse rail form each hanging rack.
  for(const y of [1.83,3.24]) {
    for(const x of [.16,.94]) {
      frame.add(rod(V(x,y,BACK),V(x,y,FRONT),.039,ivory,18));
      for(const z of [BACK,FRONT]) {joint(x,y,z,'x');joint(x,y,z,'z');}
    }
    frame.add(rod(V(LEFT,y,-.12),V(RIGHT,y,-.12),.039,ivory,18));
    for(const x of [LEFT,.16,.94,RIGHT]) {joint(x,y,-.12,'x');joint(x,y,-.12,'z');}
  }
  return compact(frame);
}

function rectangle(x0: number, y0: number, x1: number, y1: number) {
  const shape = new THREE.Shape();
  shape.moveTo(x0, y0);
  shape.lineTo(x1, y0);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y1);
  shape.closePath();
  return shape;
}

function coverPanels() {
  const cover = new THREE.Group();
  cover.name = 'Seamed plastic enclosure and camera window';
  cover.userData.component = 'cover';
  const film = new THREE.MeshStandardMaterial({ color: '#ece9dc', transparent: true, opacity: .115, roughness: .76, side: THREE.DoubleSide, depthWrite: false });
  const tape = new THREE.MeshStandardMaterial({ color: '#d8d7c7', transparent: true, opacity: .62, roughness: .92, depthWrite: false });
  const zipperMaterial = new THREE.MeshStandardMaterial({ color: '#a6ad96', roughness: .92 });
  const zipMetal = new THREE.MeshStandardMaterial({ color: '#b39670', roughness: .61, metalness: .10 });
  const acrylic = new THREE.MeshStandardMaterial({ color: '#d3e1db', transparent: true, opacity: .17, roughness: .34, side: THREE.DoubleSide, depthWrite: false });
  const panel = (shape: THREE.Shape, position: THREE.Vector3, rotation = new THREE.Euler()) => {
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), film);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.castShadow = mesh.receiveShadow = false;
    cover.add(mesh);
  };
  const front = rectangle(LEFT, .245, RIGHT, ROOF);
  panel(front, V(0, 0, FRONT + .006));
  panel(rectangle(LEFT, .245, RIGHT, ROOF), V(0, 0, BACK - .006));
  // Side openings follow the two camera heights, low ventilation, and high duct.
  for (const x of [LEFT - .006, RIGHT + .006]) {
    const side = rectangle(BACK, .245, FRONT, ROOF);
    const hole = (x0:number,y0:number,x1:number,y1:number) => {
      const path = new THREE.Path();
      path.moveTo(x0,y0);path.lineTo(x0,y1);path.lineTo(x1,y1);path.lineTo(x1,y0);path.closePath();
      side.holes.push(path);
    };
    if (x < 0) {
      for(const y of [3.29,1.88]) {
        hole(-.145,y-.17,.185,y+.17);
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(.33,.34),acrylic);
        glass.rotation.y = Math.PI/2;glass.position.set(x-.002,y,.02);cover.add(glass);
      }
      hole(-.34,.38,.10,.82);
      const coolerInlet = new THREE.Path();coolerInlet.absarc(-.05,3.77,.13,0,Math.PI*2,true);side.holes.push(coolerInlet);
    } else {
      hole(-.325,.35,.125,.81);
      const ductHole = new THREE.Path();ductHole.absarc(-.15,3.09,.125,0,Math.PI*2,true);side.holes.push(ductHole);
    }
    panel(side, V(x,0,0), new THREE.Euler(0,-Math.PI/2,0));
  }
  panel(rectangle(LEFT,BACK,RIGHT,FRONT), V(0,ROOF+.007,0),new THREE.Euler(Math.PI/2,0,0));

  for (const x of [LEFT, RIGHT]) {
    for (const z of [BACK, FRONT]) {
      const seam = rod(V(x, .28, z), V(x, 4.00, z), .0055, tape, 5);
      seam.castShadow = seam.receiveShadow = false;
      cover.add(seam);
    }
  }
  for (const y of [.27, 3.99]) {
    for (const z of [BACK, FRONT]) {
      const seam = rod(V(LEFT + .02, y, z), V(RIGHT - .02, y, z), .006, tape, 5);
      seam.castShadow = seam.receiveShadow = false;
      cover.add(seam);
    }
    for (const x of [LEFT, RIGHT]) {
      const seam = rod(V(x, y, BACK + .02), V(x, y, FRONT - .02), .006, tape, 5);
      seam.castShadow = seam.receiveShadow = false;
      cover.add(seam);
    }
  }

  const z = FRONT + .014;
  const zipperCurve = new THREE.CatmullRomCurve3([
    V(.015, .37, z), V(.015, 1.18, z), V(.015, 2.55, z), V(.015, 3.69, z),
    V(.10, 3.79, z), V(.63, 3.80, z), V(1.18, 3.79, z), V(1.26, 3.69, z),
    V(1.26, 2.55, z), V(1.26, 1.18, z), V(1.26, .37, z),
  ], false, 'centripetal');
  const zipper = new THREE.Mesh(new THREE.TubeGeometry(zipperCurve, 130, .006, 5, false), zipperMaterial);
  zipper.castShadow = false;
  cover.add(zipper);
  const teeth: THREE.BufferGeometry[] = [];
  const tooth = new THREE.BoxGeometry(.014, .0035, .002);
  for (let index = 0; index < 160; index++) {
    const t = index / 159;
    const position = zipperCurve.getPointAt(t);
    position.z += .004;
    const tangent = zipperCurve.getTangentAt(t);
    const geometry = tooth.clone();
    geometry.rotateZ(Math.atan2(tangent.y, tangent.x) - Math.PI / 2);
    geometry.translate(position.x, position.y, position.z);
    teeth.push(geometry);
  }
  tooth.dispose();
  const teethGeometry = mergeGeometries(teeth, false)!;
  teeth.forEach(geometry => geometry.dispose());
  cover.add(new THREE.Mesh(teethGeometry, tape));
  const slider = roundedBox(.029, .046, .011, .004, zipMetal);
  slider.position.set(.017, 3.65, z + .01);
  slider.castShadow = false;
  cover.add(slider);
  const pull = new THREE.Mesh(new THREE.TorusGeometry(.020, .0035, 5, 16), zipMetal);
  pull.position.set(.017, 3.617, z + .017);
  pull.scale.set(.65, 1, 1);
  cover.add(pull);

  // Faint long fold highlights make the enclosure read as film rather than glass.
  for (const x of [.11, 1.32]) {
    const crease = tube([V(x, .29, FRONT + .009), V(x + .014, 1.25, FRONT + .013), V(x - .013, 2.50, FRONT + .013), V(x, 3.94, FRONT + .009)], .002, tape, 26);
    crease.castShadow = crease.receiveShadow = false;
    cover.add(crease);
  }
  const compacted = compact(cover);
  compacted.visible = false;
  return compacted;
}

function hangingBags() {
  const template = compact(createHangingBag(), true);
  const hemp = new THREE.MeshStandardMaterial({ color: '#b3a07b', roughness: .96 });
  const scale = .51;
  return [3.24,1.83].map((rail,index) => {
    const root = new THREE.Group();
    root.name = `Cultivation bag ${index+1} and short hanging tie`;
    root.userData.component = index===0?'bag':'bag2';
    const bag = index===0?template:template.clone(true);
    bag.name = `Small cultivation bag ${index+1}`;
    bag.userData.component = root.userData.component;
    bag.scale.setScalar(scale);
    const neck = rail-.20;
    bag.position.set(.57,neck-2.22*scale,-.12);
    root.add(bag);
    root.add(tube([
      V(.562,neck,-.12),V(.562,rail-.03,-.066),V(.57,rail+.048,-.10),
      V(.578,rail+.005,-.17),V(.578,neck,-.12),
    ],.0065,hemp,28));
    return root;
  });
}

export function createTent() {
  const [bags,bag2] = hangingBags();
  return { frame: frameStructure(), cover: coverPanels(), bags, bag2 };
}
