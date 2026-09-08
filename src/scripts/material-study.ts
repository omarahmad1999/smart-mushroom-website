// Load the optional visual study only as it approaches the viewport.
// All experiment measurements remain in Grafana; this module only draws geometry.
const section = document.querySelector<HTMLElement>('[data-material-study]');
if (section) {
  const observer = new IntersectionObserver(async entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    try {
      const { mountMaterialStudy } = await import('./study/scene');
      mountMaterialStudy(section);
    } catch {
      section.dataset.studyState = 'unavailable';
      section.querySelector('canvas')?.remove();
      section.querySelectorAll('[data-study-hotspot], [data-study-leaders]').forEach(button => button.remove());
      const status = section.querySelector<HTMLElement>('[data-study-status]');
      if (status) status.textContent = 'The still view is available. Interactive 3D could not load in this browser.';
      section.querySelectorAll<HTMLButtonElement>('button:not([data-resource-unavailable])').forEach(button => button.disabled = true);
    }
  }, { rootMargin: '350px' });
  observer.observe(section);
}
