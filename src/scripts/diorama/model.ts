import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createEnergy, type EnergyTube } from './energy';

// The diorama as modelled and lit in Blender (tools/diorama/scene.py). Everything that stays still carries its
// studio light in one baked texture, so it costs almost nothing to draw; the parts that move or change are
// exported separately and given live materials here: glass, the icons' fills, the energy in the tubes, the
// database's seams, the gate's glow and the screen. Each object's role travels with it from Blender as `userData.role`.

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

/** How each icon fills: its colour, from which end, and how soft its surface is (liquid, gas or ink). */
const fills: Record<string, { color: string; downwards: boolean; edge: number; wave: number }> = {
  sht31: { color: '#e5484d', downwards: false, edge: .012, wave: 1 },
  scd41: { color: '#8ea3ad', downwards: false, edge: .09, wave: .4 },
  writer: { color: '#2E8565', downwards: true, edge: .008, wave: 0 },
};
export type Fill = ReturnType<typeof fillMaterial>;
/** An icon's inside, coloured up to a level measured along its own height, with a gently moving surface. */
function fillMaterial(id: string, bottom: number, top: number) {
  const style = fills[id];
  const uniforms = { uLevel: { value: 0 }, uTime: { value: 0 }, uFull: { value: new THREE.Color(style.color) }, uBottom: { value: bottom }, uTop: { value: top } };
  const material = new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: .38, envMapIntensity: .9 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vIcon;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIcon = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uLevel, uTime, uBottom, uTop; uniform vec3 uFull; varying vec3 vIcon;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      // Blender's up for the icon arrives as -z here; its across is x.
      float along = (-vIcon.z - uBottom) / (uTop - uBottom);
      float surface = ${style.downwards ? '1.0 - uLevel' : 'uLevel'} + ${style.wave.toFixed(2)} * .018 * sin(vIcon.x * 60.0 + uTime * 5.0) * step(.001, uLevel) * step(uLevel, .999);
      float filled = ${style.downwards ? 'smoothstep(surface - EDGE, surface + EDGE, along)' : '1.0 - smoothstep(surface - EDGE, surface + EDGE, along)'};
      vec4 diffuseColor = vec4(mix(diffuse, uFull, filled), opacity);`.replaceAll('EDGE', style.edge.toFixed(3)))
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + uFull * filled * .22;');
  };
  return { material, set(level: number, time = 0) { uniforms.uLevel.value = level; uniforms.uTime.value = time; } };
}

/** Grafana's screen: a small dashboard whose line draws as the stored measurements arrive. */
function screenPainter(accent: string) {
  const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 296;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  // The screen's UVs come from the model, which counts rows the other way up.
  texture.flipY = false;
  const context = canvas.getContext('2d')!;
  const points = [.62, .55, .6, .44, .5, .36, .41, .28, .33, .24];
  function draw(progress: number, light: number) {
    const w = canvas.width, h = canvas.height;
    context.fillStyle = light > 0 ? '#1e2a26' : '#141a18'; context.fillRect(0, 0, w, h);
    context.globalAlpha = .2 + .8 * light;
    context.fillStyle = '#2b3834'; for (const [x, width] of [[24, 130], [170, 80]]) context.fillRect(x, 22, width, 14);
    context.strokeStyle = '#33423d'; context.lineWidth = 1.5;
    for (let y = 84; y < h - 10; y += 46) { context.beginPath(); context.moveTo(24, y); context.lineTo(w - 24, y); context.stroke(); }
    if (progress > 0) {
      context.strokeStyle = accent; context.lineWidth = 7; context.lineJoin = context.lineCap = 'round';
      context.beginPath();
      const total = (points.length - 1) * progress, step = (w - 60) / (points.length - 1);
      points.forEach((value, i) => {
        if (i > Math.ceil(total)) return;
        const t = Math.min(1, total - (i - 1)), x = 30 + i * step, y = 56 + value * 300;
        if (i === 0) context.moveTo(x, y);
        else { const px = 30 + (i - 1) * step, py = 56 + points[i - 1] * 300; context.lineTo(px + (x - px) * t, py + (y - py) * t); }
      });
      context.stroke();
    }
    context.globalAlpha = 1; texture.needsUpdate = true;
  }
  draw(0, 0);
  return { texture, draw };
}

/** The straight line a tube follows, as Blender recorded it on the tube or the node holding it. */
function tubeLine(object: THREE.Object3D) {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) {
    const data = node.userData;
    if (data.start) return data as { start: [number, number, number]; end: [number, number, number]; radius: number };
  }
}
const roleOf = (object: THREE.Object3D) => { for (let node: THREE.Object3D | null = object; node; node = node.parent) if (node.userData.role) return node.userData.role as string; return ''; };

export type Model = Awaited<ReturnType<typeof loadModel>>;
export async function loadModel(base: string, glowColor: string, seamColor: string) {
  const textures = new THREE.TextureLoader();
  const [gltf, atlas, floor] = await Promise.all([new GLTFLoader().loadAsync(`${base}.glb`), textures.loadAsync(`${base}-atlas.webp`), textures.loadAsync(`${base}-ground.webp`)]);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.flipY = false; atlas.anisotropy = 4;
  floor.flipY = false;
  const root = gltf.scene;
  // The bake already holds the studio's light and its colour grading, so it is drawn as it is.
  const baked = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false });
  const ink = new THREE.MeshStandardMaterial({ color: '#2e3b36', roughness: .45 });
  const idleSeam = new THREE.Color('#cfc8bb'), litSeam = new THREE.Color(seamColor);
  const screen = screenPainter(glowColor);
  const model = {
    root, screen,
    tubes: new Map<string, EnergyTube>(),
    fills: new Map<string, ReturnType<typeof fillMaterial>>(),
    seams: [] as THREE.MeshBasicMaterial[], idleSeam, litSeam,
    python: [] as THREE.Object3D[],
    gateGlow: undefined as THREE.MeshStandardMaterial | undefined,
    wheel: undefined as THREE.Object3D | undefined,
    dispose() {
      root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); } });
      atlas.dispose(); floor.dispose(); screen.texture.dispose();
      for (const tube of model.tubes.values()) tube.dispose();
    },
  };
  // Icon outlines give each fill its height range.
  const heights = new Map<string, [number, number]>();
  root.traverse(object => {
    const role = roleOf(object);
    if (object instanceof THREE.Mesh && role.startsWith('live:icon-line:')) {
      object.geometry.computeBoundingBox();
      const box = object.geometry.boundingBox!;
      heights.set(role.split(':')[2], [-box.max.z, -box.min.z]);
    }
  });
  const tubes: [string, THREE.Mesh][] = [];
  root.traverse(object => {
    const role = roleOf(object);
    if (role.startsWith('live:tube:') && object instanceof THREE.Mesh && tubeLine(object)) tubes.push([role.split(':')[2], object]);
    if (!(object instanceof THREE.Mesh)) return;
    const [kind, , id] = role.split(':');
    const live = kind === 'live' ? role.split(':')[1] : '';
    if (role === 'baked' || role === 'wheel') object.material = baked;
    if (role === 'wheel') model.wheel = object;
    if (live === 'ground') { object.material = new THREE.MeshBasicMaterial({ color: '#3a2c1c', alphaMap: floor, transparent: true, depthWrite: false, opacity: .9 }); object.renderOrder = -1; }
    if (live === 'glass-box') { object.material = glass(.06); object.renderOrder = 3; }
    if (live === 'icon-line' || live === 'co2') object.material = ink;
    if (live === 'icon-fill') { const [bottom, top] = heights.get(id) ?? [0, 1], fill = fillMaterial(id, bottom, top); object.material = fill.material; model.fills.set(id, fill); }
    if (live === 'python-blue' || live === 'python-yellow') { object.material = new THREE.MeshStandardMaterial({ color: live === 'python-blue' ? '#3776AB' : '#FFD43B', roughness: .35 }); model.python.push(object); }
    // Seams keep their place in the stack (0 is the lowest), so they can light from the bottom up.
    if (live === 'seam') { const material = new THREE.MeshBasicMaterial({ color: idleSeam.clone() }); object.material = material; model.seams[Number(id)] = material; }
    // The gate's inner lining is teal enamel like the rest of the arch until its turn, when it shines like the tubes.
    if (live === 'gate-glow') { model.gateGlow = new THREE.MeshStandardMaterial({ color: '#1D302F', roughness: .3, emissive: glowColor, emissiveIntensity: 0 }); object.material = model.gateGlow; }
    if (live === 'screen-face') object.material = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false });
  });
  // Each glass tube gets its core of light, along the line Blender recorded for it.
  for (const [link, shell] of tubes) {
    const line = tubeLine(shell)!;
    const energy = createEnergy(shell, new THREE.Vector3(...line.start), new THREE.Vector3(...line.end), line.radius, new THREE.Color(glowColor));
    root.add(energy.group); model.tubes.set(link, energy);
  }
  return model;
}
