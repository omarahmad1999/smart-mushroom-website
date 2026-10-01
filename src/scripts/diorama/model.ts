import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createEnergy, type EnergyTube } from './energy';
import { createBeam, createGlow, createMist, type Glow, type Mist } from './effects';
import { chartPainter, printTexture, timelapsePainter, type Painter } from './painters';
import type { CaseIcon, DioramaPart } from './paths';

// The diorama as modelled and lit in Blender (tools/diorama/scene.py). Everything that stays still carries its
// studio light in one baked texture, so it costs almost nothing to draw; the parts that move or change are
// exported separately and given live materials here: glass, the icons' fills, the energy in the tubes, the
// database's seams, the gate's glow, the screens, and the devices' light, mist and flashes.
// Each object's role travels with it from Blender as `userData.role`.

const glassVertex = /* glsl */`
  varying vec3 vNormal;
  void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const glassFragment = /* glsl */`
  uniform float uClarity;
  varying vec3 vNormal;
  void main() {
    vec3 n = normalize(vNormal);
    float facing = abs(n.z), rim = pow(1.0 - facing, 1.6);
    // Glass on pale paper reads by darker edges and bright glints; the highlight comes from the upper left, as in the bake.
    float shine = pow(max(dot(n, normalize(vec3(-.4, .8, .45))), 0.0), 22.0);
    vec3 color = mix(vec3(.985, .975, .955), vec3(.6, .56, .5), rim) + vec3(1.0) * shine * 1.2;
    gl_FragColor = vec4(color, clamp(uClarity + rim * .62 + shine * .7, 0.0, .92));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const glass = (clarity: number) => new THREE.ShaderMaterial({ uniforms: { uClarity: { value: clarity } }, vertexShader: glassVertex, fragmentShader: glassFragment, transparent: true, depthWrite: false });

/** How soft each kind of fill's surface is, and how much it moves: liquid ripples, gas is diffuse, ink is crisp. */
const feels = { liquid: { edge: .012, wave: 1 }, gas: { edge: .09, wave: .4 }, ink: { edge: .008, wave: 0 }, solid: { edge: .01, wave: 0 } };
export type Fill = ReturnType<typeof fillMaterial>;
/** An icon's inside, coloured up to a level measured along its own height (or round its dial), with a gently
 *  moving surface. `bounds` is the icon's extent in its own coordinates: Blender's up arrives as -z, across as x. */
function fillMaterial(icon: CaseIcon, bounds: THREE.Box3) {
  const { edge, wave } = feels[icon.feel ?? 'solid'], from = icon.from ?? 'bottom';
  const uniforms = {
    uLevel: { value: 0 }, uTime: { value: 0 }, uFull: { value: new THREE.Color(icon.color) },
    uBottom: { value: -bounds.max.z }, uTop: { value: -bounds.min.z },
    uCentre: { value: new THREE.Vector2((bounds.min.x + bounds.max.x) / 2, -(bounds.min.z + bounds.max.z) / 2) },
  };
  const E = edge.toFixed(3);
  const measure = from === 'sweep'
    // Clockwise from twelve o'clock, as a share of a full turn; the level runs a hair past 1 so a full dial closes.
    ? `vec2 d = vec2(vIcon.x, -vIcon.z) - uCentre;
       float share = mod(atan(d.x, d.y), 6.2831853) / 6.2831853;
       float filled = (1.0 - smoothstep(uLevel * 1.03 - ${E}, uLevel * 1.03 + ${E}, share)) * step(.001, uLevel);`
    : `float along = (-vIcon.z - uBottom) / (uTop - uBottom);
       float surface = ${from === 'top' ? '1.0 - uLevel' : 'uLevel'} + ${wave.toFixed(2)} * .018 * sin(vIcon.x * 60.0 + uTime * 5.0) * step(.001, uLevel) * step(uLevel, .999);
       float filled = ${from === 'top' ? `smoothstep(surface - ${E}, surface + ${E}, along)` : `1.0 - smoothstep(surface - ${E}, surface + ${E}, along)`};`;
  const material = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: .38, envMapIntensity: .9 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIcon;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIcon = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uLevel, uTime, uBottom, uTop; uniform vec2 uCentre; uniform vec3 uFull; varying vec3 vIcon;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `${measure}
      vec4 diffuseColor = vec4(mix(diffuse, uFull, filled), opacity);`)
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + uFull * filled * .22;');
  };
  // Each way of filling compiles its own program: three.js would otherwise share the first one it built.
  material.customProgramCacheKey = () => `fill:${from}:${E}:${wave}`;
  return { material, set(level: number, time = 0) { uniforms.uLevel.value = level; uniforms.uTime.value = time; } };
}

/** The straight line a tube follows, as Blender recorded it on the tube or the node holding it. */
function tubeLine(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    const data = node.userData;
    if (data.start) return data as { start: [number, number, number]; end: [number, number, number]; radius: number };
  }
}
const roleOf = (object: THREE.Object3D) => { for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node.userData.role) return node.userData.role as string; return ''; };
/** The node that carries the role: a mesh with several materials arrives as a group of meshes under it. */
const ownerOf = (object: THREE.Object3D) => { for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node.userData.role) return node; return object; };
const centreOf = (object: THREE.Object3D) => new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());

/** A part that turns about a fixed axis through its middle: the valve's wheel, the fan's blades. */
export type Spinner = { object: THREE.Object3D; set(angle: number): void };
function spinner(object: THREE.Object3D, axis: THREE.Vector3): Spinner {
  const base = object.quaternion.clone(), turn = new THREE.Quaternion();
  return { object, set(angle) { object.quaternion.copy(turn.setFromAxisAngle(axis, angle)).multiply(base); } };
}

export type Model = Awaited<ReturnType<typeof loadModel>>;
export async function loadModel(base: string, parts: DioramaPart[], glowColor: string, seamColor: string) {
  const textures = new THREE.TextureLoader();
  const [gltf, atlas, floor] = await Promise.all([new GLTFLoader().loadAsync(`${base}.glb`), textures.loadAsync(`${base}-atlas.webp`), textures.loadAsync(`${base}-ground.webp`)]);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.flipY = false; atlas.anisotropy = 4;
  floor.flipY = false;
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  // The bake already holds the studio's light and its colour grading, so it is drawn as it is.
  const baked = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false });
  const ink = new THREE.MeshStandardMaterial({ color: '#2e3b36', roughness: .45 });
  const idleSeam = new THREE.Color('#cfc8bb'), litSeam = new THREE.Color(seamColor);
  const byId = new Map(parts.map(part => [part.id, part]));
  const extras: { dispose(): void }[] = [];
  const model = {
    root,
    tubes: new Map<string, EnergyTube>(),
    fills: new Map<string, Fill>(),
    seams: [] as THREE.MeshBasicMaterial[], idleSeam, litSeam,
    /** Python badges, with where each stands, so only the answering part's badge hops. */
    python: [] as { object: THREE.Object3D; at: THREE.Vector3 }[],
    gateGlow: undefined as THREE.MeshStandardMaterial | undefined,
    spinners: new Map<string, Spinner>(),
    screens: new Map<string, Painter>(),
    /** Each LED bar's diffuser and the pool of light it throws on its platform. */
    lights: new Map<string, { material: THREE.MeshStandardMaterial; pool: Glow; beam: Glow }>(),
    mists: new Map<string, Mist>(),
    /** The cameras' lenses, each with its flash. */
    lenses: [] as { material: THREE.MeshStandardMaterial; flash: Glow }[],
    /** Photographs that arrive in image storage, in the order they land. */
    prints: [] as THREE.Group[],
    dispose() {
      root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
      atlas.dispose(); floor.dispose();
      for (const painter of model.screens.values()) painter.texture.dispose();
      for (const tube of model.tubes.values()) tube.dispose();
      for (const extra of extras) extra.dispose();
    },
  };
  // Icon outlines give each fill its extent.
  const bounds = new Map<string, THREE.Box3>();
  root.traverse(object => {
    const role = roleOf(object);
    if (object instanceof THREE.Mesh && role.startsWith('live:icon-line:')) { object.geometry.computeBoundingBox(); bounds.set(role.split(':')[2], object.geometry.boundingBox!.clone()); }
  });
  const tubes: [string, THREE.Mesh][] = [], nozzles: [string, THREE.Mesh][] = [], prints = new Map<number, THREE.Mesh[]>();
  const firstOf = (prop: string) => parts.find(part => part.prop === prop)?.id ?? '';
  root.traverse(object => {
    const role = roleOf(object);
    if (role.startsWith('live:tube:') && object instanceof THREE.Mesh && tubeLine(object)) tubes.push([role.split(':')[2], object]);
    if (!(object instanceof THREE.Mesh)) return;
    const [kind, , id = ''] = role.split(':');
    const live = kind === 'live' ? role.split(':')[1] : '';
    if (role === 'baked' || role === 'wheel' || kind === 'spin') object.material = baked;
    // Observe's model names its valve's wheel; newer models name each spinning part and the axis it turns about.
    const turning = ownerOf(object);
    if (role === 'wheel' && !model.spinners.has(firstOf('valve'))) model.spinners.set(firstOf('valve'), spinner(turning, new THREE.Vector3(0, 1, 0)));
    if (kind === 'spin' && !model.spinners.has(role.split(':')[1])) model.spinners.set(role.split(':')[1], spinner(turning, new THREE.Vector3(...(turning.userData.axis as [number, number, number])).normalize()));
    if (live === 'ground') { object.material = new THREE.MeshBasicMaterial({ color: '#3a2c1c', alphaMap: floor, transparent: true, depthWrite: false, opacity: .9 }); object.renderOrder = -1; }
    if (live === 'glass-box') { object.material = glass(.06); object.renderOrder = 3; }
    if (live === 'icon-line' || live === 'co2') object.material = ink;
    if (live === 'icon-fill') {
      const icon = byId.get(id)?.icon;
      if (icon) { const fill = fillMaterial(icon, bounds.get(id) ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1))); object.material = fill.material; model.fills.set(id, fill); }
    }
    if (live === 'python-blue' || live === 'python-yellow') { object.material = new THREE.MeshStandardMaterial({ color: live === 'python-blue' ? '#3776AB' : '#FFD43B', roughness: .35 }); model.python.push({ object, at: centreOf(object) }); }
    // Seams keep their place in the stack (0 is the lowest), so they can light from the bottom up.
    if (live === 'seam') { const material = new THREE.MeshBasicMaterial({ color: idleSeam.clone() }); object.material = material; model.seams[Number(id)] = material; }
    // The gate's inner lining is teal enamel like the rest of the arch until its turn, when it shines like the tubes.
    if (live === 'gate-glow') { model.gateGlow = new THREE.MeshStandardMaterial({ color: '#1D302F', roughness: .3, emissive: glowColor, emissiveIntensity: 0 }); object.material = model.gateGlow; }
    if (live === 'screen-face') {
      // Grafana draws its chart; media preparation plays its timelapse.
      const owner = id || firstOf('screen'), painter = byId.get(owner)?.action === 'film' ? timelapsePainter(glowColor) : chartPainter(glowColor);
      object.material = new THREE.MeshBasicMaterial({ map: painter.texture, toneMapped: false }); model.screens.set(owner, painter);
    }
    if (live === 'led') {
      // Warm light, saturated enough to read against the pale paper.
      const material = new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: .35, emissive: '#ffb45c', emissiveIntensity: 0 });
      object.material = material;
      const bar = centreOf(object), pool = createGlow(bar.clone().setY(.43), '#ffb04d', 1.5, true);
      const beam = createBeam(bar.clone().setY(bar.y - .05), bar.clone().setY(.5), 1.2, '#ffc070');
      root.add(pool.object, beam.object); extras.push(pool, beam); model.lights.set(id, { material, pool, beam });
    }
    if (live === 'nozzle') nozzles.push([id, object]);
    if (live === 'lens') {
      const material = new THREE.MeshStandardMaterial({ color: '#26323a', roughness: .08, emissive: '#ffffff', emissiveIntensity: 0 });
      object.material = material;
      const flash = createGlow(centreOf(object), '#fffaf0', .9);
      root.add(flash.object); extras.push(flash); model.lenses.push({ material, flash });
    }
    if (live === 'photo' || live === 'photo-face') {
      const index = Number(id);
      object.material = live === 'photo' ? new THREE.MeshStandardMaterial({ color: '#fbf8f2', roughness: .45 }) : new THREE.MeshBasicMaterial({ map: printTexture(index), toneMapped: false });
      prints.set(index, [...prints.get(index) ?? [], object]);
    }
  });
  // Mist leaves where Blender marked the nozzle; the marker itself is not drawn.
  for (const [id, marker] of nozzles) {
    marker.visible = false;
    const mist = createMist(centreOf(marker));
    root.add(mist.group); extras.push(mist); model.mists.set(id, mist);
  }
  // Each arriving print's paper and picture move together.
  for (const index of [...prints.keys()].sort()) {
    const holder = new THREE.Group();
    root.add(holder);
    for (const piece of prints.get(index)!) holder.attach(piece);
    model.prints.push(holder);
  }
  // Each glass tube gets its core of light, along the line Blender recorded for it.
  for (const [link, shell] of tubes) {
    const line = tubeLine(shell)!;
    const energy = createEnergy(shell, new THREE.Vector3(...line.start), new THREE.Vector3(...line.end), line.radius, new THREE.Color(glowColor));
    root.add(energy.group); model.tubes.set(link, energy);
  }
  return model;
}
