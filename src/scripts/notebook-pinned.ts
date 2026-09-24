// On phones, a photo page often has room below its margin note. Where a photograph's
// own note fits in that room, it is pinned there on paper so it can be read without
// opening the sticky note. It is measured per page and only placed where it fits above
// the folio; it is absolutely positioned, so it can never enlarge the page. The sticky
// note stays the accessible source, so the pinned copy is hidden from assistive technology.

export function pinNotes(pages: HTMLElement[], mobile: MediaQueryList) {
  const photoPages = pages.filter(page => page.classList.contains('nb-photo-page') && !page.querySelector('.nb-journey-photo-board') && page.querySelector('.nb-annotation p'));
  function place() {
    for (const page of photoPages) {
      page.querySelector(':scope > .nb-pinned-note')?.remove();
      if (!mobile.matches) continue;
      const pin = document.createElement('aside');
      pin.className = 'nb-pinned-note';
      pin.setAttribute('aria-hidden', 'true');
      page.querySelectorAll('.nb-annotation p').forEach((text, index) => {
        const note = document.createElement('p');
        const number = document.createElement('span');
        number.textContent = String(index + 1);
        note.append(number, text.textContent ?? '');
        pin.append(note);
      });
      page.append(pin);
      const folio = page.querySelector<HTMLElement>(':scope > .nb-folio');
      let bottom = 0;
      for (const child of page.children) {
        if (!(child instanceof HTMLElement) || child === pin || child === folio || getComputedStyle(child).position === 'absolute') continue;
        bottom = Math.max(bottom, child.offsetTop + child.offsetHeight);
      }
      const top = bottom + 14;
      pin.style.top = `${top}px`;
      if (!folio || top + pin.offsetHeight > folio.offsetTop - 12) pin.remove();
    }
  }
  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
  place();
  mobile.addEventListener('change', schedule);
  addEventListener('resize', schedule);
  document.fonts?.ready.then(schedule);
}
