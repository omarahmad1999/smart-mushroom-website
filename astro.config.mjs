import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

// Contact-form settings are runtime secrets: read from the server's environment
// (or .env) when a message is sent, never copied into the build output.
const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
  env: {
    schema: {
      RESEND_API_KEY: secret(),
      CONTACT_TO_EMAIL: secret(),
      CONTACT_FROM_EMAIL: secret(),
    },
  },
});
