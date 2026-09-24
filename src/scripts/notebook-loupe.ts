// A magnifying lens for notebook photographs. With a mouse it appears after a short
// rest over a photo; on touch it appears after a press-and-hold, above the finger.
// While a touch lens is up it owns the gesture: the page does not turn, scroll or
// open the lightbox. The lens is fixed-position, so it never affects layout.

const HOVER_DELAY = 280, HOLD_DELAY = 380, SIZE = 168;

export function mountLoupe(book: HTMLElement, binding: HTMLElement) {
  const lens = document.createElement('div');
  lens.className = 'nb-loupe';
  lens.setAttribute('aria-hidden', 'true');
  book.append(lens);
  let timer = 0, active = false, touch: { id: number; x: number; y: number } | undefined, swallowClick = false;

  /** The photograph under an event, preferring the visible still of a flipbook. */
  const photoAt = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    const hit = element?.closest<HTMLImageElement>('img');
    const link = hit?.closest('[data-nb-image]');
    if (!hit || !link || !binding.contains(link) || book.querySelector('.nb-leaf')) return undefined;
    const shown = link.querySelector<HTMLImageElement>('img:not([aria-hidden="true"])') ?? hit;
    return { hit, shown };
  };

  function hide() {
    clearTimeout(timer); active = false;
    lens.removeAttribute('data-on'); delete book.dataset.loupe;
  }
  /** Places the lens for a pointer at `offset` inside the image's own (unrotated) box. */
  function place(event: PointerEvent, photo: { hit: HTMLImageElement; shown: HTMLImageElement }, above: boolean) {
    const { hit, shown } = photo;
    const width = hit.offsetWidth, height = hit.offsetHeight;
    const natural = { w: shown.naturalWidth || width, h: shown.naturalHeight || height };
    // object-fit: cover crops the natural image; honour its object-position too.
    const scale = Math.max(width / natural.w, height / natural.h), drawnW = natural.w * scale, drawnH = natural.h * scale;
    const [px, py] = getComputedStyle(shown).objectPosition.split(' ').map(part => parseFloat(part) / 100);
    const u = (event.offsetX - (width - drawnW) * (isNaN(px) ? .5 : px)) / drawnW;
    const v = (event.offsetY - (height - drawnH) * (isNaN(py) ? .5 : py)) / drawnH;
    if (u < 0 || u > 1 || v < 0 || v > 1) { lens.removeAttribute('data-on'); return; }
    // Magnify up to 2.5x, but never far beyond the photograph's own resolution.
    const zoom = Math.max(1.5, Math.min(2.5, (natural.w * 1.3) / drawnW));
    lens.style.backgroundImage = `url("${shown.currentSrc || shown.src}")`;
    lens.style.backgroundSize = `${drawnW * zoom}px ${drawnH * zoom}px`;
    lens.style.backgroundPosition = `${SIZE / 2 - u * drawnW * zoom}px ${SIZE / 2 - v * drawnH * zoom}px`;
    lens.style.translate = `${event.clientX - SIZE / 2}px ${event.clientY - SIZE / 2 - (above ? 96 : 0)}px`;
    lens.setAttribute('data-on', '');
  }

  binding.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') {
      const photo = event.buttons ? undefined : photoAt(event.target);
      if (!photo || event.target !== photo.hit) { hide(); return; }
      if (active) place(event, photo, false);
      else if (!timer) timer = window.setTimeout(() => { timer = 0; active = true; place(event, photo, false); }, HOVER_DELAY);
      return;
    }
    if (!touch || event.pointerId !== touch.id) return;
    if (!active) { if (Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 8) { clearTimeout(timer); touch = undefined; } return; }
    const photo = photoAt(event.target);
    if (photo) place(event, photo, true);
    // The lens owns this gesture: page turns and flipbook scrubbing never see it.
    event.stopPropagation();
  }, { capture: true });
  binding.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') { hide(); return; }
    const photo = photoAt(event.target);
    if (!photo || event.target !== photo.hit) return;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY };
    clearTimeout(timer);
    timer = window.setTimeout(() => { timer = 0; active = true; book.dataset.loupe = ''; place(event, photo, true); }, HOLD_DELAY);
  }, { capture: true });
  const release = (event: PointerEvent) => {
    if (!touch || event.pointerId !== touch.id) return;
    if (active) { event.stopPropagation(); swallowClick = true; setTimeout(() => { swallowClick = false; }); }
    touch = undefined; hide();
  };
  binding.addEventListener('pointerup', release, { capture: true });
  binding.addEventListener('pointercancel', release, { capture: true });
  binding.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') hide(); });
  binding.addEventListener('click', event => { if (swallowClick) { event.preventDefault(); event.stopImmediatePropagation(); swallowClick = false; } }, { capture: true });
  // Holding a photograph should magnify it, not open the browser's image menu or scroll.
  binding.addEventListener('contextmenu', event => { if (touch || active) event.preventDefault(); });
  binding.addEventListener('touchmove', event => { if (active) event.preventDefault(); }, { passive: false });
  addEventListener('scroll', () => { if (!touch) hide(); }, { passive: true });
}
