import * as THREE from 'three';

// Energy in a glass tube: a thin core of light runs the tube's length. A message travels as a bright pulse
// with a bead at its head; behind it the core stays lit and the glass keeps a warm glow, like ink left on the
// paper. Moving the energy only changes a few uniforms, so a frame never rebuilds geometry.

const coreVertex = /* glsl */`
  uniform float uLength;
  varying float vAlong;
  void main() { vAlong = position.y / uLength + .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const shared = /* glsl */`
  uniform float uHead, uFill, uPulse, uLength; uniform vec3 uGlow;
  // Light around the travelling pulse, and the lit length behind it, measured in world units along the tube.
  float pulseAt(float along, float spread) { float d = (along - uHead) * uLength; return uPulse * exp(-d * d / spread); }
  float filledAt(float along) { return 1.0 - smoothstep(uFill * uLength - .06, uFill * uLength + .06, along * uLength); }`;
const coreFragment = /* glsl */`
  ${shared}
  varying float vAlong;
  void main() {
    // Lit, the core shines as Blender's does (the accent at emission 2.4), so the live beam matches the still.
    // The message itself is a brighter, still orange, head: pushed much further it would bleach to white.
    vec3 idle = vec3(.84, .81, .77), warm = uGlow * 2.4;
    vec3 color = mix(mix(idle, warm, filledAt(vAlong)), uGlow * 4.2 + vec3(.1, .04, 0.0), min(1.0, pulseAt(vAlong, .035)));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const shellVertex = /* glsl */`
  uniform vec3 uStart, uAxis; uniform float uLength;
  varying vec3 vNormal; varying float vAlong;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vAlong = dot(world.xyz - uStart, uAxis) / uLength;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const shellFragment = /* glsl */`
  ${shared}
  varying vec3 vNormal; varying float vAlong;
  void main() {
    vec3 n = normalize(vNormal);
    float facing = abs(n.z), rim = pow(1.0 - facing, 1.6);
    float shine = pow(max(dot(n, normalize(vec3(-.4, .8, .45))), 0.0), 22.0);
    float light = filledAt(vAlong) * .5 + pulseAt(vAlong, .12) * .9;
    // Glass reads by darker edges and bright glints; lit, it glows warm through its whole body.
    vec3 warm = mix(vec3(1.0, .85, .68), uGlow, .75);
    vec3 color = mix(vec3(.985, .975, .955), vec3(.6, .56, .5), rim) + vec3(1.0) * shine * 1.2 + warm * light * (.5 + facing * .8);
    float alpha = clamp(.12 + rim * .62 + shine * .7 + light * .5 * facing, 0.0, .95);
    gl_FragColor = vec4(color, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export type EnergyTube = ReturnType<typeof createEnergy>;
/** Energy for one glass tube: `shell` is the tube exported from Blender, running from `start` to `end`. */
export function createEnergy(shell: THREE.Mesh, start: THREE.Vector3, end: THREE.Vector3, tubeRadius: number, glow: THREE.Color) {
  const axis = end.clone().sub(start), length = axis.length();
  const uniforms = {
    uHead: { value: 0 }, uFill: { value: 0 }, uPulse: { value: 0 }, uLength: { value: length }, uGlow: { value: glow },
    uStart: { value: start.clone() }, uAxis: { value: axis.clone().normalize() },
  };
  shell.material = new THREE.ShaderMaterial({ uniforms, vertexShader: shellVertex, fragmentShader: shellFragment, transparent: true, depthWrite: false });
  shell.renderOrder = 3;
  // Blender's glass magnifies its core; without refraction here, a thicker core gives the same look.
  const core = new THREE.Mesh(new THREE.CylinderGeometry(tubeRadius * .6, tubeRadius * .6, length, 16, 1, true),
    new THREE.ShaderMaterial({ uniforms, vertexShader: coreVertex, fragmentShader: coreFragment }));
  core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), uniforms.uAxis.value);
  core.position.copy(start).add(end).multiplyScalar(.5);
  // The message itself: a small bright bead riding the core.
  const bead = new THREE.Mesh(new THREE.SphereGeometry(tubeRadius * .74, 16, 12), new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(4.2) }));
  bead.visible = false;
  const group = new THREE.Group();
  group.add(core, bead);
  const pointAt = (t: number) => start.clone().lerp(end, Math.min(1, Math.max(0, t)));
  return {
    group, length, pointAt,
    /** head: where the message is (0-1); fill: how much of the tube is lit; pulse: the message's brightness. */
    set(head: number, fill: number, pulse: number) {
      uniforms.uHead.value = head; uniforms.uFill.value = fill; uniforms.uPulse.value = pulse;
      bead.visible = pulse > .02;
      if (bead.visible) { bead.position.copy(pointAt(head)); bead.scale.setScalar(.6 + .4 * pulse); }
    },
    clear() { this.set(0, 0, 0); },
    fill() { this.set(1, 1, 0); },
    dispose() { for (const mesh of [core, bead]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); } },
  };
}
