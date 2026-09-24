// A soft paper leaf for the field notebook. The turning page is clipped along a
// fold line that follows its corner; the reverse face is placed by reflecting it
// across the spine and then the fold. Two reflections make a rotation, so text on
// the reverse is never mirrored. Everything lives inside the existing fold layer,
// so the notebook's accepted dimensions are untouched.

type Point = { x: number; y: number };
type Polygon = Point[];
export type LeafState = 'flat' | 'turned';
export type Row = 'top' | 'bottom';

export interface LeafOptions {
  host: HTMLElement;
  /** Horizontal position of the spine inside the host. */
  spine: number;
  /** Width of one page. */
  width: number;
  height: number;
  /** Face shown while the leaf lies to the right of the spine. */
  right: HTMLElement;
  /** Face shown once the leaf has turned to the left of the spine. */
  left: HTMLElement;
  /** Pages beneath the leaf, already positioned. */
  under: HTMLElement[];
  row: Row;
  start: LeafState;
  shadow: boolean;
}

export interface Leaf {
  element: HTMLElement;
  /** 0 when flat on the right, 1 when turned to the left. */
  progress(): number;
  corner(state: LeafState): Point;
  /** Follows a pointer. The point is constrained so the paper stays bound at the spine. */
  follow(point: Point): void;
  play(target: LeafState | Point, duration?: number): Promise<void>;
  destroy(): void;
}

const clipHalf = (polygon: Polygon, origin: Point, normal: Point, keepPositive: boolean): Polygon => {
  const side = (p: Point) => ((p.x - origin.x) * normal.x + (p.y - origin.y) * normal.y) * (keepPositive ? 1 : -1);
  const out: Polygon = [];
  polygon.forEach((a, index) => {
    const b = polygon[(index + 1) % polygon.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  });
  return out;
};
const polygonCss = (polygon: Polygon, offsetX: number) => polygon.length < 3 ? 'polygon(0 0,0 0,0 0)'
  : `polygon(${polygon.map(p => `${(p.x - offsetX).toFixed(2)}px ${p.y.toFixed(2)}px`).join(',')})`;
/** A linear gradient whose stops are measured in pixels from `origin` along `direction`. */
const gradientCss = (width: number, height: number, origin: Point, direction: Point, stops: [string, number][]) => {
  const angle = Math.atan2(direction.x, -direction.y);
  const length = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
  const start = { x: width / 2 - direction.x * length / 2, y: height / 2 - direction.y * length / 2 };
  const offset = (origin.x - start.x) * direction.x + (origin.y - start.y) * direction.y;
  return `linear-gradient(${angle.toFixed(4)}rad,${stops.map(([color, at]) => `${color} ${(offset + at).toFixed(1)}px`).join(',')})`;
};

const box = (className: string, left: number, width: number, child?: HTMLElement) => {
  const element = document.createElement('div');
  element.className = className;
  Object.assign(element.style, { left: `${left}px`, width: `${width}px` });
  if (child) element.append(child);
  return element;
};

export function createLeaf(options: LeafOptions): Leaf {
  const { spine, width: W, height: H } = options;
  const rowY = options.row === 'bottom' ? H : 0;
  const lift = options.row === 'bottom' ? -1 : 1;
  const flatCorner = { x: spine + W, y: rowY }, turnedCorner = { x: spine - W, y: rowY };
  const anchor = { x: spine, y: rowY }, farAnchor = { x: spine, y: H - rowY };
  const rightRect: Polygon = [{ x: spine, y: 0 }, { x: spine + W, y: 0 }, { x: spine + W, y: H }, { x: spine, y: H }];

  const element = document.createElement('div');
  element.className = 'nb-leaf';
  element.inert = true;
  const under = document.createElement('div');
  under.className = 'nb-leaf-under';
  under.append(...options.under);
  const front = box('nb-leaf-front', spine, W, options.right);
  const reveal = box('nb-leaf-reveal', spine, W);
  const flap = document.createElement('div');
  flap.className = 'nb-leaf-flap';
  const cast = document.createElement('div');
  cast.className = options.shadow ? 'nb-leaf-cast' : 'nb-leaf-cast nb-leaf-cast-flat';
  const back = box('nb-leaf-back', spine - W, W, options.left);
  const sheen = box('nb-leaf-sheen', spine - W, W);
  cast.append(back, sheen);
  flap.append(cast);
  element.append(under, front, reveal, flap);
  options.host.append(element);

  let corner = options.start === 'flat' ? { ...flatCorner } : { ...turnedCorner };
  let clock: Animation | undefined;
  let frame = 0;
  let alive = true;

  const constrain = (point: Point): Point => {
    let q = { x: point.x, y: options.row === 'bottom' ? Math.min(point.y, H) : Math.max(point.y, 0) };
    const near = Math.hypot(q.x - anchor.x, q.y - anchor.y);
    if (near > W) q = { x: anchor.x + (q.x - anchor.x) * W / near, y: anchor.y + (q.y - anchor.y) * W / near };
    const diagonal = Math.hypot(W, H), far = Math.hypot(q.x - farAnchor.x, q.y - farAnchor.y);
    if (far > diagonal) q = { x: farAnchor.x + (q.x - farAnchor.x) * diagonal / far, y: farAnchor.y + (q.y - farAnchor.y) * diagonal / far };
    return q;
  };

  function draw(point: Point) {
    corner = point;
    const dx = flatCorner.x - point.x, dy = flatCorner.y - point.y, distance = Math.hypot(dx, dy);
    if (distance < .5) {
      front.style.clipPath = 'none'; reveal.style.clipPath = back.style.clipPath = sheen.style.clipPath = 'polygon(0 0,0 0,0 0)';
      flap.style.transform = 'none'; return;
    }
    // The fold is the perpendicular bisector of the resting corner and its current position.
    const normal = { x: dx / distance, y: dy / distance };
    const middle = { x: (flatCorner.x + point.x) / 2, y: (flatCorner.y + point.y) / 2 };
    const bound = clipHalf(rightRect, middle, normal, false);
    const lifted = clipHalf(rightRect, middle, normal, true);
    front.style.clipPath = polygonCss(bound, spine);
    reveal.style.clipPath = polygonCss(lifted, spine);
    reveal.style.background = gradientCss(W, H, { x: middle.x - spine, y: middle.y }, normal, [['#2c21134d', 0], ['#2c211300', 46]]);
    // Reverse face: mirror across the spine, then reflect across the fold.
    const along = { x: -normal.y, y: normal.x };
    const a = along.x * along.x - along.y * along.y, b = 2 * along.x * along.y;
    const e = a * (2 * spine - middle.x) - b * middle.y + middle.x;
    const f = b * (2 * spine - middle.x) + a * middle.y + middle.y;
    flap.style.transform = `matrix(${-a},${-b},${b},${-a},${e},${f})`;
    const mirrored = lifted.map(p => ({ x: 2 * spine - p.x, y: p.y }));
    back.style.clipPath = sheen.style.clipPath = polygonCss(mirrored, spine - W);
    sheen.style.background = gradientCss(W, H, { x: 2 * spine - middle.x - (spine - W), y: middle.y }, { x: -normal.x, y: normal.y },
      [['#3b2a1638', 0], ['#3b2a1600', 26], ['#fffdf51c', 70], ['#fffdf500', 170]]);
  }

  // Positions are interpolated around the near spine anchor: angle 0 is flat, π is turned.
  // `arc` flattens the circle so an automatic turn lifts the corner only part of the way.
  const polar = (point: Point) => {
    // Math.max also turns -0 into 0, so a turned corner reads as π rather than -π.
    const radius = Math.hypot(point.x - anchor.x, point.y - anchor.y), angle = Math.atan2(Math.max(0, lift * (point.y - anchor.y)), point.x - anchor.x);
    const rise = radius * Math.sin(angle);
    return { radius, angle, arc: rise > 1 ? lift * (point.y - anchor.y) / rise : shape(angle) };
  };
  const shape = (angle: number) => .26 + .74 * Math.abs(Math.cos(angle));
  const fromPolar = (radius: number, angle: number, arc: number) => constrain({ x: anchor.x + radius * Math.cos(angle), y: anchor.y + lift * radius * Math.sin(angle) * arc });
  const progress = () => Math.min(1, Math.max(0, Math.acos(Math.max(-1, Math.min(1, (corner.x - anchor.x) / W))) / Math.PI));

  draw(corner);

  return {
    element,
    progress,
    corner: state => ({ ...(state === 'flat' ? flatCorner : turnedCorner) }),
    follow(point) { if (!alive) return; clock?.cancel(); draw(constrain(point)); },
    play(target, duration = 760) {
      if (!alive) return Promise.resolve();
      clock?.cancel(); cancelAnimationFrame(frame);
      const start = { ...corner };
      const goal = typeof target === 'string' ? (target === 'flat' ? flatCorner : turnedCorner) : constrain(target);
      const from = polar(start), to = polar(goal);
      // Keep the arc continuous with where the corner starts and ends, and shaped in between.
      const startBias = from.arc - shape(from.angle), endBias = to.arc - shape(to.angle);
      // WAAPI is the clock, so the turn can be paused, sought and finished like any animation.
      clock = element.animate([{ opacity: 1 }, { opacity: 1 }], { duration, easing: 'cubic-bezier(.3,.1,.25,1)' });
      const current = clock;
      const step = () => {
        if (!alive || clock !== current) return;
        const timing = current.effect?.getComputedTiming();
        const t = current.playState === 'finished' ? 1 : Number(timing?.progress ?? 0);
        const angle = from.angle + (to.angle - from.angle) * t;
        const radius = from.radius + (to.radius - from.radius) * t;
        draw(t >= 1 ? goal : fromPolar(radius, angle, shape(angle) + startBias + (endBias - startBias) * t));
        if (current.playState !== 'finished') frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
      return current.finished.then(() => { if (clock === current) draw(goal); }, () => undefined);
    },
    destroy() { alive = false; clock?.cancel(); cancelAnimationFrame(frame); element.remove(); },
  };
}
