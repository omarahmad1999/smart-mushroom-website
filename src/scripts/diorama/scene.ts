import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import type { FlowSounds, Place, Voice } from '../flow-sounds';
import { dioramas, type Action, type Diorama, type DioramaLayout, type DioramaPart, type Prop } from './paths';
import { loadModel, type Model } from './model';

// A connected-system path as a small 3D diorama, modelled and lit in Blender (tools/diorama/scene.py): each
// message runs as a pulse of light through glass tubes, and each part answers when one arrives. It is an authored
// explanation: no readings, services or clocks. It renders only while something moves, and only on screen.

const GLOW = '#B95C2A', SEAM = '#2f5b56';
/** How brightly a lit LED bar shines, the cone of light below it and the pool it throws on its platform. */
const LED = 3, BEAM = .45, POOL = .5;
/** The platforms' top surface, and how tall each part stands above it, for framing and labels. */
const TOP = .42;
const heights: Record<Prop, number> = { case: 1.3, valve: .2, gate: 1.45, stack: .8, screen: 1.3, fan: 1.15, humidifier: .95, lights: 1.1, cameras: .85, photos: .45 };
/** The sound of each part's own action as a message reaches it. */
const actionVoices: Record<Action, Voice> = { scribble: 'scribble', tilt: 'tilt', toggle: 'toggle', chart: 'screen', film: 'film' };
const propVoices: Partial<Record<Prop, Voice>> = { gate: 'gate', stack: 'chime', fan: 'spin', humidifier: 'mist', lights: 'glow' };
/** How long after a message lands each part's own sound starts, in step with its animation. The cameras' shutters
 *  and the photographs' landings are timed with each camera and each print. */
const cues: Partial<Record<Voice, number>> = { chime: .1, film: .3, mist: .1 };
/** Where the Blender studio's key light sits relative to the scene, for the live materials' highlights. */
const KEY = new THREE.Vector3(-7, 10, -1.5);
/** How fast a message is moving at `p` of its way along a tube eased in and out: 0 at the ends, highest mid-way. */
const pace = (p: number) => Math.PI * Math.sqrt(Math.max(0, p * (1 - p)));

type Part = { id: string; prop: Prop; at: THREE.Vector3; size: number; data: DioramaPart };

export async function mountDiorama(root: HTMLElement, sounds?: FlowSounds) {
  const pathway = root.dataset.systemFlow as keyof typeof dioramas, diorama: Diorama = dioramas[pathway];
  const viewport = root.querySelector<HTMLElement>('[data-diorama-viewport]')!;
  const caption = root.querySelector<HTMLElement>('[data-diorama-caption]')!;
  const controls = root.querySelector<HTMLElement>('[data-pathway-controls]')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pathway-pause]')!;
  const replayButton = root.querySelector<HTMLButtonElement>('[data-pathway-replay]')!;
  const status = root.querySelector<HTMLElement>('[data-pathway-status]')!;
  const labels = new Map([...root.querySelectorAll<HTMLElement>('[data-diorama-label]')].map(label => [label.dataset.dioramaLabel!, label]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 760px)');
  const abort = new AbortController(), events = { signal: abort.signal };
  const owner = pathway;

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
  // The bake was graded with AgX in Blender; the live parts use the same curve so they sit in the same light.
  renderer.toneMapping = THREE.AgXToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .03).texture; scene.environmentIntensity = .55;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fffaf0', '#b9ad98', .9));
  const key = new THREE.DirectionalLight('#fff2e0', 2.2);
  scene.add(key, key.target);
  const camera = new THREE.OrthographicCamera(-5, 5, 3, -3, .1, 80);

  let layout: DioramaLayout, model: Model | undefined;
  const parts = new Map<string, Part>();
  const view = { elevation: 33, target: new THREE.Vector3() };
  const models = new Map<string, Promise<Model>>();
  const load = (name: 'wide' | 'narrow') => {
    if (!models.has(name)) models.set(name, loadModel(`/media/flow/${pathway}-${name}`, diorama.parts, GLOW, SEAM));
    return models.get(name)!;
  };

  /** Shows the model for the current layout: the phone and the desktop each have their own arrangement. */
  async function assemble() {
    const name = narrow.matches ? 'narrow' : 'wide', next = await load(name);
    if (model) scene.remove(model.root);
    model = next; scene.add(model.root);
    layout = diorama.layouts[name];
    view.elevation = layout.elevation;
    parts.clear();
    for (const data of diorama.parts) { const [x, z] = layout.at[data.id]; parts.set(data.id, { id: data.id, prop: data.prop, at: new THREE.Vector3(x, 0, z), size: data.size, data }); }
    const centre = [...parts.values()].reduce((sum, part) => sum.add(part.at), new THREE.Vector3()).divideScalar(parts.size);
    key.position.copy(centre).add(KEY); key.target.position.copy(centre);
    view.target.copy(centre).setY(.5);
  }

  // Framing: an isometric camera that fits every platform, part and label into the canvas.
  const size = { width: 0, height: 0 };
  function aim(azimuth = 45, elevation = view.elevation) {
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
    const pad = narrow.matches ? { x: .35, top: .65, bottom: .95, right: 2.3 } : { x: .35, top: .75, bottom: .7, right: 0 };
    if (layout.room) Object.assign(pad, layout.room);
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
      else if (sideName === 'left') { ({ x, y } = project(at.clone().add(new THREE.Vector3(-h, TOP / 2, h)))); x -= 14; shiftX = '-100%'; shiftY = '-50%'; }
      else if (sideName === 'below-left') { ({ x, y } = project(at.clone().add(new THREE.Vector3(-h, 0, h)))); x += 6; y += 10; shiftX = '-100%'; }
      else { ({ x, y } = project(at.clone().add(new THREE.Vector3(h, 0, -h)))); x -= 6; y += 10; shiftX = '0'; }
      label.dataset.side = sideName;
      label.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(${shiftX},${shiftY})`;
      label.hidden = false;
    }
  }
  function render() {
    if (!size.width || !size.height || !alive || !model) return;
    renderer.render(scene, camera);
  }
  function resize() {
    const box = viewport.getBoundingClientRect();
    if (!box.width || !box.height || !model) return;
    size.width = box.width; size.height = box.height;
    renderer.setSize(box.width, box.height, false);
    frame(); aim(); placeLabels(); render();
  }

  // Where a sound sits: pan across the drawing, and a little lower in pitch further down a phone.
  function where(point: THREE.Vector3, level = 1): Place {
    const p = point.clone().project(camera);
    return narrow.matches ? { pan: p.x * .3, pitch: 1 - .05 * (1 - p.y), level } : { pan: p.x * .6, pitch: 1, level };
  }
  const partPlace = (id: string, level = 1) => where(parts.get(id)!.at.clone().setY(TOP), level);

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
  /** When the last part's own animation ends, so the page counts as complete only after it. */
  let quiet = 0;
  const until = (time: number) => { quiet = Math.max(quiet, time); };

  /** Sets every live part to the start (0) or the finished page (1); the moving effects rest either way. */
  function settle(done: 0 | 1) {
    if (!model) return;
    for (const tube of model.tubes.values()) if (done) tube.fill(); else tube.clear();
    for (const fill of model.fills.values()) fill.set(done);
    for (const seam of model.seams) seam.color.copy(done ? model.litSeam : model.idleSeam);
    if (model.gateGlow) model.gateGlow.emissiveIntensity = 2.4 * done;
    for (const spinner of model.spinners.values()) spinner.set(0);
    for (const painter of model.screens.values()) painter.draw(done, done);
    for (const { material, pool, beam } of model.lights.values()) { material.emissiveIntensity = LED * done; pool.set(POOL * done); beam.set(BEAM * done); }
    for (const mist of model.mists.values()) mist.set(-1);
    for (const { material, flash } of model.lenses) { material.emissiveIntensity = 0; flash.set(0); }
    for (const print of model.prints) { print.visible = !!done; print.position.y = 0; }
    for (const id of parts.keys()) setState(id, done ? 'lit' : 'idle');
  }
  function reset() {
    sounds?.stop(owner);
    settle(0);
    root.dataset.flowStage = diorama.start; setCaption(diorama.captions[diorama.start] ?? '');
  }
  // The finished diorama: every tube is lit and every part is awake. Also the reduced-motion view.
  function lit() {
    sounds?.stop(owner);
    settle(1);
    setCaption(diorama.completion);
  }

  /** A message travels the tube: a bright pulse with the core lit behind it, and the airy rush of light. */
  function travel(id: string, start: number, duration: number, level: number, merged = false) {
    const tube = model!.tubes.get(id)!, state = { head: 0, pulse: merged ? 1 : 0 }, speed = tube.length / duration / 2.4;
    timeline.fromTo(state, { head: 0 }, { head: 1, duration, ease: 'sine.inOut', immediateRender: false, onUpdate: () => {
      tube.set(state.head, state.head, state.pulse);
      if (hearing()) sounds!.pen(owner, id, pace(state.head) * speed, 'light', where(tube.pointAt(state.head), level));
    }, onComplete: () => sounds?.lift(owner, id) }, start)
      .fromTo(state, { pulse: merged ? 1 : 0 }, { pulse: 1, duration: .22, ease: 'sine.out', immediateRender: false }, start)
      .to(state, { pulse: 0, duration: .24, ease: 'sine.in', onUpdate: () => tube.set(state.head, state.head, state.pulse) }, start + duration - .12);
  }
  /** An icon fills: the thermometer's red rises, the cloud fills with gas, the notepad is written from the top. */
  function fillIcon(id: string, time: number, duration = 1.2) {
    const fill = model!.fills.get(id); if (!fill) return;
    const state = { level: 0 };
    timeline.fromTo(state, { level: 0 }, { level: 1, duration, ease: 'power1.inOut', immediateRender: false, onUpdate: () => fill.set(state.level, timeline.time()) }, time);
    until(time + duration);
  }
  /** Tweens a plain value from `from` to `to`, handing each step to `apply`. */
  function animate(apply: (value: number) => void, from: number, to: number, time: number, duration: number, ease = 'sine.inOut') {
    const state = { value: from };
    timeline.fromTo(state, { value: from }, { value: to, duration, ease, immediateRender: false, onUpdate: () => apply(state.value) }, time);
    until(time + duration);
  }
  function arrive(id: string, time: number, kind: 'source' | 'hop' | 'final', level = 1) {
    const part = parts.get(id)!, place = partPlace(id, level), m = model!;
    timeline.call(() => setState(id, 'lit'), [], time);
    if (kind === 'source') {
      // A source wakes on its own: its icon fills (the timer sweeps round with a tick).
      fillIcon(id, time, 1.1);
      sound(part.data.icon?.from === 'sweep' ? 'tick' : 'fill', time, place);
      return;
    }
    sound('tap', time, place);
    const voice = part.data.action ? actionVoices[part.data.action] : propVoices[part.prop];
    if (voice) sound(voice, time + (cues[voice] ?? .05), place);
    if (part.prop === 'case') {
      fillIcon(id, time + .1);
      // The Python badge gives a small hop as the service does its work.
      for (const { object, at } of m.python) {
        if (Math.hypot(at.x - part.at.x, at.z - part.at.z) > part.size / 2 + .2) continue;
        timeline.fromTo(object.position, { y: object.position.y }, { y: object.position.y + .04, duration: .18, ease: 'sine.out', yoyo: true, repeat: 1, immediateRender: false }, time + .15);
      }
    }
    if (part.prop === 'gate' && m.gateGlow) {
      const glow = m.gateGlow;
      timeline.fromTo(glow, { emissiveIntensity: 0 }, { emissiveIntensity: 4, duration: .14, ease: 'sine.out', immediateRender: false }, time).to(glow, { emissiveIntensity: 2.4, duration: .9, ease: 'sine.inOut' }, time + .18);
    }
    if (part.prop === 'stack') m.seams.forEach((seam, index) => {
      animate(t => seam.color.copy(m.idleSeam).lerp(m.litSeam, t), 0, 1, time + .1 + index * .18, .4, 'sine.out');
    });
    const painter = m.screens.get(id);
    if (part.prop === 'screen' && painter) {
      // The screen wakes, then the chart draws or the timelapse plays frame by frame.
      const state = { progress: 0, light: 0 }, draw = () => painter.draw(state.progress, state.light), film = part.data.action === 'film';
      animate(value => { state.light = value; draw(); }, 0, 1, time + .05, .3, 'sine.out');
      animate(value => { state.progress = value; draw(); }, 0, 1, time + .3, film ? 1.8 : 1.2, film ? 'none' : 'power1.inOut');
    }
    const spinner = m.spinners.get(id);
    // The fan spins up as it is driven and coasts to a stop once the path is complete.
    if (part.prop === 'fan' && spinner) animate(angle => spinner.set(angle), 0, Math.PI * 2 * 6, time + .05, 2.8, 'power1.inOut');
    const mist = m.mists.get(id);
    if (part.prop === 'humidifier' && mist) animate(t => mist.set(t), 0, mist.duration, time + .1, mist.duration, 'none');
    const light = m.lights.get(id);
    if (part.prop === 'lights' && light) animate(k => { light.material.emissiveIntensity = LED * k; light.pool.set(POOL * k); light.beam.set(BEAM * k); }, 0, 1, time + .05, .5, 'sine.out');
    // Both cameras capture, one just after the other: each shutter fires with its flash.
    if (part.prop === 'cameras') m.lenses.forEach(({ material, flash }, index) => {
      const at = time + .08 + index * .2, shine = (k: number) => { material.emissiveIntensity = 3 * k; flash.set(k); };
      sound('shutter', at, place);
      animate(shine, 0, 1, at, .07, 'sine.out');
      animate(shine, 1, 0, at + .08, .4, 'sine.in');
    });
    // The new photographs drop onto the pile one by one.
    if (part.prop === 'photos') m.prints.forEach((print, index) => {
      const at = time + .1 + index * .28;
      timeline.set(print, { visible: true }, at);
      animate(y => { print.position.y = y; }, .3, 0, at, .26, 'power2.in');
      sound('stack', at + .26, partPlace(id, level * .8));
    });
  }

  function build() {
    timeline.clear();
    if (!model) return;
    let time = .25, arrival = time;
    quiet = 0;
    stage(diorama.start, time);
    // The first sources wake together; a source named by a later stretch wakes just before that stretch leaves.
    const later = new Set(diorama.stretches.flatMap(stretch => stretch.sources ?? []));
    const first = diorama.parts.filter(part => part.source && !later.has(part.id));
    for (const part of first) arrive(part.id, time, 'source', 1 / Math.sqrt(first.length));
    time += 1.3;
    diorama.stretches.forEach((stretch, index) => {
      const final = index === diorama.stretches.length - 1;
      for (const id of stretch.sources ?? []) arrive(id, time - .9, 'source');
      stage(`to-${stretch.stage}`, time);
      let clock = time;
      stretch.phases.forEach((phase, step) => {
        const duration = Math.max(...phase.map(id => gsap.utils.clamp(.75, 1.3, model!.tubes.get(id)!.length / 2.4)));
        // Two readings meet in the valve: its wheel turns, and one brighter message carries on.
        const merged = step > 0 && stretch.phases[step - 1].length > 1;
        const valve = [...parts.values()].find(part => part.prop === 'valve');
        if (merged && valve) {
          const wheel = model!.spinners.get(valve.id);
          if (wheel) animate(angle => wheel.set(angle), 0, Math.PI / 2, clock - .1, .5, 'back.out(2)');
          sound('gulp', clock - .08, where(valve.at.clone().setY(.4)));
        }
        for (const id of phase) travel(id, merged ? clock - .06 : clock, duration, 1 / Math.sqrt(phase.length), merged);
        clock += duration;
      });
      stage(stretch.stage, clock);
      // Where the last phase's tubes lead: one part, or several that answer together (the three devices).
      const destinations = [...new Set(stretch.phases.at(-1)!.map(id => diorama.links.find(link => link.id === id)!.to))];
      for (const id of destinations) arrive(id, clock, final ? 'final' : 'hop', 1 / Math.sqrt(destinations.length));
      arrival = clock; time = clock + .6;
    });
    // Let the last parts finish (the chart drawing, the mist rising) before the page counts as complete.
    timeline.to({}, { duration: .01 }, Math.max(arrival + 1.9, quiet + .2));
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
  async function relayout() {
    const finished = complete;
    timeline.clear(); timeline.pause(0, true);
    await assemble(); resize();
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
  const resizer = new ResizeObserver(() => resize());
  document.addEventListener('visibilitychange', syncPlayback, events);
  reduced.addEventListener('change', () => reduced.matches ? stillView() : restart(), events);
  narrow.addEventListener('change', () => void relayout(), events);
  window.addEventListener('pagehide', event => {
    timeline.pause(); sounds?.stop(owner);
    if (event.persisted) return;
    alive = false; intersection.disconnect(); resizer.disconnect(); abort.abort(); timeline.kill(); renderer.dispose();
    for (const loaded of models.values()) void loaded.then(item => item.dispose());
  }, events);

  // First frame: load the model, draw it, then swap the poster for the live canvas.
  await assemble();
  viewport.prepend(canvas);
  intersection.observe(viewport); resizer.observe(viewport);
  resize();
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
