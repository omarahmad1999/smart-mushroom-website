// Handwritten lines appear as if written, word by word, the first time a page settles
// into view. Words are wrapped in inline-block spans (line breaking and size are
// unchanged) and revealed with a clip, so the notebook layout never moves.

const LINES = ['.nb-scribble', '.nb-photo figcaption', '.nb-margin-note', '.nb-writing-page > h2', '.nb-entry h3'];
/** Every handwritten line, including Journey notes and photo boards that are not shown yet. */
const ALL = [...LINES, '.nb-journey-photo-board > h2', '.journey-note h3', '.journey-note .journey-heading'].join(',');
/** The handwritten lines a reader can currently see on a page. */
const SHOWN = [...LINES, '.nb-journey-photo-board:not([hidden]) > h2', '.journey-note[data-active] h3', '.journey-note[data-active] .journey-heading'].join(',');

function words(element: HTMLElement) {
  if (!element.dataset.ink) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (!node.data.trim()) continue;
      const fragment = document.createDocumentFragment();
      for (const part of node.data.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { fragment.append(part); continue; }
        const word = document.createElement('span');
        word.className = 'nb-ink';
        word.textContent = part;
        fragment.append(word);
      }
      node.replaceWith(fragment);
    }
    element.dataset.ink = 'ready';
  }
  return [...element.querySelectorAll<HTMLElement>('.nb-ink')];
}

/**
 * Wraps every handwritten line ahead of time. Unwritten lines stay hidden (see the
 * notebook styles), so a page arriving under a turning leaf is blank until it is written.
 */
export function prepareInk(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(ALL).forEach(line => words(line));
  root.querySelectorAll<SVGElement>('.nb-marks').forEach(marks => { marks.dataset.ink = 'ready'; });
}

/** Writes the handwriting inside `pages`, each page in reading order and the pages side by side. */
export function writeIn(pages: HTMLElement[]) {
  pages.forEach((page, index) => {
    let delay = 120 + index * 260;
    for (const line of page.querySelectorAll<HTMLElement>(SHOWN)) {
      if (line.dataset.ink === 'written') continue;
      for (const word of words(line)) {
        const duration = Math.max(110, (word.textContent?.length ?? 1) * 34);
        word.animate([{ clipPath: 'inset(-30% 100% -30% -6%)' }, { clipPath: 'inset(-30% -6% -30% -6%)' }],
          { duration, delay, easing: 'cubic-bezier(.35,.1,.45,1)', fill: 'backwards' });
        delay += duration * .82;
      }
      line.dataset.ink = 'written';
      delay += 140;
    }
    // Pencil marks on photographs are drawn after the page's handwriting.
    for (const marks of page.querySelectorAll<SVGElement>('.nb-marks[data-ink="ready"]')) {
      for (const mark of marks.querySelectorAll('.nb-mark')) {
        const duration = mark.classList.contains('nb-mark-arrow') ? 360 : 620;
        mark.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration, delay, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'backwards' });
        delay += duration * .9;
      }
      marks.dataset.ink = 'written';
    }
  });
}
