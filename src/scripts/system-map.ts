import { gsap } from 'gsap';
import type { FlowSounds } from './flow-sounds';

type Route = 'observe' | 'respond' | 'record';
type Drop = { el: SVGGElement; x: number; y: number; angle: number; stretch: number; pop: number };
type Samples = { length: number; xs: Float32Array; ys: Float32Array; angles: Float32Array };
type Link = Samples & { id: string; to: string; route: Route; trail: SVGPathElement; drop: Drop };
// A path is a list of stretches. Each stretch moves one or more messages at once, in phases (two sensor readings,
// then the merged message); the stretch arrives where its last phase ends.
type Stretch = { phases: string[][]; sources?: string[] };
const scripts: Record<Route, { name: string; completion: string; sources: string[]; stretches: Stretch[] }> = {
  observe: {
    name: 'Observe', completion: 'Grafana displays the stored measurements.', sources: ['sht31', 'scd41'],
    stretches: [{ phases: [['sht31', 'scd41'], ['merged']] }, { phases: [['published']] }, { phases: [['stored']] }, { phases: [['visualized']] }],
  },
  respond: {
    name: 'Respond', completion: 'The devices change the air in the tent, and the sensors notice.', sources: ['mqtt', 'settings'],
    stretches: [{ phases: [['feed', 'settings']] }, { phases: [['commands', 'manual']], sources: ['ha'] }, { phases: [['route']] }, { phases: [['drive']] }, { phases: [['air']] }],
  },
  record: {
    name: 'Record', completion: 'Selected photographs and completed timelapses form the visual record.', sources: ['schedule'],
    stretches: [{ phases: [['trigger']] }, { phases: [['save']] }, { phases: [['prepare']] }],
  },
};
const routes = Object.keys(scripts) as Route[];

/** A finite, authored ink explanation of the connected system. No readings, device clocks or services. */
export function mountSystemMap(root: HTMLElement, sounds?: FlowSounds) {
  const canvas = root.querySelector<HTMLElement>('[data-pathway-canvas]')!;
  const controls = root.querySelector<HTMLElement>('[data-pathway-controls]')!;
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-pathway-pause]')!;
  const replayButton = root.querySelector<HTMLButtonElement>('[data-pathway-replay]')!;
  const status = root.querySelector<HTMLElement>('[data-pathway-status]')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), narrow = matchMedia('(max-width: 760px)');
  const abort = new AbortController(), events = { signal: abort.signal };
  const colors = { pencil: '#a9aa9c', pencilDetail: '#bbbcb0', ink: '#24332f', detail: '#7c8276', final: '#4f5a3c' };
  // Paper-hidden offset for stroke reveals: slightly past 1, so no round cap shows before a line starts.
  const HIDDEN = 1.03;
  const sampled = new WeakMap<SVGPathElement, Samples>(), finished = new WeakMap<SVGSVGElement, Set<Route>>();
  let route: Route = 'observe', svg!: SVGSVGElement, links = new Map<string, Link>();
  let active = true, inView = false, started = false, userPaused = false, complete = false, alive = true, ready = false;
  const timeline = gsap.timeline({ paused: true, onComplete: finish });
  const all = <T extends Element = SVGElement>(query: string, scope: ParentNode = svg) => Array.from(scope.querySelectorAll<T>(query));
  const one = <T extends Element = SVGElement>(query: string, scope: ParentNode = svg) => scope.querySelector<T>(query);
  const part = (id: string) => one<SVGGElement>(`[data-map-part="${id}"]`);
  const inside = (id: string, query: string) => all(query, part(id)!);
  const members = (el: Element) => ((el as SVGElement).dataset.member ?? '').split(' ');
  const done = (drawing: SVGSVGElement) => { if (!finished.has(drawing)) finished.set(drawing, new Set()); return finished.get(drawing)!; };
  const canSound = () => active && inView && !document.hidden && !userPaused && !reduced.matches;

  // Sample each route once; while the drop moves it only interpolates between stored points.
  function sample(path: SVGPathElement) {
    if (sampled.has(path)) return sampled.get(path)!;
    const length = path.getTotalLength(), count = Math.max(48, Math.ceil(length / 3));
    const xs = new Float32Array(count + 1), ys = new Float32Array(count + 1), angles = new Float32Array(count + 1);
    for (let i = 0; i <= count; i++) { const point = path.getPointAtLength(length * i / count); xs[i] = point.x; ys[i] = point.y; }
    for (let i = 0; i <= count; i++) { const a = Math.max(0, i - 1), b = Math.min(count, i + 1); angles[i] = Math.atan2(ys[b] - ys[a], xs[b] - xs[a]) * 180 / Math.PI; }
    const samples = { length, xs, ys, angles }; sampled.set(path, samples); return samples;
  }
  function draw(drop: Drop) {
    const visible = drop.pop > .001;
    drop.el.style.visibility = visible ? 'visible' : 'hidden';
    // The drop leans into its direction of travel and stretches most at full speed, mid-route.
    if (visible) drop.el.setAttribute('transform', `translate(${drop.x.toFixed(2)} ${drop.y.toFixed(2)}) rotate(${drop.angle.toFixed(1)}) scale(${(drop.pop * (1 + .34 * drop.stretch)).toFixed(3)} ${(drop.pop * (1 - .2 * drop.stretch)).toFixed(3)})`);
  }
  function place(link: Link, progress: number) {
    const last = link.xs.length - 1, at = Math.min(last, Math.max(0, progress * last)), i = Math.min(last - 1, Math.floor(at)), k = at - i;
    let turn = link.angles[i + 1] - link.angles[i];
    if (turn > 180) turn -= 360; else if (turn < -180) turn += 360;
    const drop = link.drop;
    drop.x = link.xs[i] + (link.xs[i + 1] - link.xs[i]) * k; drop.y = link.ys[i] + (link.ys[i + 1] - link.ys[i]) * k;
    drop.angle = link.angles[i] + turn * k; drop.stretch = Math.sin(Math.PI * progress);
    // The trail is inked up to the drop, so the line is written exactly where the message has been.
    link.trail.setAttribute('stroke-dashoffset', String(HIDDEN * (1 - progress)));
    draw(drop);
  }
  function drawingFor(value: Route) {
    return root.querySelector<SVGSVGElement>(narrow.matches ? `[data-map-layout="narrow-${value}"]` : '[data-map-layout="wide"]')!;
  }
  // Each handwritten line is revealed by a feathered mask as wide as the written text; hidden drawings are measured once shown.
  function measure(drawing: SVGSVGElement) {
    for (const text of all<SVGTextElement>('[data-map-note-line]', drawing)) {
      const rect = one<SVGRectElement>(`[data-map-note-reveal="${text.dataset.mapNoteLine}"]`, drawing)!;
      if (Number(rect.dataset.width) > 12) continue;
      const box = text.getBBox(); if (!box.width) continue;
      rect.setAttribute('x', String(box.x - 4)); rect.setAttribute('y', String(box.y - 6)); rect.setAttribute('height', String(box.height + 12));
      rect.dataset.width = String(box.width * 1.3 + 12);
    }
  }
  function prepare() {
    svg = drawingFor(route); measure(svg);
    links = new Map(all<SVGPathElement>('[data-map-link]').map((path): [string, Link] => {
      const id = path.dataset.mapLink!, samples = sample(path), group = path.closest<SVGGElement>('[data-map-link-group]')!;
      const drop: Drop = { el: one<SVGGElement>(`[data-map-drop="${id}"]`)!, x: samples.xs[0], y: samples.ys[0], angle: samples.angles[0], stretch: 0, pop: 0 };
      return [id, { id, to: path.dataset.mapTo!, route: group.dataset.member as Route, trail: one<SVGPathElement>(`[data-map-trail="${id}"]`)!, drop, ...samples }];
    }));
    gsap.set(all('[data-map-wash],[data-map-icon],[data-map-stamp]'), { svgOrigin: '0 0' });
  }

  // Parts shared with a finished path keep their ink when another path is reset.
  function kept(el: Element, value: Route, drawing: SVGSVGElement) { return members(el).some(member => member !== value && done(drawing).has(member as Route)); }
  function pencil(value: Route, drawing = svg) {
    gsap.set(all('[data-map-wash],[data-map-icon],[data-map-stamp]', drawing), { svgOrigin: '0 0' });
    for (const link of all<SVGGElement>(`[data-map-link-group][data-member="${value}"]`, drawing)) {
      link.querySelector('[data-map-trail]')!.setAttribute('stroke-dashoffset', String(HIDDEN));
      const drop = one<SVGGElement>(`[data-map-drop="${link.dataset.mapLinkGroup}"]`, drawing)!; drop.style.visibility = 'hidden';
    }
    gsap.set(all(`[data-map-note][data-member="${value}"] [data-map-note-line]`, drawing).map(text => one(`[data-map-note-reveal="${(text as SVGElement).dataset.mapNoteLine}"]`, drawing)!), { attr: { width: 0 } });
    for (const item of all<SVGGElement>('[data-map-part]', drawing)) {
      if (!members(item).includes(value) || kept(item, value, drawing)) continue;
      item.dataset.state = 'pencil';
      gsap.set(all('[data-map-reveal]', drawing).filter(circle => (circle as SVGElement).dataset.mapReveal === item.dataset.mapPart), { attr: { r: 0 } });
      gsap.set(all('[data-map-wash]', item), { opacity: 0, scale: .45 });
      gsap.set(all('[data-map-stamp]', item), { opacity: 0, scale: 1.9, rotation: -26 });
      for (const line of all('[data-map-mark],[data-map-loop]', item)) line.setAttribute('stroke-dashoffset', String(HIDDEN));
      gsap.set(all('.map-name', item), { fill: colors.pencil }); gsap.set(all('.map-detail', item), { fill: colors.pencilDetail });
    }
    if (value === 'observe') gsap.set(all('[data-map-junction]', drawing), { fill: '#c3beae', attr: { r: 3.2 } });
    gsap.set(all('[data-map-icon]', drawing), { scale: 1, scaleX: 1, scaleY: 1, rotation: 0, x: 0 });
    gsap.set(all('[data-map-ripple],[data-map-splash],[data-map-flash]', drawing), { opacity: 0 });
    done(drawing).delete(value);
  }
  // A path's finished page: every stretch inked and every note written. Also the reduced-motion view.
  function inked(value: Route, drawing = svg) {
    for (const link of all<SVGGElement>(`[data-map-link-group][data-member="${value}"]`, drawing)) {
      link.querySelector('[data-map-trail]')!.setAttribute('stroke-dashoffset', '0');
      const drop = one<SVGGElement>(`[data-map-drop="${link.dataset.mapLinkGroup}"]`, drawing)!; drop.style.visibility = 'hidden';
    }
    for (const text of all<SVGTextElement>(`[data-map-note][data-member="${value}"] [data-map-note-line]`, drawing)) {
      const rect = one<SVGRectElement>(`[data-map-note-reveal="${text.dataset.mapNoteLine}"]`, drawing)!;
      // A note never measured (its drawing was hidden) falls back to an uncropped reveal.
      if (rect.dataset.width) rect.setAttribute('width', rect.dataset.width); else { rect.setAttribute('x', '-4000'); rect.setAttribute('width', '8000'); }
    }
    for (const item of all<SVGGElement>('[data-map-part]', drawing)) {
      if (!members(item).includes(value)) continue;
      item.dataset.state = 'ink';
      gsap.set(all('[data-map-reveal]', drawing).filter(circle => (circle as SVGElement).dataset.mapReveal === item.dataset.mapPart), { attr: { r: 72 } });
      gsap.set(all('[data-map-wash]', item), { opacity: 1, scale: 1 });
      gsap.set(all('[data-map-stamp]', item), { opacity: .8, scale: 1, rotation: -9 });
      for (const line of all('[data-map-mark],[data-map-loop]', item)) line.setAttribute('stroke-dashoffset', '0');
      gsap.set(all('.map-name', item), { fill: all('[data-map-loop]', item).length ? colors.final : colors.ink }); gsap.set(all('.map-detail', item), { fill: colors.detail });
    }
    if (value === 'observe') gsap.set(all('[data-map-junction]', drawing), { fill: colors.ink, attr: { r: 3.2 } });
    done(drawing).add(value);
  }

  function stage(name: string, time: number) { timeline.call(() => { root.dataset.flowStage = name; }, [], time); }
  function cue(name: 'node' | 'travel' | 'complete', time: number, duration: number) {
    timeline.call(() => { if (canSound()) sounds?.play(name, route, duration / timeline.timeScale()); }, [], time);
  }
  function stroke(target: Element | undefined, time: number, duration: number, ease = 'sine.inOut') {
    if (target) timeline.fromTo(target, { attr: { 'stroke-dashoffset': HIDDEN } }, { attr: { 'stroke-dashoffset': 0 }, duration, ease, immediateRender: false }, time);
  }
  function travel(link: Link, start: number, duration: number, gulp = false) {
    const state = { progress: 0 };
    timeline.fromTo(state, { progress: 0 }, { progress: 1, duration, ease: 'sine.inOut', immediateRender: false, onUpdate: () => place(link, state.progress) }, start)
      // A fresh drop swells into being; a merged one gulps its two halves together.
      .fromTo(link.drop, { pop: gulp ? .55 : 0 }, { pop: 1, duration: gulp ? .5 : .32, ease: gulp ? 'elastic.out(1.1,.45)' : 'back.out(2.4)', immediateRender: false, onUpdate: () => draw(link.drop) }, start)
      .to(link.drop, { pop: 0, duration: .2, ease: 'power2.in', onUpdate: () => draw(link.drop) }, start + duration - .1);
  }
  function write(id: string, start: number, duration: number) {
    const lines = all<SVGRectElement>(`[data-map-note-reveal^="${id}-"]`);
    const total = lines.reduce((sum, rect) => sum + Number(rect.dataset.width), 0);
    let time = start;
    for (const rect of lines) {
      const share = duration * Number(rect.dataset.width) / total;
      timeline.fromTo(rect, { attr: { width: 0 } }, { attr: { width: Number(rect.dataset.width) }, duration: share, ease: 'sine.inOut', immediateRender: false }, time);
      time += share;
    }
  }
  // Where a message enters a part, relative to its centre, so the ink spreads in from that side.
  function entry(id: string, incoming: Link[]) {
    const [x, y] = part(id)!.getAttribute('transform')!.match(/-?[\d.]+/g)!.map(Number);
    const link = incoming.find(item => item.to === id); if (!link) return [0, 0];
    const dx = link.xs.at(-1)! - x, dy = link.ys.at(-1)! - y, reach = Math.hypot(dx, dy) || 1;
    return [dx / reach * 34, dy / reach * 34];
  }
  function arrive(id: string, time: number, kind: 'source' | 'hop' | 'final', incoming: Link[] = []) {
    const target = part(id); if (!target) return;
    const icon = inside(id, '[data-map-icon]'), reveal = all<SVGCircleElement>('[data-map-reveal]').find(circle => circle.dataset.mapReveal === id)!;
    const [ex, ey] = entry(id, incoming), alreadyInked = target.dataset.state === 'ink';
    timeline.call(() => { target.dataset.state = 'ink'; reveal.setAttribute('cx', String(ex)); reveal.setAttribute('cy', String(ey)); for (const splash of inside(id, '[data-map-splash]')) { splash.setAttribute('cx', String(ex)); splash.setAttribute('cy', String(ey)); } }, [], time);
    if (kind !== 'source') cue(kind === 'final' ? 'complete' : 'node', time, kind === 'final' ? 1.1 : .5);
    // Ink spreads into the icon from the side the message came in, then a watercolour wash blooms behind it.
    if (!alreadyInked) {
      timeline.fromTo(reveal, { attr: { r: 0 } }, { attr: { r: 72 }, duration: .62, ease: 'power2.out', immediateRender: false }, time)
        .fromTo(inside(id, '[data-map-wash]'), { opacity: 0, scale: .45 }, { opacity: 1, scale: 1, duration: .8, ease: 'expo.out', immediateRender: false }, time + .05)
        .to(inside(id, '.map-detail'), { fill: colors.detail, duration: .45, ease: 'sine.out' }, time);
    }
    timeline.to(inside(id, '.map-name'), { fill: kind === 'final' && inside(id, '[data-map-loop]').length ? colors.final : colors.ink, duration: .45, ease: 'sine.out' }, time);
    if (kind !== 'source') timeline.fromTo(inside(id, '[data-map-splash]'), { opacity: .5, attr: { r: 4 } }, { opacity: 0, attr: { r: 21 }, duration: .6, ease: 'power2.out', immediateRender: false }, time);
    if (kind !== 'source' && !['stamp', 'layer', 'spin', 'toggle', 'tilt'].includes(target.dataset.verb!)) timeline.fromTo(icon, { scale: 1.1 }, { scale: 1, duration: .7, ease: 'elastic.out(1,.55)', immediateRender: false }, time);
    if (kind === 'source' && target.dataset.verb === 'stamp') return;
    act(id, time);
    if (kind === 'final') stroke(inside(id, '[data-map-loop]')[0], time + .45, .95, 'power1.inOut');
  }
  // Each part then does one small thing that shows its job.
  function act(id: string, time: number) {
    const icon = inside(id, '[data-map-icon]'), mark = inside(id, '[data-map-mark]')[0];
    switch (part(id)!.dataset.verb) {
      case 'ripple': timeline.fromTo(inside(id, '[data-map-ripple]'), { opacity: .55, attr: { r: 16 } }, { opacity: 0, attr: { r: 46 }, duration: 1.15, ease: 'power1.out', stagger: .3, immediateRender: false }, time); break;
      case 'stamp': {
        const body = inside(id, '[data-map-stamp]');
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
      case 'flash': timeline.fromTo(inside(id, '[data-map-flash]'), { opacity: .95, attr: { r: 8 } }, { opacity: 0, attr: { r: 38 }, duration: .55, ease: 'power2.out', immediateRender: false }, time + .08); break;
    }
  }

  function build() {
    timeline.clear();
    const script = scripts[route], span = (link: Link) => gsap.utils.clamp(.7, 1.25, link.length / (narrow.matches ? 150 : 300));
    let time = .25;
    stage('sources', time);
    for (const id of script.sources) arrive(id, time, 'source');
    time += .6;
    script.stretches.forEach((stretch, index) => {
      const phases = stretch.phases.map(ids => ids.map(id => links.get(id)).filter((link): link is Link => !!link)).filter(phase => phase.length);
      if (!phases.length) return;
      for (const id of stretch.sources ?? []) arrive(id, time - .45, 'source');
      const durations = phases.map(phase => Math.max(...phase.map(span))), total = durations.reduce((sum, value) => sum + value, 0);
      const destination = phases.at(-1)![0].to, final = index === script.stretches.length - 1;
      stage(`to-${destination}`, time); cue('travel', time, total);
      for (const link of phases.flat()) if (all(`[data-map-note-reveal^="${link.id}-"]`).length) write(link.id, time, total);
      let clock = time;
      phases.forEach((phase, step) => {
        const gulp = step > 0 && phases[step - 1].length > 1;
        for (const link of phase) travel(link, gulp ? clock - .04 : clock, durations[step], gulp);
        if (step < phases.length - 1) {
          const dot = one('[data-map-junction]');
          if (dot) timeline.to(dot, { fill: colors.ink, duration: .2, ease: 'sine.out' }, clock + durations[step]).fromTo(dot, { attr: { r: 6 } }, { attr: { r: 3.2 }, duration: .45, ease: 'back.out(3)', immediateRender: false }, clock + durations[step]);
        }
        clock += durations[step];
      });
      stage(destination, clock); arrive(destination, clock, final ? 'final' : 'hop', phases.flat());
      time = clock + (part(destination)?.dataset.verb === 'stamp' ? .66 : .52);
    });
    timeline.to({}, { duration: .01 }, time + .9);
  }

  function syncControls() {
    const playing = active && inView && !document.hidden && !userPaused && !complete && !reduced.matches;
    const state = reduced.matches ? 'static' : complete ? 'complete' : playing ? 'running' : userPaused ? 'paused' : timeline.time() === 0 ? 'idle' : 'paused';
    root.dataset.flowState = state;
    if (playing || state === 'paused') root.dataset.mapPlaying = route; else delete root.dataset.mapPlaying;
    const name = scripts[route].name;
    pauseButton.disabled = complete || reduced.matches;
    pauseButton.setAttribute('aria-label', `${userPaused ? 'Play' : 'Pause'} ${name} Animation`);
    replayButton.setAttribute('aria-label', `Replay ${name} Animation`);
    root.querySelector('[data-pathway-pause-label]')!.textContent = userPaused ? 'Play' : 'Pause';
    root.querySelector('[data-pathway-pause-icon]')!.textContent = userPaused ? '▷' : 'Ⅱ';
    controls.hidden = reduced.matches;
  }
  function finish() {
    complete = true; done(svg).add(route); root.dataset.flowStage = 'complete'; syncControls();
    status.textContent = `The ${scripts[route].name} path is complete. ${scripts[route].completion} Replay to follow it again.`;
  }
  function stillView() {
    timeline.pause(); complete = false; sounds?.stop();
    for (const drawing of all<SVGSVGElement>('[data-map-layout]', root)) { measure(drawing); for (const value of routes) inked(value, drawing); }
    root.dataset.flowStage = 'all'; status.textContent = 'The complete connected system is shown with motion reduced.';
    syncControls();
  }
  function syncPlayback() {
    if (!alive || !ready) return;
    if (reduced.matches) { stillView(); return; }
    if (active && inView && !document.hidden && !userPaused && !complete) timeline.play();
    else { timeline.pause(); sounds?.stop(route); }
    syncControls();
  }
  // Choosing a path replays it; returning to a finished path without replaying shows its finished page.
  function select(value: Route, replay = true) {
    sounds?.stop(route);
    // A path left mid-way goes back to pencil rather than freezing half-drawn.
    if (ready && !reduced.matches && !complete && svg) pencil(route);
    route = value; root.dataset.mapRoute = value;
    if (!ready) return;
    // Clear before rewinding: rewinding a filled timeline would play the last path backwards and un-ink it.
    timeline.clear(); timeline.pause(0, true); prepare();
    if (reduced.matches) { stillView(); return; }
    complete = !replay && done(svg).has(value); userPaused = false;
    if (complete) { inked(value); root.dataset.flowStage = 'complete'; }
    else { pencil(value); build(); status.textContent = `Following the ${scripts[value].name} pathway.`; }
    syncPlayback();
  }
  function relayout() {
    // The phone chains and the desktop map are different drawings: rebuild, keeping finished paths finished.
    const wasComplete = complete;
    timeline.clear(); timeline.pause(0, true); prepare();
    if (wasComplete || done(svg).has(route)) { complete = true; inked(route); } else { pencil(route); build(); }
    syncPlayback();
  }

  pauseButton.addEventListener('click', () => { userPaused = !userPaused; syncPlayback(); if (!userPaused) sounds?.play('click', route); }, events);
  replayButton.addEventListener('click', () => { select(route); sounds?.play('click', route); }, events);
  // Start once most of the drawing is on screen (or it fills most of a short screen), then keep going while any of it shows.
  const intersection = new IntersectionObserver(([entry]) => {
    if (entry.intersectionRatio >= .45 || entry.intersectionRect.height >= innerHeight * .6) started = true;
    inView = entry.isIntersecting && started;
    syncPlayback();
  }, { threshold: [0, .15, .3, .45, .6, .75, .9, 1] });
  intersection.observe(canvas);
  document.addEventListener('visibilitychange', syncPlayback, events);
  reduced.addEventListener('change', () => reduced.matches ? stillView() : select(route), events);
  narrow.addEventListener('change', () => { if (ready) relayout(); }, events);
  window.addEventListener('pagehide', event => {
    timeline.pause(); sounds?.stop();
    if (event.persisted) return;
    alive = false; intersection.disconnect(); abort.abort(); timeline.kill();
  }, events);
  window.addEventListener('pageshow', syncPlayback, events);
  // Notes are measured in their handwriting, so wait for the font before laying out the reveals.
  document.fonts.ready.then(() => {
    if (!alive) return;
    ready = true;
    if (reduced.matches) { svg = drawingFor(route); stillView(); return; }
    // Everything starts in pencil; each path inks the map as it plays.
    for (const drawing of all<SVGSVGElement>('[data-map-layout]', root)) for (const value of routes) pencil(value, drawing);
    select(route, false);
  });
  return { select, restart: () => select(route) };
}
