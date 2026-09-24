// A flipbook of real dated stills taken from the same camera position. Dragging across
// the photograph blends from one still to the next; releasing settles on the nearest.
// The date scale is also a keyboard slider. The caption, the enlarge link and the
// accessible image follow the settled still.

export function mountFlipbook(figure: HTMLElement, reduced: MediaQueryList) {
  const stills = [...figure.querySelectorAll<HTMLImageElement>('.nb-flip-still')];
  const link = figure.querySelector<HTMLAnchorElement>('a[data-nb-image]')!;
  const frame = figure.querySelector<HTMLElement>('.nb-flip-frame')!;
  const scale = figure.querySelector<HTMLElement>('[data-nb-flip-scale]')!;
  const thumb = figure.querySelector<HTMLElement>('[data-nb-flip-thumb]')!;
  const marks = [...figure.querySelectorAll<HTMLElement>('[data-nb-flip-mark]')];
  const date = figure.querySelector<HTMLElement>('[data-nb-flip-date]')!;
  const { lead = '', source = '' } = figure.dataset;
  const last = stills.length - 1;
  const clamp = (value: number) => Math.min(last, Math.max(0, value));
  let value = clamp(Number(figure.dataset.start) || 0);
  let tween = 0;

  function paint(next: number) {
    value = clamp(next);
    const low = Math.floor(value), blend = value - low;
    // The lower still stays opaque while the next one fades over it, so blends never wash out.
    stills.forEach((still, index) => { still.style.opacity = index === low ? '1' : index === low + 1 ? blend.toFixed(3) : '0'; });
    thumb.style.left = `${(value / last) * 100}%`;
  }
  function settle(index: number) {
    const still = stills[index];
    stills.forEach((image, i) => { if (i === index) image.removeAttribute('aria-hidden'); else image.setAttribute('aria-hidden', 'true'); });
    marks.forEach((mark, i) => mark.toggleAttribute('data-current', i === index));
    scale.setAttribute('aria-valuenow', String(index));
    scale.setAttribute('aria-valuetext', still.dataset.date!);
    date.textContent = still.dataset.date!;
    link.href = still.getAttribute('src')!;
    link.dataset.caption = `${lead} · ${still.dataset.date}. ${source}.`;
    link.setAttribute('aria-label', `Enlarge photograph: ${lead} · ${still.dataset.date}`);
  }
  function goTo(target: number) {
    cancelAnimationFrame(tween);
    const index = clamp(Math.round(target)), from = value;
    if (reduced.matches || Math.abs(index - from) < .001) { paint(index); settle(index); return; }
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 340);
      paint(from + (index - from) * (1 - (1 - k) ** 3));
      if (k < 1) tween = requestAnimationFrame(step); else settle(index);
    };
    tween = requestAnimationFrame(step);
  }

  // Dragging the photograph scrubs relative to where it started; dragging the scale
  // follows the pointer's position along it.
  let drag: { id: number; x: number; from: number; moved: boolean; onScale: boolean } | undefined;
  let swallowClick = false;
  const scaleValue = (clientX: number) => {
    const track = thumb.parentElement!.getBoundingClientRect();
    return ((clientX - track.left) / track.width) * last;
  };
  frame.addEventListener('pointerdown', event => {
    if (event.button > 0) return;
    cancelAnimationFrame(tween);
    const onScale = scale.contains(event.target as Node);
    drag = { id: event.pointerId, x: event.clientX, from: value, moved: onScale, onScale };
    if (onScale) { if (event.isTrusted) scale.setPointerCapture(event.pointerId); paint(scaleValue(event.clientX)); }
  });
  frame.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.onScale) { paint(scaleValue(event.clientX)); return; }
    const dx = event.clientX - drag.x;
    if (!drag.moved) { if (Math.abs(dx) < 6) return; drag.moved = true; if (event.isTrusted) frame.setPointerCapture(event.pointerId); }
    paint(drag.from + (dx / link.getBoundingClientRect().width) * last);
  });
  const release = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      // With pointer capture the click may land on the frame instead of the link, so the
      // guard only lasts for the click that immediately follows this release.
      swallowClick = !drag.onScale; setTimeout(() => { swallowClick = false; });
      goTo(value);
    }
    drag = undefined;
  };
  frame.addEventListener('pointerup', release);
  frame.addEventListener('pointercancel', release);
  // A scrub is not a request to enlarge the photograph.
  link.addEventListener('click', event => { if (swallowClick) { event.preventDefault(); event.stopImmediatePropagation(); swallowClick = false; } }, true);
  scale.addEventListener('keydown', event => {
    const index = Math.round(value);
    const next = { ArrowLeft: index - 1, ArrowDown: index - 1, ArrowRight: index + 1, ArrowUp: index + 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault(); event.stopPropagation();
    goTo(next);
  });
  paint(value); settle(Math.round(value));
}
