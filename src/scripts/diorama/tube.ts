import * as THREE from 'three';

// A frosted glass tube with a thin core of light. A message travels as a bright pulse; the core
// stays softly lit behind it, like ink left on the paper. Moving the light only changes uniforms,
// so a frame costs a few numbers, never new geometry.

const vertex = /* glsl */`
  varying vec2 vUv; varying vec3 vNormal;
  void main() {
    vUv = uv; vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const shared = /* glsl */`
  uniform float uHead, uFill, uPulse, uLength; uniform vec3 uGlow;
  varying vec2 vUv; varying vec3 vNormal;
  // Light around the travelling pulse, and the lit length behind it, measured in world units.
  float pulseAt(float spread) { float d = (vUv.x - uHead) * uLength; return uPulse * exp(-d * d / spread); }
  float filledAt() { return 1.0 - smoothstep(uFill * uLength - .06, uFill * uLength + .06, vUv.x * uLength); }`;

const shellFragment = /* glsl */`
  ${shared}
  void main() {
    vec3 n = normalize(vNormal);
    float facing = abs(n.z), rim = pow(1.0 - facing, 2.0);
    // A soft studio highlight along the top of the tube.
    float shine = pow(max(dot(n, normalize(vec3(-.35, .85, .4))), 0.0), 26.0);
    float pulse = pulseAt(.12), filled = filledAt();
    // Glass on a pale ground reads by its darker edges and a bright highlight; lit, it glows warm throughout.
    vec3 glass = mix(vec3(.975, .96, .935), vec3(.72, .69, .64), rim);
    vec3 warm = mix(vec3(1.0, .88, .7), uGlow, .55);
    vec3 color = glass + vec3(1.0) * shine * .95 + warm * (filled * .42 + pulse * 1.6) * (.45 + facing * .75);
    float alpha = clamp(.3 + rim * .5 + shine * .55 + (filled * .3 + pulse * .6) * facing, 0.0, .96);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const coreFragment = /* glsl */`
  ${shared}
  void main() {
    float lit = filledAt(), pulse = pulseAt(.035);
    vec3 idle = vec3(.8, .77, .72), warm = mix(vec3(1.0, .86, .66), uGlow, .6) * 1.25;
    vec3 color = mix(idle, warm, lit) + uGlow * pulse * 4.5;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** A tube through the given points, with rounded elbows where it turns. */
function route(points: THREE.Vector3[], bend = .34) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let from = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i], before = corner.clone().sub(from), after = points[i + 1].clone().sub(corner);
    const radius = Math.min(bend, before.length() / 2, after.length() / 2);
    const enter = corner.clone().sub(before.normalize().multiplyScalar(radius)), leave = corner.clone().add(after.normalize().multiplyScalar(radius));
    path.add(new THREE.LineCurve3(from, enter)); path.add(new THREE.QuadraticBezierCurve3(enter, corner, leave));
    from = leave;
  }
  path.add(new THREE.LineCurve3(from, points.at(-1)!));
  return path;
}

export type Tube = ReturnType<typeof createTube>;
export function createTube(points: THREE.Vector3[], glow: THREE.Color, radius = .15) {
  const path = route(points), length = path.getLength();
  const segments = Math.max(16, Math.ceil(length * 22));
  const uniforms = { uHead: { value: 0 }, uFill: { value: 0 }, uPulse: { value: 0 }, uLength: { value: length }, uGlow: { value: glow } };
  const shell = new THREE.Mesh(new THREE.TubeGeometry(path, segments, radius, 18, false),
    new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: shellFragment, transparent: true, depthWrite: false }));
  const core = new THREE.Mesh(new THREE.TubeGeometry(path, segments, radius * .34, 10, false),
    new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: coreFragment }));
  shell.renderOrder = 2; shell.castShadow = true;
  // The message itself: a small bright bead that rides the core.
  const bead = new THREE.Mesh(new THREE.SphereGeometry(radius * .5, 16, 12), new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(3.2) }));
  bead.visible = false;
  const group = new THREE.Group();
  group.add(core, bead, shell);
  const point = new THREE.Vector3();
  return {
    group, path, length,
    /** head: where the message is (0–1); fill: how much of the tube is lit; pulse: the message's brightness. */
    set(head: number, fill: number, pulse: number) {
      uniforms.uHead.value = head; uniforms.uFill.value = fill; uniforms.uPulse.value = pulse;
      bead.visible = pulse > .02;
      if (bead.visible) { bead.position.copy(path.getPointAt(Math.min(1, Math.max(0, head)), point)); bead.scale.setScalar(.6 + .4 * pulse); }
    },
    pointAt: (t: number) => path.getPointAt(Math.min(1, Math.max(0, t)), new THREE.Vector3()),
    dispose() { for (const mesh of [shell, core, bead]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } },
  };
}
