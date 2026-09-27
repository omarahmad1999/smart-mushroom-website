import type { FlowSounds } from './flow-sounds';

// Loads a 3D path diorama only as it approaches the viewport (or its tab opens), so the page
// never waits for three.js. Until then, and wherever WebGL is unavailable, the poster stays.
type Flow = { restart(): void; setActive(value: boolean, replay?: boolean): void };

export function mountDioramaFlow(root: HTMLElement, sounds?: FlowSounds): Flow {
  let flow: Flow | undefined, active = false, loading = false;
  async function load() {
    if (loading) return;
    loading = true; observer.disconnect();
    try {
      const { mountDiorama } = await import('./diorama/scene');
      flow = mountDiorama(root, sounds);
      flow.setActive(active);
    } catch {
      root.dataset.flowState = 'static';
      const status = root.querySelector<HTMLElement>('[data-pathway-status]');
      if (status) status.textContent = `The ${root.dataset.flowName} path is shown as a still picture on this device.`;
    }
  }
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void load(); }, { rootMargin: '400px' });
  observer.observe(root);
  return {
    restart() { flow?.restart(); },
    setActive(value, replay = false) {
      // A tab opening brings its diorama into view, and the observer loads it from there.
      active = value;
      flow?.setActive(value, replay);
    },
  };
}
