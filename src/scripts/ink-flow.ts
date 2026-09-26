import { gsap } from 'gsap';
import type { FlowSounds, Ink, Place, Voice } from './flow-sounds';

type Drop = { el: SVGGElement; x: number; y: number; angle: number; stretch: number; pop: number };
type Route = { id: string; to: string; kind: Ink; trail: SVGPathElement; drop: Drop; length: number; xs: Float32Array; ys: Float32Array; angles: Float32Array };
// A pathway is a list of stretches. Each stretch moves one or more messages at once, in phases (two sensor readings,
// then the merged message); it writes its notes while travelling and arrives where its last phase ends.
// A stretch whose last phase fans out to several parts arrives at all of them, under one shared stage name.
type Stretch = { phases: string[][]; notes: string[]; sources?: string[]; stage?: string };
const scripts: Record<string, { start: string; sources: string[]; stretches: Stretch[] }> = {
  observe: {
    start: 'sensors', sources: ['sht31', 'scd41'],
    stretches: [
      { phases: [['sht31', 'scd41'], ['merged']], notes: ['readings'] },
      { phases: [['published']], notes: ['published'] }, { phases: [['stored']], notes: ['stored'] }, { phases: [['visualized']], notes: ['visualized'] },
    ],
  },
  respond: {
    // Commands from the controllers and Home Assistant's manual control arrive at Mosquitto together.
    start: 'inputs', sources: ['inputs'],
    stretches: [
      { phases: [['evaluate']], notes: ['evaluate'] }, { phases: [['commands', 'manual']], notes: ['commands', 'manual'], sources: ['ha'] },
      { phases: [['route']], notes: ['route'] },
      // The actuator services drive the three devices at once: the message splits three ways.
      { phases: [['drive-fan', 'drive-humidifier', 'drive-leds']], notes: ['drive'], stage: 'devices' },
    ],
  },
  record: {
    start: 'schedule', sources: ['schedule'],
    stretches: [{ phases: [['trigger']], notes: ['trigger'] }, { phases: [['save']], notes: ['save'] }, { phases: [['prepare']], notes: ['prepare'] }],
  },
};
// When each part's own sound falls after it is inked, in step with its animation (the stamp lands, the shutter fires…).
const cues: Partial<Record<string, number>> = { stamp: .34, scribble: .12, layer: .12, stack: .1, film: .12, chart: .15, tilt: .16, toggle: .04, spin: 0, tick: 0, flash: .08, mist: .1, glow: .05 };
// How fast an eased stroke moves at eased progress p, relative to its average speed.
const pace = { sine: (p: number) => Math.PI * Math.sqrt(Math.max(0, p * (1 - p))), quad: (p: number) => 2 * Math.sqrt(2 * Math.max(0, Math.min(p, 1 - p))) };

/** A finite, authored ink explanation of one pathway. No readings, device clocks or services. */
export function mountInkFlow(root: HTMLElement, sounds?: FlowSounds) {
  const canvas = root.querySelector<HTMLElement>('[data-pathway-canvas]')!;
  const controls = root.querySelector<HTMLElement>('[data-pathway-controls]')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pathway-pause]')!;
  const replayButton = root.querySelector<HTMLButtonElement>('[data-pathway-replay]')!;
  const status = root.querySelector<HTMLElement>('[data-pathway-status]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 760px)');
  const abort = new AbortController(), events = { signal: abort.signal };
  const flowName = root.dataset.flowName!, owner = root.dataset.systemFlow!, script = scripts[owner];
  const colors = { pencil: '#a9aa9c', pencilDetail: '#bbbcb0', ink: '#24332f', detail: '#7c8276', final: '#4f5a3c' };
  // Paper-hidden offset for stroke reveals: slightly past 1, so no round cap shows before a line starts.
  const HIDDEN = 1.03;
  let active = true, inView = false, started = false, userPaused = false, complete = false, alive = true, ready = false;
  let diagram!: SVGSVGElement, routes = new Map<string, Route>(), finalStage = '';
  const timeline = gsap.timeline({ paused: true, onComplete: finish });
  const all = <T extends Element = SVGElement>(query: string, scope: ParentNode = diagram) => Array.from(scope.querySelectorAll<T>(query));
  const one = <T extends Element = SVGElement>(query: string) => diagram.querySelector<T>(query);
  const node = (id: string) => one<SVGGElement>(`[data-ink-node="${id}"]`);
  const part = (id: string, query: string) => all(query, node(id)!);
  const canSound = () => active && inView && !document.hidden && !userPaused && !reduced.matches;
  const hearing = () => canSound() && !!sounds?.ready;
  const at = (id: string) => node(id)!.getAttribute('transform')!.match(/-?[\d.]+/g)!.map(Number);
  // Sounds sit where they happen: left to right across the drawing, and a little lower further down a phone drawing.
  function where(x: number, y: number, level = 1): Place {
    const box = diagram.viewBox.baseVal, across = Math.max(-1, Math.min(1, x / box.width * 2 - 1));
    return narrow.matches ? { pan: across * .3, pitch: 1.04 - .1 * y / box.height, level } : { pan: across * .6, pitch: 1, level };
  }
  const whereIs = (id: string, level = 1) => { const [x, y] = at(id); return where(x, y, level); };
  // A typical stroke's speed, so the pen sounds alike on the wide drawing and the more compact phone one.
  const strokeSpeed = () => narrow.matches ? 150 : 300;

  // Sample each route once per layout; while the drop moves it only interpolates between stored points.
  function sample(path: SVGPathElement) {
    const length = path.getTotalLength(), count = Math.max(48, Math.ceil(length / 3));
    const xs = new Float32Array(count + 1), ys = new Float32Array(count + 1), angles = new Float32Array(count + 1);
    for (let i = 0; i <= count; i++) { const point = path.getPointAtLength(length * i / count); xs[i] = point.x; ys[i] = point.y; }
    for (let i = 0; i <= count; i++) { const a = Math.max(0, i - 1), b = Math.min(count, i + 1); angles[i] = Math.atan2(ys[b] - ys[a], xs[b] - xs[a]) * 180 / Math.PI; }
    return { length, xs, ys, angles };
  }
  function draw(drop: Drop) {
    const visible = drop.pop > .001;
    drop.el.style.visibility = visible ? 'visible' : 'hidden';
    // The drop leans into its direction of travel and stretches most at full speed, mid-route.
    if (visible) drop.el.setAttribute('transform', `translate(${drop.x.toFixed(2)} ${drop.y.toFixed(2)}) rotate(${drop.angle.toFixed(1)}) scale(${(drop.pop * (1 + .34 * drop.stretch)).toFixed(3)} ${(drop.pop * (1 - .2 * drop.stretch)).toFixed(3)})`);
  }
  function place(route: Route, progress: number) {
    const last = route.xs.length - 1, at = Math.min(last, Math.max(0, progress * last)), i = Math.min(last - 1, Math.floor(at)), k = at - i;
    let turn = route.angles[i + 1] - route.angles[i];
    if (turn > 180) turn -= 360; else if (turn < -180) turn += 360;
    const drop = route.drop;
    drop.x = route.xs[i] + (route.xs[i + 1] - route.xs[i]) * k; drop.y = route.ys[i] + (route.ys[i + 1] - route.ys[i]) * k;
    drop.angle = route.angles[i] + turn * k; drop.stretch = Math.sin(Math.PI * progress);
    // The trail is inked up to the drop, so the line is written exactly where the message has been.
    route.trail.setAttribute('stroke-dashoffset', String(HIDDEN * (1 - progress)));
    draw(drop);
  }
  function mountLayout() {
    diagram = root.querySelector<SVGSVGElement>(`[data-flow-layout="${narrow.matches ? 'narrow' : 'wide'}"]`)!;
    routes = new Map(all<SVGPathElement>('[data-ink-route]').map((path): [string, Route] => {
      const id = path.dataset.inkRoute!, samples = sample(path);
      const drop: Drop = { el: one<SVGGElement>(`[data-ink-drop="${id}"]`)!, x: samples.xs[0], y: samples.ys[0], angle: samples.angles[0], stretch: 0, pop: 0 };
      return [id, { id, to: path.dataset.inkTo!, kind: (path.dataset.inkKind ?? 'reading') as Ink, trail: one<SVGPathElement>(`[data-ink-trail="${id}"]`)!, drop, ...samples }];
    }));
    // Each handwritten line is revealed by a feathered mask as wide as the written text.
    for (const text of all<SVGTextElement>('[data-ink-note-line]')) {
      const box = text.getBBox(), rect = one<SVGRectElement>(`[data-ink-note-reveal="${text.dataset.inkNoteLine}"]`)!;
      rect.setAttribute('x', String(box.x - 4)); rect.setAttribute('y', String(box.y - 6)); rect.setAttribute('height', String(box.height + 12));
      rect.dataset.width = String(box.width * 1.3 + 12);
    }
    gsap.set(all('[data-ink-wash],[data-ink-icon],[data-ink-stamp]'), { svgOrigin: '0 0' });
  }

  function reset() {
    sounds?.stop(owner);
    for (const route of routes.values()) { route.drop.pop = 0; draw(route.drop); }
    for (const line of all('[data-ink-trail],[data-ink-mark],[data-ink-loop],[data-ink-group-loop]')) line.setAttribute('stroke-dashoffset', String(HIDDEN));
    gsap.set(all('[data-ink-reveal]'), { attr: { r: 0 } });
    gsap.set(all('[data-ink-note-reveal]'), { attr: { width: 0 } });
    gsap.set(all('[data-ink-wash]'), { opacity: 0, scale: .45 });
    gsap.set(all('[data-ink-icon]'), { scale: 1, scaleX: 1, scaleY: 1, rotation: 0, x: 0 });
    gsap.set(all('[data-ink-stamp]'), { opacity: 0, scale: 1.9, rotation: -26 });
    gsap.set(all('[data-ink-ripple],[data-ink-splash],[data-ink-flash],[data-ink-glow],[data-ink-mist]'), { opacity: 0 });
    gsap.set(all('[data-ink-mist]'), { y: 0 });
    gsap.set(all('.ink-name'), { fill: colors.pencil });
    gsap.set(all('.ink-detail'), { fill: colors.pencilDetail });
    gsap.set(all('[data-ink-junction]'), { fill: '#c3beae', attr: { r: 3.2 } });
    for (const item of all<SVGGElement>('[data-ink-node]')) item.dataset.state = 'pencil';
    root.dataset.flowStage = script.start;
  }
  // The complete page: every route inked and every note written. Also the reduced-motion view.
  function inked() {
    sounds?.stop(owner);
    for (const route of routes.values()) { route.drop.pop = 0; draw(route.drop); }
    for (const line of all('[data-ink-trail],[data-ink-mark],[data-ink-loop],[data-ink-group-loop]')) line.setAttribute('stroke-dashoffset', '0');
    gsap.set(all('[data-ink-reveal]'), { attr: { r: 72 } });
    for (const rect of all<SVGRectElement>('[data-ink-note-reveal]')) rect.setAttribute('width', rect.dataset.width!);
    gsap.set(all('[data-ink-wash]'), { opacity: 1, scale: 1 });
    gsap.set(all('[data-ink-icon]'), { scale: 1, scaleX: 1, scaleY: 1, rotation: 0, x: 0 });
    gsap.set(all('[data-ink-stamp]'), { opacity: .8, scale: 1, rotation: -9 });
    gsap.set(all('[data-ink-ripple],[data-ink-splash],[data-ink-flash],[data-ink-mist]'), { opacity: 0 });
    // The LEDs stay softly lit on the finished page.
    gsap.set(all('[data-ink-glow]'), { opacity: .45, scale: 1 });
    gsap.set(all('.ink-name'), { fill: colors.ink });
    gsap.set(all('[data-ink-node][data-final] .ink-name'), { fill: colors.final });
    gsap.set(all('.ink-detail'), { fill: colors.detail });
    gsap.set(all('[data-ink-junction]'), { fill: colors.ink, attr: { r: 3.2 } });
    for (const item of all<SVGGElement>('[data-ink-node]')) item.dataset.state = 'ink';
  }

  function stage(name: string, time: number) { timeline.call(() => { root.dataset.flowStage = name; }, [], time); }
  function sound(voice: Voice, time: number, spot?: Place) {
    timeline.call(() => { if (canSound()) sounds?.play(voice, owner, spot); }, [], time);
  }
  function stroke(target: Element | undefined, time: number, duration: number, ease = 'sine.inOut') {
    if (target) timeline.fromTo(target, { attr: { 'stroke-dashoffset': HIDDEN } }, { attr: { 'stroke-dashoffset': 0 }, duration, ease, immediateRender: false }, time);
  }
  // The closing loop is drawn with an audible pen stroke that follows its speed, fastest halfway round.
  function flourish(target: SVGPathElement | undefined, time: number, duration: number, spot: Place) {
    if (!target) return;
    const state = { progress: 0 }, speed = target.getTotalLength() / duration / strokeSpeed();
    timeline.fromTo(state, { progress: 0 }, { progress: 1, duration, ease: 'power1.inOut', immediateRender: false, onUpdate: () => {
      target.setAttribute('stroke-dashoffset', String(HIDDEN * (1 - state.progress)));
      if (hearing()) sounds!.pen(owner, 'loop', pace.quad(state.progress) * speed, 'reading', spot);
    }, onComplete: () => sounds?.lift(owner, 'loop') }, time);
  }
  function travel(route: Route, start: number, duration: number, gulp = false, level = 1) {
    const state = { progress: 0 }, speed = route.length / duration / strokeSpeed();
    // The pen scratches in step with the drop: loudest mid-route, quiet as it sets off and lands.
    timeline.fromTo(state, { progress: 0 }, { progress: 1, duration, ease: 'sine.inOut', immediateRender: false, onUpdate: () => {
      place(route, state.progress);
      if (hearing()) sounds!.pen(owner, route.id, pace.sine(state.progress) * speed, route.kind, where(route.drop.x, route.drop.y, level));
    }, onComplete: () => sounds?.lift(owner, route.id) }, start)
      // A fresh drop swells into being; a merged one gulps its two halves together.
      .fromTo(route.drop, { pop: gulp ? .55 : 0 }, { pop: 1, duration: gulp ? .5 : .32, ease: gulp ? 'elastic.out(1.1,.45)' : 'back.out(2.4)', immediateRender: false, onUpdate: () => draw(route.drop) }, start)
      .to(route.drop, { pop: 0, duration: .2, ease: 'power2.in', onUpdate: () => draw(route.drop) }, start + duration - .1);
  }
  function write(id: string, start: number, duration: number) {
    const lines = all<SVGRectElement>(`[data-ink-note-reveal^="${id}-"]`);
    const total = lines.reduce((sum, rect) => sum + Number(rect.dataset.width), 0);
    let time = start;
    for (const rect of lines) {
      const share = duration * Number(rect.dataset.width) / total;
      timeline.fromTo(rect, { attr: { width: 0 } }, { attr: { width: Number(rect.dataset.width) }, duration: share, ease: 'sine.inOut', immediateRender: false }, time);
      time += share;
    }
  }
  // Where a message enters a part, relative to its centre, so the ink spreads in from that side.
  function entry(id: string, incoming: Route[]) {
    const [x, y] = at(id);
    const route = incoming.find(item => item.to === id); if (!route) return [0, 0];
    const dx = route.xs.at(-1)! - x, dy = route.ys.at(-1)! - y, reach = Math.hypot(dx, dy) || 1;
    return [dx / reach * 34, dy / reach * 34];
  }
  // Several parts inked at once share the loudness of one.
  function arrive(id: string, time: number, kind: 'source' | 'hop' | 'final', incoming: Route[] = [], level = 1) {
    const target = node(id); if (!target) return;
    const icon = part(id, '[data-ink-icon]'), reveal = one<SVGCircleElement>(`[data-ink-reveal="${id}"]`)!, [ex, ey] = entry(id, incoming);
    timeline.call(() => {
      target.dataset.state = 'ink'; reveal.setAttribute('cx', String(ex)); reveal.setAttribute('cy', String(ey));
      for (const splash of part(id, '[data-ink-splash]')) { splash.setAttribute('cx', String(ex)); splash.setAttribute('cy', String(ey)); }
    }, [], time);
    if (kind !== 'source') sound('blot', time, whereIs(id, level));
    // Ink spreads into the icon from the side the message came in, then a watercolour wash blooms behind it.
    timeline.fromTo(reveal, { attr: { r: 0 } }, { attr: { r: 72 }, duration: .62, ease: 'power2.out', immediateRender: false }, time)
      .fromTo(part(id, '[data-ink-wash]'), { opacity: 0, scale: .45 }, { opacity: 1, scale: 1, duration: .8, ease: 'expo.out', immediateRender: false }, time + .05)
      .to(part(id, '.ink-name'), { fill: kind === 'final' ? colors.final : colors.ink, duration: .45, ease: 'sine.out' }, time)
      .to(part(id, '.ink-detail'), { fill: colors.detail, duration: .45, ease: 'sine.out' }, time);
    if (kind === 'source') { act(id, time); return; }
    timeline.fromTo(part(id, '[data-ink-splash]'), { opacity: .5, attr: { r: 4 } }, { opacity: 0, attr: { r: 21 }, duration: .6, ease: 'power2.out', immediateRender: false }, time);
    // Parts whose own action moves the icon skip the settling bounce, so two tweens never pull on it at once.
    if (!['stamp', 'layer', 'stack', 'film', 'spin', 'toggle', 'tilt'].includes(target.dataset.verb!)) timeline.fromTo(icon, { scale: 1.1 }, { scale: 1, duration: .7, ease: 'elastic.out(1,.55)', immediateRender: false }, time);
    act(id, time);
    if (kind === 'final') flourish(part(id, '[data-ink-loop]')[0] as SVGPathElement | undefined, time + .45, .95, whereIs(id, .8));
  }
  // Each part then does one small thing that shows its job, and makes the sound of it.
  function act(id: string, time: number) {
    const icon = part(id, '[data-ink-icon]'), mark = part(id, '[data-ink-mark]')[0], verb = node(id)!.dataset.verb!, delay = cues[verb];
    if (delay !== undefined) sound(verb as Voice, time + delay, whereIs(id));
    switch (verb) {
      case 'ripple': timeline.fromTo(part(id, '[data-ink-ripple]'), { opacity: .55, attr: { r: 16 } }, { opacity: 0, attr: { r: 46 }, duration: 1.15, ease: 'power1.out', stagger: .3, immediateRender: false }, time); break;
      case 'stamp': {
        const body = part(id, '[data-ink-stamp]');
        timeline.fromTo(body, { opacity: 0, scale: 1.9, rotation: -26 }, { opacity: .95, scale: 1, rotation: -9, duration: .26, ease: 'power3.in', immediateRender: false }, time + .1)
          .to(icon, { scale: .9, duration: .07, ease: 'power1.out' }, time + .36).to(icon, { scale: 1, duration: .6, ease: 'elastic.out(1,.4)' }, time + .43)
          .to(body, { opacity: .8, duration: .5, ease: 'sine.out' }, time + .5);
        break;
      }
      case 'scribble':
        stroke(mark, time + .12, .7);
        timeline.to(icon, { rotation: -9, duration: .14, ease: 'sine.out' }, time).to(icon, { rotation: 6, duration: .18, ease: 'sine.inOut' }, time + .14)
          .to(icon, { rotation: -3, duration: .16, ease: 'sine.inOut' }, time + .32).to(icon, { rotation: 0, duration: .24, ease: 'sine.out' }, time + .48);
        break;
      case 'layer': case 'stack': case 'film':
        stroke(mark, time + .12, .5, 'power2.out');
        timeline.fromTo(icon, { scaleX: 1.08, scaleY: .9 }, { scaleX: 1, scaleY: 1, duration: .7, ease: 'elastic.out(1,.5)', immediateRender: false }, time);
        break;
      case 'chart': stroke(mark, time + .15, .65); break;
      case 'tilt':
        timeline.to(icon, { rotation: -11, duration: .18, ease: 'sine.out' }, time).to(icon, { rotation: 8, duration: .24, ease: 'sine.inOut' }, time + .18)
          .to(icon, { rotation: 0, duration: .5, ease: 'elastic.out(1,.5)' }, time + .42);
        break;
      case 'toggle': timeline.fromTo(icon, { x: -6 }, { x: 0, duration: .6, ease: 'elastic.out(1.2,.45)', immediateRender: false }, time + .05); break;
      case 'spin': timeline.fromTo(icon, { rotation: 0 }, { rotation: 360, duration: 1.1, ease: 'power2.inOut', immediateRender: false }, time).set(icon, { rotation: 0 }, time + 1.1); break;
      case 'tick': timeline.fromTo(icon, { rotation: -28 }, { rotation: 0, duration: .8, ease: 'elastic.out(1,.4)', immediateRender: false }, time); break;
      case 'flash': timeline.fromTo(part(id, '[data-ink-flash]'), { opacity: .95, attr: { r: 8 } }, { opacity: 0, attr: { r: 38 }, duration: .55, ease: 'power2.out', immediateRender: false }, time + .08); break;
      // Small puffs of mist rise from the humidifier and fade.
      case 'mist': timeline.fromTo(part(id, '[data-ink-mist]'), { opacity: .8, y: 4 }, { opacity: 0, y: -22, duration: 1.1, ease: 'sine.out', stagger: .16, immediateRender: false }, time + .1); break;
      // The LEDs light up with a warm glow that settles to a steady light.
      case 'glow':
        timeline.fromTo(part(id, '[data-ink-glow]'), { opacity: 0, scale: .6 }, { opacity: .95, scale: 1.12, duration: .35, ease: 'power2.out', immediateRender: false }, time + .05)
          .to(part(id, '[data-ink-glow]'), { opacity: .45, scale: 1, duration: .7, ease: 'sine.inOut' }, time + .4);
        break;
    }
  }

  function build() {
    timeline.clear();
    const span = (route: Route) => gsap.utils.clamp(.7, 1.25, route.length / (narrow.matches ? 150 : 300));
    let time = .25, arrival = time;
    stage(script.start, time);
    for (const id of script.sources) arrive(id, time, 'source');
    time += .6;
    script.stretches.forEach((stretch, index) => {
      const phases = stretch.phases.map(ids => ids.map(id => routes.get(id)).filter((route): route is Route => !!route)).filter(phase => phase.length);
      if (!phases.length) return;
      for (const id of stretch.sources ?? []) arrive(id, time - .45, 'source');
      const durations = phases.map(phase => Math.max(...phase.map(span))), total = durations.reduce((sum, value) => sum + value, 0);
      const destinations = [...new Set(phases.at(-1)!.map(route => route.to))], final = index === script.stretches.length - 1;
      const destination = stretch.stage ?? destinations[0];
      stage(`to-${destination}`, time);
      for (const note of stretch.notes) write(note, time, total);
      let clock = time;
      phases.forEach((phase, step) => {
        // After two messages travel together, one continues: it gulps them together where they meet.
        const gulp = step > 0 && phases[step - 1].length > 1, dot = one('[data-ink-junction]');
        if (gulp && dot) sound('gulp', clock - .04, where(Number(dot.getAttribute('cx')), Number(dot.getAttribute('cy'))));
        for (const route of phase) travel(route, gulp ? clock - .04 : clock, durations[step], gulp, 1 / Math.sqrt(phase.length));
        if (step < phases.length - 1 && dot) timeline.to(dot, { fill: colors.ink, duration: .2, ease: 'sine.out' }, clock + durations[step]).fromTo(dot, { attr: { r: 6 } }, { attr: { r: 3.2 }, duration: .45, ease: 'back.out(3)', immediateRender: false }, clock + durations[step]);
        clock += durations[step];
      });
      stage(destination, clock);
      for (const id of destinations) arrive(id, clock, final ? 'final' : 'hop', phases.flat(), 1 / Math.sqrt(destinations.length));
      if (final) {
        finalStage = destination;
        const [x, y] = destinations.map(at).reduce(([sx, sy], [px, py]) => [sx + px / destinations.length, sy + py / destinations.length], [0, 0]);
        flourish(one<SVGPathElement>('[data-ink-group-loop]') ?? undefined, clock + .5, 1.2, where(x, y, .8));
      }
      arrival = clock; time = clock + (node(destinations[0])?.dataset.verb === 'stamp' ? .66 : .52);
    });
    timeline.to({}, { duration: .01 }, arrival + 1.35);
  }

  function syncControls() {
    const playing = active && inView && !document.hidden && !userPaused && !complete && !reduced.matches;
    const state = reduced.matches ? 'static' : complete ? 'complete' : playing ? 'running' : userPaused ? 'paused' : timeline.time() === 0 ? 'idle' : 'paused';
    root.dataset.flowState = state;
    pauseButton.disabled = complete || reduced.matches;
    pauseButton.setAttribute('aria-label', `${userPaused ? 'Play' : 'Pause'} ${flowName} Animation`);
    root.querySelector('[data-pathway-pause-label]')!.textContent = userPaused ? 'Play' : 'Pause';
    root.querySelector('[data-pathway-pause-icon]')!.textContent = userPaused ? '▷' : 'Ⅱ';
    controls.hidden = reduced.matches;
  }
  function finish() {
    complete = true; root.dataset.flowStage = finalStage; syncControls();
    status.textContent = `The ${flowName} path is complete. ${root.dataset.flowCompletion} Replay to follow it again.`;
  }
  function stillView() {
    timeline.pause(); complete = false; inked();
    root.dataset.flowStage = 'all'; status.textContent = `The complete ${flowName} pathway is shown with motion reduced.`;
    syncControls();
  }
  function syncPlayback() {
    if (!alive || !ready) return;
    if (reduced.matches) { stillView(); return; }
    if (active && inView && !document.hidden && !userPaused && !complete) timeline.play();
    else { timeline.pause(); sounds?.stop(owner); }
    syncControls();
  }
  function restart() {
    if (!ready) return;
    // Notes measured while their panel was hidden have no width yet: measure them now that it shows.
    if (all<SVGRectElement>('[data-ink-note-reveal]').some(rect => Number(rect.dataset.width) <= 12)) { timeline.clear(); mountLayout(); build(); }
    timeline.pause(0, true); complete = false; userPaused = false;
    reset(); status.textContent = `Following the ${flowName} pathway.`;
    syncPlayback();
  }
  function relayout() {
    // The phone and desktop drawings have different lines: rebuild, keeping a finished page finished.
    timeline.clear(); timeline.pause(0, true);
    mountLayout();
    if (complete) inked(); else reset();
    build(); syncPlayback();
  }

  pauseButton.addEventListener('click', () => { userPaused = !userPaused; syncPlayback(); if (!userPaused) sounds?.play('click', owner); }, events);
  replayButton.addEventListener('click', () => { restart(); sounds?.play('click', owner); }, events);
  // Start once most of the drawing is on screen (or it fills most of a short screen), then keep going while any of it shows.
  // Several reports can queue up during fast scrolling; read them in order so the newest one decides.
  const intersection = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.intersectionRatio >= .45 || entry.intersectionRect.height >= innerHeight * .6) started = true;
      inView = entry.isIntersecting && started;
    }
    syncPlayback();
  }, { threshold: [0, .15, .3, .45, .6, .75, .9, 1] });
  intersection.observe(canvas);
  document.addEventListener('visibilitychange', syncPlayback, events);
  reduced.addEventListener('change', () => reduced.matches ? stillView() : restart(), events);
  narrow.addEventListener('change', () => { if (ready) relayout(); }, events);
  window.addEventListener('pagehide', event => {
    timeline.pause(); sounds?.stop(owner);
    if (event.persisted) return;
    alive = false; intersection.disconnect(); abort.abort(); timeline.kill();
  }, events);
  window.addEventListener('pageshow', syncPlayback, events);
  // Notes are measured in their handwriting, so wait for the font before laying out the reveals.
  document.fonts.ready.then(() => {
    if (!alive) return;
    ready = true; mountLayout();
    if (reduced.matches) stillView(); else { reset(); build(); syncPlayback(); }
  });
  return {
    restart,
    setActive(value: boolean, replay = false) {
      active = value;
      if (value && replay) restart(); else syncPlayback();
    },
  };
}
