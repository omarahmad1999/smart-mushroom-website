import { gsap } from 'gsap';
import type { FlowSounds } from './flow-sounds';

type Drop = { el: SVGGElement; x: number; y: number; angle: number; stretch: number; pop: number };
type Route = { id: string; to: string; trail: SVGPathElement; drop: Drop; length: number; xs: Float32Array; ys: Float32Array; angles: Float32Array };

/** A finite, authored ink explanation of one pathway. No readings, device clocks or services. */
export function mountInkFlow(root: HTMLElement, sounds?: FlowSounds) {
  const canvas = root.querySelector<HTMLElement>('[data-pathway-canvas]')!;
  const controls = root.querySelector<HTMLElement>('[data-pathway-controls]')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pathway-pause]')!;
  const replayButton = root.querySelector<HTMLButtonElement>('[data-pathway-replay]')!;
  const status = root.querySelector<HTMLElement>('[data-pathway-status]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 760px)');
  const abort = new AbortController(), events = { signal: abort.signal };
  const flowName = root.dataset.flowName!, owner = root.dataset.systemFlow!;
  const colors = { pencil: '#a9aa9c', pencilDetail: '#bbbcb0', ink: '#24332f', detail: '#7c8276', final: '#4f5a3c' };
  // Paper-hidden offset for stroke reveals: slightly past 1, so no round cap shows before a line starts.
  const HIDDEN = 1.03;
  let active = true, inView = false, started = false, userPaused = false, complete = false, alive = true, ready = false;
  let diagram!: SVGSVGElement, routes = new Map<string, Route>(), lastId = '';
  const timeline = gsap.timeline({ paused: true, onComplete: finish });
  const all = <T extends Element = SVGElement>(query: string, scope: ParentNode = diagram) => Array.from(scope.querySelectorAll<T>(query));
  const one = <T extends Element = SVGElement>(query: string) => diagram.querySelector<T>(query)!;
  const node = (id: string) => one<SVGGElement>(`[data-ink-node="${id}"]`);
  const part = (id: string, query: string) => all(query, node(id));
  const canSound = () => active && inView && !document.hidden && !userPaused && !reduced.matches;

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
    const nodes = all<SVGGElement>('[data-ink-node]');
    lastId = nodes.at(-1)!.dataset.inkNode!;
    routes = new Map(all<SVGPathElement>('[data-ink-route]').map((path): [string, Route] => {
      const id = path.dataset.inkRoute!, samples = sample(path);
      const drop: Drop = { el: one<SVGGElement>(`[data-ink-drop="${id}"]`), x: samples.xs[0], y: samples.ys[0], angle: samples.angles[0], stretch: 0, pop: 0 };
      return [id, { id, to: path.dataset.inkTo!, trail: one<SVGPathElement>(`[data-ink-trail="${id}"]`), drop, ...samples }];
    }));
    // Each handwritten line is revealed by a feathered mask as wide as the written text.
    for (const text of all<SVGTextElement>('[data-ink-note-line]')) {
      const box = text.getBBox(), rect = one<SVGRectElement>(`[data-ink-note-reveal="${text.dataset.inkNoteLine}"]`);
      rect.setAttribute('x', String(box.x - 4)); rect.setAttribute('y', String(box.y - 6)); rect.setAttribute('height', String(box.height + 12));
      rect.dataset.width = String(box.width * 1.3 + 12);
    }
    gsap.set(all('[data-ink-wash],[data-ink-icon],[data-ink-stamp]'), { svgOrigin: '0 0' });
  }

  function reset() {
    sounds?.stop(owner);
    for (const route of routes.values()) { route.drop.pop = 0; draw(route.drop); }
    for (const line of all('[data-ink-trail],[data-ink-mark],[data-ink-loop]')) line.setAttribute('stroke-dashoffset', String(HIDDEN));
    gsap.set(all('[data-ink-reveal]'), { attr: { r: 0 } });
    gsap.set(all('[data-ink-note-reveal]'), { attr: { width: 0 } });
    gsap.set(all('[data-ink-wash]'), { opacity: 0, scale: .45 });
    gsap.set(all('[data-ink-icon]'), { scale: 1, scaleX: 1, scaleY: 1, rotation: 0 });
    gsap.set(all('[data-ink-stamp]'), { opacity: 0, scale: 1.9, rotation: -26 });
    gsap.set(all('[data-ink-ripple],[data-ink-splash]'), { opacity: 0 });
    gsap.set(all('.ink-name'), { fill: colors.pencil });
    gsap.set(all('.ink-detail'), { fill: colors.pencilDetail });
    gsap.set(all('[data-ink-junction]'), { fill: '#c3beae', attr: { r: 3.2 } });
    for (const item of all<SVGGElement>('[data-ink-node]')) item.dataset.state = 'pencil';
    root.dataset.flowStage = 'sensors';
  }
  // The complete page: every route inked and every note written. Also the reduced-motion view.
  function inked() {
    sounds?.stop(owner);
    for (const route of routes.values()) { route.drop.pop = 0; draw(route.drop); }
    for (const line of all('[data-ink-trail],[data-ink-mark],[data-ink-loop]')) line.setAttribute('stroke-dashoffset', '0');
    gsap.set(all('[data-ink-reveal]'), { attr: { r: 72 } });
    for (const rect of all<SVGRectElement>('[data-ink-note-reveal]')) rect.setAttribute('width', rect.dataset.width!);
    gsap.set(all('[data-ink-wash]'), { opacity: 1, scale: 1 });
    gsap.set(all('[data-ink-icon]'), { scale: 1, scaleX: 1, scaleY: 1, rotation: 0 });
    gsap.set(all('[data-ink-stamp]'), { opacity: .8, scale: 1, rotation: -9 });
    gsap.set(all('[data-ink-ripple],[data-ink-splash]'), { opacity: 0 });
    gsap.set(all('.ink-name'), { fill: colors.ink });
    gsap.set(part(lastId, '.ink-name'), { fill: colors.final });
    gsap.set(all('.ink-detail'), { fill: colors.detail });
    gsap.set(all('[data-ink-junction]'), { fill: colors.ink, attr: { r: 3.2 } });
    for (const item of all<SVGGElement>('[data-ink-node]')) item.dataset.state = 'ink';
  }

  function stage(name: string, time: number) { timeline.call(() => { root.dataset.flowStage = name; }, [], time); }
  function cue(name: 'node' | 'travel' | 'complete', time: number, duration: number) {
    timeline.call(() => { if (canSound()) sounds?.play(name, owner, duration / timeline.timeScale()); }, [], time);
  }
  function stroke(target: Element, time: number, duration: number, ease = 'sine.inOut') {
    timeline.fromTo(target, { attr: { 'stroke-dashoffset': HIDDEN } }, { attr: { 'stroke-dashoffset': 0 }, duration, ease, immediateRender: false }, time);
  }
  function travel(route: Route, start: number, duration: number, gulp = false) {
    const state = { progress: 0 };
    timeline.fromTo(state, { progress: 0 }, { progress: 1, duration, ease: 'sine.inOut', immediateRender: false, onUpdate: () => place(route, state.progress) }, start)
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
  function arrive(id: string, time: number, kind: 'source' | 'hop' | 'final' = 'hop') {
    const target = node(id), icon = part(id, '[data-ink-icon]');
    timeline.call(() => { target.dataset.state = 'ink'; }, [], time);
    if (kind !== 'source') cue(kind === 'final' ? 'complete' : 'node', time, kind === 'final' ? 1.1 : .5);
    // Ink spreads into the icon from the side the message came in, then a watercolour wash blooms behind it.
    timeline.fromTo(one(`[data-ink-reveal="${id}"]`), { attr: { r: 0 } }, { attr: { r: 72 }, duration: .62, ease: 'power2.out', immediateRender: false }, time)
      .fromTo(part(id, '[data-ink-wash]'), { opacity: 0, scale: .45 }, { opacity: 1, scale: 1, duration: .8, ease: 'expo.out', immediateRender: false }, time + .05)
      .to(part(id, '.ink-name'), { fill: kind === 'final' ? colors.final : colors.ink, duration: .45, ease: 'sine.out' }, time)
      .to(part(id, '.ink-detail'), { fill: colors.detail, duration: .45, ease: 'sine.out' }, time);
    if (kind !== 'source') timeline.fromTo(part(id, '[data-ink-splash]'), { opacity: .5, attr: { r: 4 } }, { opacity: 0, attr: { r: 21 }, duration: .6, ease: 'power2.out', immediateRender: false }, time);
    if (id === 'writer' || kind === 'final') timeline.fromTo(icon, { scale: 1.1 }, { scale: 1, duration: .7, ease: 'elastic.out(1,.55)', immediateRender: false }, time);
  }
  // Each part then does one small thing that shows its job.
  function ripple(id: string, time: number) {
    timeline.fromTo(part(id, '[data-ink-ripple]'), { opacity: .55, attr: { r: 16 } }, { opacity: 0, attr: { r: 46 }, duration: 1.15, ease: 'power1.out', stagger: .3, immediateRender: false }, time);
  }
  function stamp(time: number) {
    const body = part('mqtt', '[data-ink-stamp]'), icon = part('mqtt', '[data-ink-icon]');
    timeline.fromTo(body, { opacity: 0, scale: 1.9, rotation: -26 }, { opacity: .95, scale: 1, rotation: -9, duration: .26, ease: 'power3.in', immediateRender: false }, time + .1)
      .to(icon, { scale: .9, duration: .07, ease: 'power1.out' }, time + .36)
      .to(icon, { scale: 1, duration: .6, ease: 'elastic.out(1,.4)' }, time + .43)
      .to(body, { opacity: .8, duration: .5, ease: 'sine.out' }, time + .5);
  }
  function scribble(time: number) {
    const icon = part('writer', '[data-ink-icon]');
    stroke(part('writer', '[data-ink-mark]')[0], time + .12, .7);
    timeline.to(icon, { rotation: -9, duration: .14, ease: 'sine.out' }, time)
      .to(icon, { rotation: 6, duration: .18, ease: 'sine.inOut' }, time + .14)
      .to(icon, { rotation: -3, duration: .16, ease: 'sine.inOut' }, time + .32)
      .to(icon, { rotation: 0, duration: .24, ease: 'sine.out' }, time + .48);
  }
  function layer(time: number) {
    stroke(part('timescale', '[data-ink-mark]')[0], time + .12, .5, 'power2.out');
    timeline.fromTo(part('timescale', '[data-ink-icon]'), { scaleX: 1.08, scaleY: .9 }, { scaleX: 1, scaleY: 1, duration: .7, ease: 'elastic.out(1,.5)', immediateRender: false }, time);
  }
  function chart(time: number) {
    stroke(part('grafana', '[data-ink-mark]')[0], time + .15, .65);
    stroke(part('grafana', '[data-ink-loop]')[0], time + .45, .95, 'power1.inOut');
  }
  function merge(time: number) {
    const dot = one('[data-ink-junction]');
    timeline.to(dot, { fill: colors.ink, duration: .2, ease: 'sine.out' }, time)
      .fromTo(dot, { attr: { r: 6 } }, { attr: { r: 3.2 }, duration: .45, ease: 'back.out(3)', immediateRender: false }, time);
  }

  function build() {
    timeline.clear();
    const route = (id: string) => routes.get(id)!;
    const span = (item: Route) => gsap.utils.clamp(.7, 1.25, item.length / (narrow.matches ? 150 : 300));
    let time = .25;
    stage('sensors', time); arrive('sht31', time, 'source'); arrive('scd41', time, 'source'); ripple('sht31', time); ripple('scd41', time);
    // Both sensors send together; their drops meet at the junction and continue as one message.
    const depart = time + .6, branch = Math.max(span(route('sht31')), span(route('scd41'))), joined = span(route('merged'));
    stage('to-mqtt', depart); cue('travel', depart, branch + joined);
    travel(route('sht31'), depart, branch); travel(route('scd41'), depart, branch);
    write('readings', depart, branch + joined);
    merge(depart + branch); travel(route('merged'), depart + branch - .04, joined, true);
    time = depart + branch + joined; stage('mqtt', time); arrive('mqtt', time); stamp(time);
    const verbs: Record<string, (time: number) => void> = { writer: scribble, timescale: layer, grafana: chart };
    for (const id of ['published', 'stored', 'visualized']) {
      const item = route(id), start = time + (id === 'published' ? .66 : .52), duration = span(item);
      stage(`to-${item.to}`, start); cue('travel', start, duration);
      travel(item, start, duration); write(id, start, duration);
      time = start + duration; stage(item.to, time); arrive(item.to, time, item.to === lastId ? 'final' : 'hop'); verbs[item.to](time);
    }
    timeline.to({}, { duration: .01 }, time + 1.35);
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
    complete = true; root.dataset.flowStage = lastId; syncControls();
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
    timeline.pause(0, true); timeline.clear();
    mountLayout();
    if (complete) inked(); else reset();
    build(); syncPlayback();
  }

  pauseButton.addEventListener('click', () => { userPaused = !userPaused; syncPlayback(); if (!userPaused) sounds?.play('click', owner); }, events);
  replayButton.addEventListener('click', () => { restart(); sounds?.play('click', owner); }, events);
  // Start once most of the drawing is on screen (or it fills most of a short screen), then keep going while any of it shows.
  const intersection = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .45 || entry.intersectionRect.height >= innerHeight * .6) started = true;
    inView = entry.isIntersecting && started;
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
