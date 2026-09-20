/** Editorial destinations only. No experiment data is read at build time or in the browser. */
function externalUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch { return undefined; }
}

function publicEmail(value: string | undefined): string | undefined {
  const email = value?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

export const site = {
  title: 'Smart Mushroom Hub',
  description: 'A small tent. A living experiment. Explore an oyster mushroom cultivation project bringing together mycology, thoughtful automation, and computer vision.',
  grafanaUrl: externalUrl(import.meta.env.PUBLIC_GRAFANA_URL),
  githubUrl: externalUrl(import.meta.env.PUBLIC_GITHUB_URL),
  documentationUrl: externalUrl(import.meta.env.PUBLIC_DOCUMENTATION_URL) || '/documentation/',
  contactEmail: publicEmail(import.meta.env.PUBLIC_CONTACT_EMAIL),
};
