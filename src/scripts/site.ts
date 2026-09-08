const menuButton = document.querySelector<HTMLButtonElement>('.menu-toggle');
const mobileNavigation = document.querySelector<HTMLElement>('#mobile-navigation');
menuButton?.addEventListener('click', () => {
  if (!mobileNavigation) return;
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  mobileNavigation.hidden = !open;
});
mobileNavigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mobileNavigation.hidden = true;
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
}));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    mobileNavigation!.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    menuButton.focus();
  }
});
const resourceDialog = document.querySelector<HTMLDialogElement>('.resource-dialog');
document.querySelectorAll<HTMLButtonElement>('[data-resource-unavailable]').forEach(button => {
  button.addEventListener('click', () => {
    if (!resourceDialog) return;
    const resource = button.dataset.resourceUnavailable;
    const title = resourceDialog.querySelector<HTMLElement>('#resource-dialog-title');
    const message = resourceDialog.querySelector<HTMLElement>('[data-resource-message]');
    if (title) title.textContent = resource === 'Grafana' ? 'The data lives in Grafana.' : 'Follow the build.';
    if (message) message.textContent = resource === 'Grafana'
      ? 'The public Grafana dashboard link has not been added to this site yet. All actual environmental measurements and historical charts remain in Grafana.'
      : 'The GitHub repository link has not been added to this site yet. The project overview and system notes are available in the documentation.';
    resourceDialog.showModal();
  });
});
resourceDialog?.querySelector('.dialog-close')?.addEventListener('click', () => resourceDialog.close());
resourceDialog?.addEventListener('click', event => { if (event.target === resourceDialog) {
  const bounds = resourceDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) resourceDialog.close();
}});
