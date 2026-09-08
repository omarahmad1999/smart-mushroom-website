import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A handcrafted illustration of a fruiting bag, not a model of observed growth. */
const TAUPE = new THREE.Color('#a79a86');
const STRAW = new THREE.Color('#ad9471');
const MYCELIUM = new THREE.Color('#d2c7ab');
const CREAM = new THREE.Color('#eadfc8');
const CAP_CENTRE = new THREE.Color('#827266');
const CAP_MIDDLE = new THREE.Color('#b4a188');
const CAP_EDGE = new THREE.Color('#e2d2b7');

function randomSequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const PROFILE: [number, number][] = [
  [.58, .015], [.605, .128], [.655, .238], [.755, .303],
  [.90, .321], [1.24, .323], [1.62, .316], [1.82, .301],
  [1.93, .263], [2.02, .183], [2.09, .104], [2.16, .054], [2.225, .041],
];

function radiusAt(y: number) {
  for (let index = 1; index < PROFILE.length; index++) {
    const [highY, highRadius] = PROFILE[index];
    if (y <= highY) {
      const [lowY, lowRadius] = PROFILE[index - 1];
      const t = THREE.MathUtils.clamp((y - lowY) / (highY - lowY), 0, 1);
      const smooth = t * t * (3 - 2 * t);
      return THREE.MathUtils.lerp(lowRadius, highRadius, smooth);
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

function bagPoint(y: number, angle: number, offset = 0) {
  const irregularity = 1 + .014 * Math.sin(angle * 3 + y * 4)
    + .009 * Math.cos(angle * 7 - y * 5);
  const gathered = THREE.MathUtils.smoothstep(y, 1.84, 2.22);
  const fold = Math.cos(angle * 12 + .22 * Math.sin(y * 7)) * .0048 * gathered;
  const radius = radiusAt(y) * irregularity + offset + fold;
  return new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius * .905);
}

function bagSurface(top: number, offset = 0, coloured = false) {
  const around = 56;
  const rows = 46;
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const colour = new THREE.Color();
  for (let row = 0; row <= rows; row++) {
    const y = THREE.MathUtils.lerp(.58, top, row / rows);
    for (let column = 0; column <= around; column++) {
      const angle = column / around * Math.PI * 2;
      const point = bagPoint(y, angle, offset);
      positions.push(point.x, point.y, point.z);
      if (coloured) {
        const organicPatch = Math.sin(angle * 3 + y * 5)
          * Math.sin(angle * 5 - y * 7) * .5 + .5;
        const paleTop = THREE.MathUtils.smoothstep(y, 1.88, 2.06);
        colour.copy(STRAW).lerp(MYCELIUM, .13 + organicPatch * .38 + paleTop * .30);
        colours.push(colour.r, colour.g, colour.b);
      }
      if (row < rows && column < around) {
        const a = row * (around + 1) + column;
        const b = a + around + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (coloured) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function shadowMesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function mergeParts(parts: THREE.BufferGeometry[], material: THREE.Material) {
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  return shadowMesh(geometry, material);
}

function strawChip() {
  const outline = [[-.58, -1], [.58, -.96], [.82, -.15], [.60, .96], [-.39, 1], [-.84, .14]];
  const positions: number[] = [];
  const indices: number[] = [];
  for (const z of [.5, -.5]) {
    for (const [x, y] of outline) positions.push(x, y, z);
  }
  positions.push(0, 0, .6, 0, 0, -.5);
  for (let index = 0; index < outline.length; index++) {
    const next = (index + 1) % outline.length;
    indices.push(12, index, next, 13, next + 6, index + 6);
    indices.push(index, index + 6, next, next, index + 6, next + 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addStraw(group: THREE.Group) {
  const random = randomSequence(439117);
  // Flat irregular straw slivers avoid a raised seed or bead-like surface.
  const geometry = strawChip();
  const material = new THREE.MeshStandardMaterial({ roughness: .97, metalness: 0 });
  const grain = new THREE.InstancedMesh(geometry, material, 635);
  const object = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const palette = ['#c7b28a', '#9c805b', '#bba27b', '#d2bf99', '#ad9069'];
  const colour = new THREE.Color();
  for (let index = 0; index < grain.count; index++) {
    const y = .68 + random() * 1.29;
    const angle = random() * Math.PI * 2;
    object.position.copy(bagPoint(y, angle, .001));
    normal.set(Math.sin(angle), 0, Math.cos(angle));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    object.rotateZ((random() - .5) * Math.PI * 1.6);
    object.scale.set(.005 + random() * .006, .023 + random() * .026, .0018 + random() * .001);
    object.updateMatrix();
    grain.setMatrixAt(index, object.matrix);
    grain.setColorAt(index, colour.set(palette[Math.floor(random() * palette.length)]));
  }
  grain.castShadow = true;
  grain.receiveShadow = true;
  grain.instanceMatrix.needsUpdate = true;
  if (grain.instanceColor) grain.instanceColor.needsUpdate = true;
  group.add(grain);

  // A few finer, lighter strands soften the texture into colonized straw.
  const fibers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 3), material, 90);
  for (let index = 0; index < fibers.count; index++) {
    const y = .74 + random() * 1.20;
    const angle = random() * Math.PI * 2;
    object.position.copy(bagPoint(y, angle, .003));
    normal.set(Math.sin(angle), 0, Math.cos(angle));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    object.rotateZ((random() - .5) * 1.8);
    object.scale.set(.0017, .023 + random() * .028, .0009);
    object.updateMatrix();
    fibers.setMatrixAt(index, object.matrix);
    fibers.setColorAt(index, CREAM);
  }
  fibers.castShadow = false;
  fibers.receiveShadow = true;
  fibers.instanceMatrix.needsUpdate = true;
  if (fibers.instanceColor) fibers.instanceColor.needsUpdate = true;
  group.add(fibers);
}

function capPoint(r: number, angle: number, width: number, depth: number, seed: number) {
  const scallop = 1 + .020 * Math.sin(angle * 7 + seed) + .009 * Math.sin(angle * 13 - seed);
  const asymmetry = 1 + .042 * Math.sin(angle * 2 + seed);
  return new THREE.Vector3(
    Math.sin(angle) * r * width * scallop * asymmetry,
    .018 + .060 * Math.sin(Math.PI * r * .94) - .025 * r * r
      - .012 * THREE.MathUtils.smoothstep(r, .81, 1)
      + .008 * Math.sin(angle * 2 + seed) * r
      + .0028 * Math.sin(angle * 7 + seed) * r * r * r,
    Math.cos(angle) * r * depth * scallop - .022 * r * r,
  );
}

function thickness(r: number) { return .009 + .023 * (1 - r); }

function oysterCap(width: number, depth: number, seed: number) {
  const around = 34;
  const radial = 9;
  const halfAngle = 1.91;
  const stride = around + 1;
  const surfaceSize = (radial + 1) * stride;
  const positions: number[] = [];
  const colours: number[] = [];
  const indices: number[] = [];
  const colour = new THREE.Color();
  for (let underside = 0; underside <= 1; underside++) {
    for (let ring = 0; ring <= radial; ring++) {
      const r = .024 + .976 * ring / radial;
      for (let column = 0; column <= around; column++) {
        const angle = THREE.MathUtils.lerp(-halfAngle, halfAngle, column / around);
        const point = capPoint(r, angle, width, depth, seed);
        if (underside) point.y -= thickness(r);
        positions.push(point.x, point.y, point.z);
        if (underside) {
          colour.copy(CREAM).lerp(TAUPE, .09 + .11 * (1 - r));
        } else {
          colour.copy(CAP_CENTRE).lerp(CAP_MIDDLE, THREE.MathUtils.smoothstep(r, .05, .83));
          colour.lerp(CAP_EDGE, THREE.MathUtils.smoothstep(r, .78, 1));
          colour.multiplyScalar(1 + Math.sin(angle * 3 + seed) * .021);
        }
        colours.push(colour.r, colour.g, colour.b);
        if (ring < radial && column < around) {
          const a = underside * surfaceSize + ring * stride + column;
          const b = a + stride;
          if (underside) indices.push(a, a + 1, b, b, a + 1, b + 1);
          else indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
  }
  const closeEdge = (a: number, b: number) => {
    indices.push(a, a + surfaceSize, b, b, a + surfaceSize, b + surfaceSize);
  };
  for (let column = 0; column < around; column++) {
    closeEdge(radial * stride + column, radial * stride + column + 1);
    closeEdge(column + 1, column);
  }
  for (let ring = 0; ring < radial; ring++) {
    closeEdge(ring * stride, (ring + 1) * stride);
    closeEdge((ring + 1) * stride + around, ring * stride + around);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createOyster(width: number, depth: number, seed: number) {
  const mushroom = new THREE.Group();
  const capMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91, metalness: 0, side: THREE.DoubleSide });
  const creamMaterial = new THREE.MeshStandardMaterial({ color: '#e5d8bd', roughness: .94 });
  mushroom.add(shadowMesh(oysterCap(width, depth, seed), capMaterial));

  // Decurrent gills radiate from the side attachment underneath the oyster fan.
  const gills: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 23; index++) {
    const angle = THREE.MathUtils.lerp(-1.83, 1.83, index / 22);
    const points: THREE.Vector3[] = [];
    const start = index % 2 === 0 ? .12 : .45;
    for (let step = 0; step <= 6; step++) {
      const r = THREE.MathUtils.lerp(start, .965, step / 6);
      const point = capPoint(r, angle + .019 * Math.sin(r * 3 + seed), width, depth, seed);
      point.y -= thickness(r) + .002;
      points.push(point);
    }
    gills.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 7, .00165, 3, false));
  }
  mushroom.add(mergeParts(gills, creamMaterial));
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.008 * Math.sin(seed), -.069, -.073),
    new THREE.Vector3(.012 * Math.sin(seed), -.039, -.042),
    new THREE.Vector3(.004, -.018, -.019),
    new THREE.Vector3(0, .010, .009),
  ]);
  mushroom.add(shadowMesh(new THREE.TubeGeometry(stemCurve, 9, .014 + width * .032, 7, false), creamMaterial));
  return mushroom;
}

function addClusters(group: THREE.Group) {
  type Shelf = [number, number, number, number, number, number, number];
  const clusters: { position: [number, number, number]; turn: number; shelves: Shelf[] }[] = [
    {
      position: [-.105, 1.60, .254], turn: -.19,
      shelves: [
        [-.045, .125, .015, .197, .200, .35, -.15],
        [.078, .060, .042, .184, .188, .23, .22],
        [-.109, -.005, .058, .168, .185, -.20, -.31],
        [.021, -.070, .102, .185, .191, -.39, .06],
        [.120, -.122, .035, .139, .156, -.08, .31],
      ],
    },
    {
      position: [.176, 1.09, .222], turn: .62,
      shelves: [
        [-.037, .103, .012, .174, .176, .36, -.14],
        [.074, .026, .035, .167, .165, -.16, .27],
        [-.075, -.050, .065, .151, .155, -.34, -.24],
        [.032, -.113, .094, .131, .146, -.21, .04],
      ],
    },
    {
      position: [.230, 1.862, .133], turn: .94,
      shelves: [
        [-.028, .034, .013, .113, .125, .24, -.16],
        [.052, -.028, .033, .118, .125, -.16, .25],
        [-.018, -.078, .050, .098, .108, -.36, -.05],
      ],
    },
  ];
  let seed = 0;
  for (const cluster of clusters) {
    const assembly = new THREE.Group();
    assembly.position.set(...cluster.position);
    assembly.rotation.y = cluster.turn;
    for (const [x, y, z, width, depth, tilt, turn] of cluster.shelves) {
      const mushroom = createOyster(width, depth, seed++ * 1.83);
      mushroom.position.set(x, y, z);
      mushroom.rotation.set(tilt, turn, Math.sin(seed * 3) * .09);
      assembly.add(mushroom);
    }
    group.add(assembly);
  }
}

function addGathering(group: THREE.Group) {
  const foldMaterial = new THREE.MeshStandardMaterial({ color: '#ede7d7', roughness: .82, transparent: true, opacity: .42, depthWrite: false });
  const folds: THREE.BufferGeometry[] = [];
  for (let index = 0; index < 12; index++) {
    const angle = index / 12 * Math.PI * 2;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 8; step++) {
      const y = THREE.MathUtils.lerp(1.76 + .07 * Math.sin(index * 2), 2.216, step / 8);
      points.push(bagPoint(y, angle + .025 * Math.sin(step + index), .007));
    }
    folds.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 9, .0035, 4, false));
  }
  // Sparse long creases continue below the shoulder, without glossy striping.
  for (let index = 0; index < 5; index++) {
    const angle = .31 + index * 1.19;
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 13; step++) {
      const y = THREE.MathUtils.lerp(.74 + .035 * Math.sin(index), 1.95, step / 13);
      points.push(bagPoint(y, angle + .035 * Math.sin(y * 5 + index), .007));
    }
    folds.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 15, .0019, 3, false));
  }
  const foldMesh = mergeParts(folds, foldMaterial);
  foldMesh.castShadow = false;
  group.add(foldMesh);

  const neckGeometry = new THREE.CylinderGeometry(.087, .043, .105, 28, 4, true);
  const positions = neckGeometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const y = positions.getY(index);
    const angle = Math.atan2(z, x);
    const pleat = 1 + .20 * Math.sin(angle * 9);
    positions.setXYZ(index, x * pleat, y + .013 * Math.sin(angle * 5) * (y / .105 + .5), z * pleat);
  }
  neckGeometry.computeVertexNormals();
  const looseFilm = shadowMesh(neckGeometry, new THREE.MeshStandardMaterial({ color: '#e5dfcd', roughness: .83, side: THREE.DoubleSide, transparent: true, opacity: .72 }));
  looseFilm.position.y = 2.257;
  looseFilm.castShadow = false;
  group.add(looseFilm);

  const twineMaterial = new THREE.MeshStandardMaterial({ color: '#baa681', roughness: .98 });
  for (const y of [2.201, 2.221]) {
    const tie = shadowMesh(new THREE.TorusGeometry(.049, .010, 6, 28), twineMaterial);
    tie.rotation.x = Math.PI / 2;
    tie.position.y = y;
    group.add(tie);
  }
  const knot = shadowMesh(new THREE.SphereGeometry(1, 10, 7), twineMaterial);
  knot.position.set(.014, 2.213, .054);
  knot.scale.set(.026, .019, .014);
  knot.rotation.z = -.35;
  group.add(knot);
}

/** Bottom y=.58; gathered tie y=2.22. The scene supplies the hanging cord. */
export function createHangingBag(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'handcrafted-oyster-substrate-bag';
  const substrate = shadowMesh(bagSurface(2.095, 0, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .93 }));
  substrate.name = 'colonized-substrate';
  group.add(substrate);
  addStraw(group);

  const film = shadowMesh(bagSurface(2.224, .006), new THREE.MeshPhysicalMaterial({
    color: '#f0e9d7', roughness: .72, metalness: 0, clearcoat: .06,
    transparent: true, opacity: .10, depthWrite: false,
  }));
  film.name = 'subtle-bag-film';
  film.castShadow = false;
  group.add(film);
  addGathering(group);
  const oysters = new THREE.Group();
  oysters.name = 'oyster-clusters';
  oysters.userData.mushrooms = true;
  addClusters(oysters);
  group.add(oysters);
  return group;
}
