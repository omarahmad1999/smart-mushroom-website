// Handwritten lines appear as if written, word by word, the first time a page settles
// into view. Words are wrapped in inline-block spans (line breaking and size are
// unchanged) and revealed with a clip, so the notebook layout never moves.

const HANDWRITING = [
  '.nb-scribble', '.nb-photo figcaption', '.nb-margin-note', '.nb-writing-page > h2', '.nb-entry h3',
  '.nb-journey-photo-board:not([hidden]) > h2', '.journey-note[data-active] h3', '.journey-note[data-active] .journey-heading',
].join(',');

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

/** Writes the handwriting inside `pages`, each page in reading order and the pages side by side. */
export function writeIn(pages: HTMLElement[]) {
  pages.forEach((page, index) => {
    let delay = 120 + index * 260;
    for (const line of page.querySelectorAll<HTMLElement>(HANDWRITING)) {
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
  });
}
