// The home page's chapter bar: it follows the reader through the sections, shows how far through the current
// one they are, and on a phone opens the full list of chapters beneath it.
const contents = document.querySelector<HTMLElement>('[data-home-contents]');
if (contents) {
  const toggle = contents.querySelector<HTMLButtonElement>('[data-contents-toggle]')!;
  const scrim = contents.querySelector<HTMLElement>('[data-contents-scrim]')!;
  const currentNumber = contents.querySelector<HTMLElement>('[data-current-number]')!;
  const currentName = contents.querySelector<HTMLElement>('[data-current-name]')!;
  const links = [...contents.querySelectorAll<HTMLAnchorElement>('[data-home-section]')];
  const sections = links.map(link => document.getElementById(link.dataset.homeSection!));
  const compact = matchMedia('(max-width: 1000px)');
  // With the script running, the phone layout switches from a scrolling row of links to the drop-down list.
  contents.dataset.ready = '';

  let open = false;
  function setOpen(value: boolean, returnFocus = false) {
    open = value && compact.matches;
    toggle.setAttribute('aria-expanded', String(open));
    contents!.toggleAttribute('data-open', open);
    scrim.hidden = !open;
    if (!open && returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(!open));
  scrim.addEventListener('click', () => setOpen(false));
  for (const link of links) link.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && open) setOpen(false, true); });
  // Tabbing out of the list closes it.
  contents.addEventListener('focusout', event => { if (open && !contents.contains(event.relatedTarget as Node | null)) setOpen(false); });
  compact.addEventListener('change', () => setOpen(false));

  // The current chapter is the last whose top has passed a line a third of the way down the screen.
  let frame = 0, shown = -1;
  function follow() {
    frame = 0;
    const line = innerHeight * .35;
    let index = 0;
    sections.forEach((section, i) => { if (section && section.getBoundingClientRect().top <= line) index = i; });
    const box = sections[index]?.getBoundingClientRect();
    const progress = box ? Math.min(1, Math.max(0, (line - box.top) / Math.max(1, box.height))) : 0;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      link.style.setProperty('--progress', i === index ? progress.toFixed(3) : '0');
    });
    contents!.style.setProperty('--progress', progress.toFixed(3));
    if (index !== shown) {
      shown = index;
      currentNumber.textContent = String(index + 1).padStart(2, '0');
      currentName.textContent = links[index].querySelector('.hc-name')?.textContent ?? '';
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(follow); };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  follow();
}
