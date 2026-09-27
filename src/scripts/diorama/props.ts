import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

// Studio props for the dioramas: cream platforms, raised icon tiles and a few hero objects.
// Everything is built from simple shapes and the site's Phosphor icons, so it stays light.

export const TOP = .34;
export type Materials = ReturnType<typeof createMaterials>;
export function createMaterials(accent: THREE.Color) {
  const standard = (color: string, roughness: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    base: standard('#e2d4bd', .78), top: standard('#f8f1e4', .6), tile: standard('#fdfbf7', .42),
    ink: standard('#2e3b36', .5), wash: new THREE.MeshStandardMaterial({ color: new THREE.Color('#f4efe6').lerp(accent, .42), roughness: .62 }),
    metal: Object.assign(standard('#eceef0', .24, .72), { envMapIntensity: 2.2 }), darkMetal: Object.assign(standard('#b3b8ba', .3, .75), { envMapIntensity: 1.8 }), screen: standard('#3a4541', .42, .2),
    accent,
  };
}
const box = (w: number, h: number, d: number, radius: number, material: THREE.Material) => {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, radius), material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
};
function roundedRect(size: number, radius: number) {
  const shape = new THREE.Shape(), h = size / 2;
  shape.moveTo(-h + radius, -h); shape.lineTo(h - radius, -h); shape.quadraticCurveTo(h, -h, h, -h + radius);
  shape.lineTo(h, h - radius); shape.quadraticCurveTo(h, h, h - radius, h); shape.lineTo(-h + radius, h);
  shape.quadraticCurveTo(-h, h, -h, h - radius); shape.lineTo(-h, -h + radius); shape.quadraticCurveTo(-h, -h, -h + radius, -h);
  return shape;
}

/** A two-layer platform whose top edge lights up when a message arrives. */
export function createPlatform(size: number, materials: Materials) {
  const group = new THREE.Group();
  const base = box(size, .22, size, .08, materials.base); base.position.y = .11;
  const top = box(size * .9, .14, size * .9, .07, materials.top); top.position.y = .27;
  const outline = roundedRect(size * .9 + .03, .1); outline.holes.push(new THREE.Path(roundedRect(size * .9 - .05, .07).getPoints(24).reverse()));
  const glow = new THREE.MeshBasicMaterial({ color: materials.accent.clone().multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.ShapeGeometry(outline, 12), glow);
  ring.rotation.x = -Math.PI / 2; ring.position.y = TOP + .004; ring.renderOrder = 1;
  // A warm pool of light on the ground shows a part that has received its message.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.1, size * 2.1), new THREE.MeshBasicMaterial({ map: softSpot(), color: materials.accent, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = .003;
  group.add(contact(size * 1.5), pool, base, top, ring);
  return { group, glow, pool: pool.material as THREE.MeshBasicMaterial };
}
/** A radial fade, shared by the contact shadows and the pools of light. */
let spot: THREE.CanvasTexture | undefined;
export function softSpot() {
  if (spot) return spot;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!, gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(.45, 'rgba(255,255,255,.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
  return spot = new THREE.CanvasTexture(canvas);
}
/** Soft contact shadow under an object, where the key light's shadow alone looks too crisp. */
export function contact(size: number, strength = .32) {
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: softSpot(), color: '#5a4630', transparent: true, opacity: strength, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .002;
  return shadow;
}

/** A Phosphor duotone icon raised off a surface: the line in ink, the translucent layer as a tinted inlay. */
const loader = new SVGLoader();
export function createIcon(raw: string, size: number, materials: Materials) {
  const icon = new THREE.Group(), flat = new THREE.Group(), scale = size / 256;
  for (const path of loader.parse(raw).paths) {
    const wash = ((path.userData as { style?: { opacity?: number } } | undefined)?.style?.opacity ?? 1) < 1;
    const geometry = new THREE.ExtrudeGeometry(SVGLoader.createShapes(path), { depth: wash ? 7 : 16, bevelEnabled: false, curveSegments: 8 });
    const mesh = new THREE.Mesh(geometry, wash ? materials.wash : materials.ink);
    mesh.castShadow = !wash;
    flat.add(mesh);
  }
  // SVG runs downwards: flip it, centre it, lay it flat and turn it to face the camera's diagonal.
  flat.scale.set(scale, -scale, scale); flat.position.set(-size / 2, size / 2, 0);
  const lying = new THREE.Group(); lying.add(flat); lying.rotation.x = -Math.PI / 2;
  icon.add(lying); icon.rotation.y = Math.PI / 4;
  return icon;
}

/** A raised tile carrying an icon: the sensors and the database writer. */
export function createTile(raw: string, materials: Materials, size = .74) {
  const group = new THREE.Group();
  const tile = box(size, .12, size, .06, materials.tile); tile.position.y = .06;
  const icon = createIcon(raw, size * .74, materials); icon.position.y = .12;
  group.add(tile, icon); group.position.y = TOP;
  return group;
}

/** The junction where two readings merge: a small metal valve with a cross wheel. */
export function createValve(materials: Materials) {
  const group = new THREE.Group();
  const body = box(.56, .34, .56, .1, materials.metal); body.position.y = .17;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .1, 20), materials.darkMetal); hub.position.y = .38; hub.castShadow = true;
  const wheel = new THREE.Group(); wheel.position.y = .42;
  for (const angle of [Math.PI / 4, -Math.PI / 4]) { const spoke = box(.42, .045, .07, .02, materials.darkMetal); spoke.rotation.y = angle; wheel.add(spoke); }
  group.add(contact(.95, .4), body, hub, wheel);
  return { group, wheel };
}

function textPlate(text: string, width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = Math.round(256 * height / width);
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#eef0ef'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#34413c'; context.font = `600 ${Math.round(canvas.height * .56)}px "DM Sans", sans-serif`;
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.letterSpacing = '6px';
  context.fillText(text, canvas.width / 2, canvas.height * .54);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .5 }));
}
/** Mosquitto: a metal gate every message passes through. Its inner frame glows as one does. */
export function createGate(materials: Materials) {
  const group = new THREE.Group(); group.position.y = TOP;
  const span = .58, height = 1.02;
  for (const side of [-1, 1]) { const pillar = box(.22, height, .2, .06, materials.metal); pillar.position.set(0, height / 2, side * span); group.add(pillar); }
  const beam = box(.3, .22, span * 2 + .22, .07, materials.metal); beam.position.y = height + .08; group.add(beam);
  const plate = textPlate('MQTT', .86, .15); plate.rotation.y = Math.PI / 2; plate.position.set(.152, height + .08, 0); group.add(plate);
  const glow = new THREE.MeshBasicMaterial({ color: materials.accent.clone().multiplyScalar(1.6), transparent: true, opacity: .15 });
  for (const side of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(.05, height - .06, .02), glow); strip.position.set(0, height / 2, side * (span - .11)); group.add(strip); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(.05, .02, span * 2 - .2), glow); lintel.position.set(0, height - .04, 0); group.add(lintel);
  return { group, glow };
}

/** TimescaleDB: a stack of discs. Each stored message lights the seams between them, bottom to top. */
export function createStack(materials: Materials) {
  const group = new THREE.Group(); group.position.y = TOP;
  const seams: THREE.MeshBasicMaterial[] = [];
  const disc = new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(.42, 0), new THREE.Vector2(.46, .03), new THREE.Vector2(.46, .1), new THREE.Vector2(.42, .13), new THREE.Vector2(0, .13)], 48);
  for (let i = 0; i < 4; i++) {
    const layer = new THREE.Mesh(disc, materials.tile); layer.position.y = i * .17; layer.castShadow = layer.receiveShadow = true; group.add(layer);
    if (i === 3) continue;
    const seam = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfc8bb') });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.435, .435, .04, 48, 1, true), seam); ring.position.y = i * .17 + .15; group.add(ring);
    seams.push(seam);
  }
  return { group, seams };
}

/** Grafana: a small screen whose chart draws as the stored measurements arrive. */
export function createScreen(materials: Materials) {
  const group = new THREE.Group(); group.position.y = TOP; group.rotation.y = Math.PI / 4;
  const stand = box(.46, .05, .3, .025, materials.metal); stand.position.y = .025;
  const neck = box(.08, .34, .06, .03, materials.metal); neck.position.set(0, .2, -.04);
  const body = box(1.12, .72, .07, .04, materials.screen); body.position.set(0, .7, 0); body.rotation.x = -.14;
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 200;
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.02, .62), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  face.position.set(0, 0, .037); body.add(face);
  group.add(stand, neck, body);
  const context = canvas.getContext('2d')!, accent = `#${materials.accent.getHexString(THREE.SRGBColorSpace)}`;
  const points = [.62, .55, .6, .44, .5, .36, .41, .28, .33, .24];
  /** Draws the dashboard with its line shown up to `progress` (0–1) and the screen lit by `light`. */
  function draw(progress: number, light: number) {
    context.fillStyle = light > 0 ? '#1e2724' : '#161c1a'; context.fillRect(0, 0, 320, 200);
    context.globalAlpha = .25 + .75 * light;
    context.fillStyle = '#2b3733'; for (const [x, w] of [[16, 90], [120, 60]]) context.fillRect(x, 14, w, 10);
    context.strokeStyle = '#34423d'; context.lineWidth = 1;
    for (let y = 56; y < 190; y += 32) { context.beginPath(); context.moveTo(16, y); context.lineTo(304, y); context.stroke(); }
    if (progress > 0) {
      context.strokeStyle = accent; context.lineWidth = 5; context.lineJoin = context.lineCap = 'round';
      context.beginPath();
      const total = (points.length - 1) * progress;
      points.forEach((value, i) => {
        if (i > Math.ceil(total)) return;
        const t = Math.min(1, total - (i - 1)), x = 20 + i * 31, y = 40 + value * 200;
        if (i === 0) context.moveTo(x, y);
        else { const px = 20 + (i - 1) * 31, py = 40 + points[i - 1] * 200; context.lineTo(px + (x - px) * t, py + (y - py) * t); }
      });
      context.stroke();
    }
    context.globalAlpha = 1; texture.needsUpdate = true;
  }
  draw(0, 0);
  return { group, draw };
}
