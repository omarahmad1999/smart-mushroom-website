import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import thermometer from '@phosphor-icons/core/duotone/thermometer-duotone.svg?raw';
import cloud from '@phosphor-icons/core/duotone/cloud-duotone.svg?raw';
import notePencil from '@phosphor-icons/core/duotone/note-pencil-duotone.svg?raw';
import type { FlowSounds, Place, Voice } from '../flow-sounds';
import { dioramas, type Diorama, type DioramaLayout, type Prop } from './paths';
import { TOP, createGate, createMaterials, createPlatform, createScreen, createStack, createTile, createValve } from './props';
import { createTube, type Tube } from './tube';

// A connected-system path as a small 3D diorama. Messages travel as light through glass tubes and
// each part does one small thing when one arrives. It is an authored explanation: no readings,
// services or clocks. It renders only while something moves, and only while it is on screen.

const accents: Record<string, string> = { observe: '#ff7a2e' };
const icons: Record<string, string> = { sht31: thermometer, scd41: cloud, writer: notePencil };
/** How tall each prop stands above its platform, for framing and labels. */
const heights: Record<Prop, number> = { sensor: .3, valve: .45, gate: 1.35, writer: .3, stack: .66, screen: 1.12 };
const pace = (p: number) => Math.PI * Math.sqrt(Math.max(0, p * (1 - p)));

type Part = { id: string; prop: Prop; at: THREE.Vector3; size: number; glow?: THREE.MeshBasicMaterial; pool?: THREE.MeshBasicMaterial; action?: Record<string, any> };

export function mountDiorama(root: HTMLElement, sounds?: FlowSounds) {
  const pathway = root.dataset.systemFlow as keyof typeof dioramas, diorama: Diorama = dioramas[pathway];
  const viewport = root.querySelector<HTMLElement>('[data-diorama-viewport]')!;
  const caption = root.querySelector<HTMLElement>('[data-diorama-caption]')!;
  const controls = root.querySelector<HTMLElement>('[data-pathway-controls]')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pathway-pause]')!;
  const replayButton = root.querySelector<HTMLButtonElement>('[data-pathway-replay]')!;
  const status = root.querySelector<HTMLElement>('[data-pathway-status]')!;
  const labels = new Map([...root.querySelectorAll<HTMLElement>('[data-diorama-label]')].map(label => [label.dataset.dioramaLabel!, label]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 760px)'), fine = matchMedia('(hover: hover) and (pointer: fine)');
  const abort = new AbortController(), events = { signal: abort.signal };
  const owner = pathway, accent = new THREE.Color(accents[pathway]);

  // Renderer and a soft studio: environment light for the materials, one key light for shadows.
  const canvas = document.createElement('canvas');
  canvas.className = 'diorama-canvas'; canvas.setAttribute('aria-hidden', 'true');
  // Without graphics acceleration the model would crawl; the browser then declines and the poster stays.
  // Dense screens skip multisampling: the higher pixel ratio already smooths the edges.
  const antialias = devicePixelRatio < 2;
  const context = canvas.getContext('webgl2', { alpha: true, antialias, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
  if (!context) throw new Error('Accelerated WebGL 2 unavailable');
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .03).texture; scene.environmentIntensity = .36;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fffaf0', '#b9ad98', .75));
  const key = new THREE.DirectionalLight('#fff1dc', 2.8);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 9; key.shadow.blurSamples = 20;
  key.shadow.bias = -.0004; key.shadow.normalBias = .01; key.shadow.intensity = .8;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#eef1ea', .32); fill.position.set(6, 5, -4); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .2, color: '#4a3a26' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, .1, 80);
  const materials = createMaterials(accent);

  let layout: DioramaLayout, world = new THREE.Group();
  const parts = new Map<string, Part>(), tubes = new Map<string, Tube>();
  const view = { azimuth: 45, elevation: 33, target: new THREE.Vector3(), zoom: 1 };

  // A tube leaves a platform from the side facing its neighbour, or from the corner when it runs diagonally.
  const diagonal = (a: THREE.Vector3, b: THREE.Vector3) => { const dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z); return dx > .01 && dz > .01 && dx / dz > .5 && dx / dz < 2; };
  function side(from: Part, towards: THREE.Vector3) {
    const dx = towards.x - from.at.x, dz = towards.z - from.at.z;
    if (diagonal(from.at, towards)) { const along = new THREE.Vector3(dx, 0, dz).normalize(); return from.at.clone().add(along.multiplyScalar(from.size / 2 / Math.max(Math.abs(along.x), Math.abs(along.z)) - .02)).setY(.16); }
    const along = Math.abs(dx) >= Math.abs(dz) ? new THREE.Vector3(Math.sign(dx), 0, 0) : new THREE.Vector3(0, 0, Math.sign(dz));
    return from.at.clone().add(along.multiplyScalar(from.size / 2 + .02)).setY(.16);
  }
  /** Builds the diorama for the current layout: platforms, props and the tubes between them. */
  function assemble() {
    scene.remove(world);
    world.traverse(object => { if (object instanceof THREE.Mesh && !(object.material instanceof THREE.ShaderMaterial)) object.geometry.dispose(); });
    for (const tube of tubes.values()) tube.dispose();
    world = new THREE.Group(); parts.clear(); tubes.clear();
    layout = diorama.layouts[narrow.matches ? 'narrow' : 'wide'];
    view.elevation = layout.elevation;
    for (const data of diorama.parts) {
      const [x, z] = layout.at[data.id], part: Part = { id: data.id, prop: data.prop, at: new THREE.Vector3(x, 0, z), size: data.size };
      const group = new THREE.Group(); group.position.copy(part.at);
      if (data.prop === 'valve') { const valve = createValve(materials); group.add(valve.group); part.action = { wheel: valve.wheel }; }
      else {
        const platform = createPlatform(data.size, materials); group.add(platform.group); part.glow = platform.glow; part.pool = platform.pool;
        if (data.prop === 'sensor' || data.prop === 'writer') { const tile = createTile(icons[data.id], materials); group.add(tile); part.action = { tile }; }
        if (data.prop === 'gate') {
          // The gate straddles the tube that brings messages in.
          const gate = createGate(materials), from = diorama.links.find(link => link.to === data.id), before = from && layout.at[from.from];
          if (before) gate.group.rotation.y = Math.atan2(-(z - before[1]), x - before[0]);
          group.add(gate.group); part.action = { glow: gate.glow };
        }
        if (data.prop === 'stack') { const stack = createStack(materials); group.add(stack.group); part.action = { seams: stack.seams }; }
        if (data.prop === 'screen') { const screen = createScreen(materials); group.add(screen.group); part.action = { draw: screen.draw, screen: { progress: 0, light: 0 } }; }
      }
      world.add(group); parts.set(data.id, part);
    }
    for (const link of diorama.links) {
      const from = parts.get(link.from)!, to = parts.get(link.to)!;
      const start = side(from, to.at), end = side(to, from.at);
      const points = [start, end];
      // Parts that are not in line are joined with one rounded elbow.
      if (!diagonal(from.at, to.at) && Math.abs(start.x - end.x) > .01 && Math.abs(start.z - end.z) > .01) points.splice(1, 0, new THREE.Vector3(end.x, start.y, start.z));
      const tube = createTube(points, accent.clone().multiplyScalar(1.2));
      world.add(tube.group); tubes.set(link.id, tube);
    }
    scene.add(world);
    // The key light covers the diorama from the upper left, so shadows fall towards the viewer.
    const box = new THREE.Box3().setFromObject(world), centre = box.getCenter(new THREE.Vector3()), reach = box.getSize(new THREE.Vector3()).length() / 2 + 1;
    key.target.position.copy(centre); key.position.copy(centre).add(new THREE.Vector3(-8, 10, -1.5));
    Object.assign(key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: .5, far: 30 }); key.shadow.camera.updateProjectionMatrix();
    view.target.copy(centre).setY(.5);
    renderer.shadowMap.needsUpdate = true;
  }

  // Framing: an isometric camera that fits every platform, prop and label into the canvas.
  const size = { width: 0, height: 0 };
  function aim(azimuth = view.azimuth, elevation = view.elevation) {
    const a = THREE.MathUtils.degToRad(azimuth), e = THREE.MathUtils.degToRad(elevation);
    camera.position.copy(view.target).add(new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)).multiplyScalar(30));
    camera.lookAt(view.target); camera.updateMatrixWorld();
  }
  function frame() {
    aim(45, view.elevation);
    const corners: THREE.Vector3[] = [];
    for (const part of parts.values()) {
      const h = part.size / 2;
      for (const [dx, dz] of [[-h, -h], [h, -h], [-h, h], [h, h]]) corners.push(part.at.clone().add(new THREE.Vector3(dx, 0, dz)));
      corners.push(part.at.clone().setY(TOP + heights[part.prop]));
    }
    const inverse = camera.matrixWorldInverse, bounds = new THREE.Box2();
    for (const point of corners) { const local = point.applyMatrix4(inverse); bounds.expandByPoint(new THREE.Vector2(local.x, local.y)); }
    // Room for the labels above and below.
    const pad = narrow.matches ? { x: .35, top: .55, bottom: .95, right: 2.3 } : { x: .35, top: .55, bottom: .62, right: 0 };
    const width = bounds.max.x - bounds.min.x + pad.x * 2 + pad.right, height = bounds.max.y - bounds.min.y + pad.top + pad.bottom;
    const aspect = size.width / size.height;
    const halfW = Math.max(width, height * aspect) / 2, halfH = halfW / aspect;
    const cx = (bounds.min.x + bounds.max.x + pad.right) / 2, cy = (bounds.min.y - pad.bottom + bounds.max.y + pad.top) / 2;
    Object.assign(camera, { left: cx - halfW, right: cx + halfW, top: cy + halfH, bottom: cy - halfH });
    camera.updateProjectionMatrix();
  }

  // Labels are HTML beside each part, placed from its projected corners.
  const project = (point: THREE.Vector3) => { const p = point.clone().project(camera); return { x: (p.x + 1) / 2 * size.width, y: (1 - p.y) / 2 * size.height }; };
  function placeLabels() {
    for (const [id, label] of labels) {
      const part = parts.get(id); if (!part) continue;
      const h = part.size / 2, sideName = layout.labels[id] ?? 'below', at = part.at;
      let x = 0, y = 0, shiftX = '-50%', shiftY = '0';
      if (sideName === 'above') { ({ x, y } = project(at.clone().setY(TOP + heights[part.prop]))); y -= 10; shiftY = '-100%'; }
      else if (sideName === 'below') { ({ x, y } = project(at.clone().add(new THREE.Vector3(h, 0, h)))); y += 8; }
      else if (sideName === 'right') { ({ x, y } = project(at.clone().add(new THREE.Vector3(h, TOP / 2, -h)))); x += 14; shiftX = '0'; shiftY = '-50%'; }
      else if (sideName === 'below-left') { ({ x, y } = project(at.clone().add(new THREE.Vector3(-h, 0, h)))); x += 6; y += 10; shiftX = '-100%'; }
      else { ({ x, y } = project(at.clone().add(new THREE.Vector3(h, 0, -h)))); x -= 6; y += 10; shiftX = '0'; }
      label.dataset.side = sideName;
      label.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(${shiftX},${shiftY})`;
      label.hidden = false;
    }
  }
  function render() {
    if (!size.width || !size.height || !alive) return;
    renderer.render(scene, camera);
  }
  function resize() {
    const box = viewport.getBoundingClientRect();
    if (!box.width || !box.height) return;
    size.width = box.width; size.height = box.height;
    renderer.setSize(box.width, box.height, false);
    frame(); aim(); placeLabels(); render();
  }

  // Pointer parallax: the camera eases a few degrees towards the pointer, which reads as real depth.
  const lean = { azimuth: 45, elevation: 0 };
  viewport.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches) return;
    const box = viewport.getBoundingClientRect(), px = (event.clientX - box.left) / box.width - .5, py = (event.clientY - box.top) / box.height - .5;
    gsap.to(lean, { azimuth: 45 + px * 7, elevation: -py * 4, duration: .9, ease: 'power3.out', overwrite: true, onUpdate: () => { aim(lean.azimuth, view.elevation + lean.elevation); placeLabels(); render(); } });
  }, events);
  viewport.addEventListener('pointerleave', () => {
    gsap.to(lean, { azimuth: 45, elevation: 0, duration: 1.2, ease: 'power3.inOut', overwrite: true, onUpdate: () => { aim(lean.azimuth, view.elevation + lean.elevation); placeLabels(); render(); } });
  }, events);

  // Where a sound sits: pan across the drawing, and a little lower in pitch further down a phone.
  function where(point: THREE.Vector3, level = 1): Place {
    const p = point.clone().project(camera);
    return narrow.matches ? { pan: p.x * .3, pitch: 1 - .05 * (1 - p.y), level } : { pan: p.x * .6, pitch: 1, level };
  }

  // Playback follows the ink drawings: start once mostly on screen, pause offscreen or on another tab.
  let active = true, inView = false, started = false, userPaused = false, complete = false, alive = true;
  const timeline = gsap.timeline({ paused: true, onComplete: finish, onUpdate: render });
  const canSound = () => active && inView && !document.hidden && !userPaused && !reduced.matches;
  const hearing = () => canSound() && !!sounds?.ready;
  const setCaption = (text: string) => { caption.textContent = text; caption.hidden = !text; };
  function stage(name: string, time: number) {
    timeline.call(() => { root.dataset.flowStage = name; const text = diorama.captions[name]; if (text) setCaption(text); }, [], time);
  }
  function sound(voice: Voice, time: number, place: Place) {
    timeline.call(() => { if (canSound()) sounds?.play(voice, owner, place); }, [], time);
  }
  const setState = (id: string, state: 'idle' | 'lit') => { const label = labels.get(id); if (label) label.dataset.state = state; };

  function reset() {
    sounds?.stop(owner);
    for (const tube of tubes.values()) tube.set(0, 0, 0);
    for (const part of parts.values()) {
      if (part.glow) part.glow.opacity = 0;
      if (part.pool) part.pool.opacity = 0;
      const action = part.action ?? {};
      if (action.tile) { action.tile.position.y = TOP; action.tile.scale.set(1, 1, 1); }
      if (action.wheel) action.wheel.rotation.y = 0;
      if (action.glow) action.glow.opacity = .15;
      if (action.seams) for (const seam of action.seams) seam.color.set('#cfc8bb');
      if (action.draw) { action.screen.progress = 0; action.screen.light = 0; action.draw(0, 0); }
      setState(part.id, 'idle');
    }
    root.dataset.flowStage = 'sensors'; setCaption(diorama.captions.sensors);
  }
  // The finished diorama: every tube lit, every part awake. Also the reduced-motion view.
  function lit() {
    sounds?.stop(owner);
    for (const tube of tubes.values()) tube.set(1, 1, 0);
    for (const part of parts.values()) {
      const final = diorama.parts.find(item => item.id === part.id)?.final;
      if (part.glow) part.glow.opacity = 0;
      if (part.pool) part.pool.opacity = final ? .5 : .32;
      const action = part.action ?? {};
      if (action.tile) { action.tile.position.y = TOP; action.tile.scale.set(1, 1, 1); }
      if (action.glow) action.glow.opacity = .55;
      if (action.seams) for (const seam of action.seams) seam.color.copy(accent).multiplyScalar(1.5);
      if (action.draw) { action.screen.progress = 1; action.screen.light = 1; action.draw(1, 1); }
      setState(part.id, 'lit');
    }
    setCaption(diorama.completion);
  }

  /** A message travels the tube: a bright pulse with lit core behind it, and the airy rush of light. */
  function travel(id: string, start: number, duration: number, level: number, merged = false) {
    const tube = tubes.get(id)!, state = { head: 0, pulse: merged ? 1 : 0 }, speed = tube.length / duration / 2.4;
    timeline.fromTo(state, { head: 0 }, { head: 1, duration, ease: 'sine.inOut', immediateRender: false, onUpdate: () => {
      tube.set(state.head, state.head, state.pulse);
      if (hearing()) sounds!.pen(owner, id, pace(state.head) * speed, 'light', where(tube.pointAt(state.head), level));
    }, onComplete: () => sounds?.lift(owner, id) }, start)
      .fromTo(state, { pulse: merged ? 1 : 0 }, { pulse: 1, duration: .22, ease: 'sine.out', immediateRender: false }, start)
      .to(state, { pulse: 0, duration: .24, ease: 'sine.in', onUpdate: () => tube.set(state.head, state.head, state.pulse) }, start + duration - .12);
  }
  const partPlace = (id: string, level = 1) => where(parts.get(id)!.at.clone().setY(TOP), level);
  function arrive(id: string, time: number, kind: 'source' | 'hop' | 'final', level = 1) {
    const part = parts.get(id)!, action = part.action ?? {};
    timeline.call(() => setState(id, 'lit'), [], time);
    // The platform's edge flashes as the message lands, and a warm pool of light stays under it.
    if (part.glow) timeline.fromTo(part.glow, { opacity: 0 }, { opacity: .9, duration: .14, ease: 'sine.out', immediateRender: false }, time)
      .to(part.glow, { opacity: 0, duration: .9, ease: 'sine.inOut' }, time + .18);
    if (part.pool) timeline.fromTo(part.pool, { opacity: 0 }, { opacity: kind === 'final' ? .5 : .32, duration: .7, ease: 'sine.out', immediateRender: false }, time + .05);
    if (kind !== 'source') sound('tap', time, partPlace(id, level));
    if (action.tile) {
      // Sensors lift a little as they read; the writer presses down as it writes.
      if (kind === 'source') timeline.fromTo(action.tile.position, { y: TOP }, { y: TOP + .09, duration: .22, ease: 'sine.out', yoyo: true, repeat: 1, immediateRender: false }, time);
      else { timeline.fromTo(action.tile.scale, { y: 1 }, { y: .72, duration: .09, ease: 'power2.out', immediateRender: false }, time + .04).to(action.tile.scale, { y: 1, duration: .6, ease: 'elastic.out(1,.45)' }, time + .13); sound('toggle', time + .04, partPlace(id, level)); }
    }
    if (part.prop === 'gate') {
      timeline.fromTo(action.glow, { opacity: .15 }, { opacity: 1, duration: .12, ease: 'sine.out', immediateRender: false }, time).to(action.glow, { opacity: .55, duration: .9, ease: 'sine.inOut' }, time + .16);
      sound('gate', time, partPlace(id, level));
    }
    if (part.prop === 'stack') {
      (action.seams as THREE.MeshBasicMaterial[]).forEach((seam, index) => {
        const color = { t: 0 }, from = new THREE.Color('#cfc8bb'), to = accent.clone().multiplyScalar(1.5);
        timeline.fromTo(color, { t: 0 }, { t: 1, duration: .32, ease: 'sine.out', immediateRender: false, onUpdate: () => { seam.color.copy(from).lerp(to, color.t); } }, time + .08 + index * .14);
      });
      sound('fill', time + .08, partPlace(id, level));
    }
    if (part.prop === 'screen') {
      const screen = action.screen;
      timeline.fromTo(screen, { light: 0 }, { light: 1, duration: .3, ease: 'sine.out', immediateRender: false, onUpdate: () => action.draw(screen.progress, screen.light) }, time + .05)
        .fromTo(screen, { progress: 0 }, { progress: 1, duration: 1.1, ease: 'power1.inOut', immediateRender: false, onUpdate: () => action.draw(screen.progress, screen.light) }, time + .3);
      sound('glow', time + .05, partPlace(id, level));
    }
  }

  function build() {
    timeline.clear();
    let time = .25, arrival = time;
    stage('sensors', time);
    for (const part of diorama.parts) if (part.source) arrive(part.id, time, 'source');
    time += .7;
    diorama.stretches.forEach((stretch, index) => {
      const final = index === diorama.stretches.length - 1;
      stage(`to-${stretch.stage}`, time);
      let clock = time;
      stretch.phases.forEach((phase, step) => {
        const duration = Math.max(...phase.map(id => gsap.utils.clamp(.75, 1.3, tubes.get(id)!.length / 2.4)));
        // Two readings meet in the valve: it turns, and one brighter message continues.
        const merged = step > 0 && stretch.phases[step - 1].length > 1;
        if (merged) {
          const valve = [...parts.values()].find(part => part.prop === 'valve');
          if (valve?.action?.wheel) timeline.to(valve.action.wheel.rotation, { y: `+=${Math.PI / 2}`, duration: .5, ease: 'back.out(2)' }, clock - .1);
          if (valve) sound('gulp', clock - .08, where(valve.at.clone().setY(.4)));
        }
        for (const id of phase) travel(id, merged ? clock - .06 : clock, duration, 1 / Math.sqrt(phase.length), merged);
        clock += duration;
      });
      stage(stretch.stage, clock);
      arrive(stretch.stage, clock, final ? 'final' : 'hop');
      arrival = clock; time = clock + .6;
    });
    timeline.to({}, { duration: .01 }, arrival + 1.5);
  }

  function syncControls() {
    const playing = active && inView && !document.hidden && !userPaused && !complete && !reduced.matches;
    root.dataset.flowState = reduced.matches ? 'static' : complete ? 'complete' : playing ? 'running' : userPaused ? 'paused' : timeline.time() === 0 ? 'idle' : 'paused';
    pauseButton.disabled = complete || reduced.matches;
    pauseButton.setAttribute('aria-label', `${userPaused ? 'Play' : 'Pause'} ${diorama.name} Animation`);
    root.querySelector('[data-pathway-pause-label]')!.textContent = userPaused ? 'Play' : 'Pause';
    root.querySelector('[data-pathway-pause-icon]')!.textContent = userPaused ? '▷' : 'Ⅱ';
    controls.hidden = reduced.matches;
  }
  function finish() {
    complete = true; root.dataset.flowStage = diorama.stretches.at(-1)!.stage; syncControls();
    status.textContent = `The ${diorama.name} path is complete. ${diorama.completion} Replay to follow it again.`;
  }
  function stillView() {
    timeline.pause(); complete = false; lit(); render();
    root.dataset.flowStage = 'all'; status.textContent = `The complete ${diorama.name} pathway is shown with motion reduced.`;
    syncControls();
  }
  function syncPlayback() {
    if (!alive) return;
    if (reduced.matches) { stillView(); return; }
    if (active && inView && !document.hidden && !userPaused && !complete) timeline.play();
    else { timeline.pause(); sounds?.stop(owner); }
    syncControls();
  }
  function restart() {
    timeline.pause(0, true); complete = false; userPaused = false;
    reset(); render(); status.textContent = `Following the ${diorama.name} pathway.`;
    syncPlayback();
  }
  function relayout() {
    const finished = complete;
    timeline.clear(); timeline.pause(0, true);
    assemble(); resize();
    if (finished || reduced.matches) lit(); else reset();
    build(); render(); syncPlayback();
  }

  pauseButton.addEventListener('click', () => { userPaused = !userPaused; syncPlayback(); if (!userPaused) sounds?.play('click', owner); }, events);
  replayButton.addEventListener('click', () => { restart(); sounds?.play('click', owner); }, events);
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio >= .45 || entry.intersectionRect.height >= innerHeight * .6) started = true;
      inView = entry.isIntersecting && started;
    }
    syncPlayback();
  }, { threshold: [0, .15, .3, .45, .6, .75, .9, 1] });
  intersection.observe(viewport);
  const resizer = new ResizeObserver(() => resize());
  resizer.observe(viewport);
  document.addEventListener('visibilitychange', syncPlayback, events);
  reduced.addEventListener('change', () => reduced.matches ? stillView() : restart(), events);
  narrow.addEventListener('change', relayout, events);
  window.addEventListener('pagehide', event => {
    timeline.pause(); sounds?.stop(owner);
    if (event.persisted) return;
    alive = false; intersection.disconnect(); resizer.disconnect(); abort.abort(); timeline.kill(); renderer.dispose();
  }, events);

  // First frame: build, draw, then swap the poster for the live canvas.
  viewport.prepend(canvas);
  assemble(); resize();
  if (reduced.matches) stillView(); else { reset(); build(); render(); syncPlayback(); }
  root.dataset.dioramaReady = '';
  return {
    restart,
    setActive(value: boolean, replay = false) {
      active = value;
      if (value) requestAnimationFrame(resize);
      if (value && replay) restart(); else syncPlayback();
    },
  };
}
