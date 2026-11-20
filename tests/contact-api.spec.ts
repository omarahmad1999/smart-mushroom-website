import { test, expect } from '@playwright/test';

test('contact endpoint rejects malformed submissions before delivery', async ({ request }) => {
  const response = await request.post('/api/contact', {
    data: { name: '', email: 'not-an-email', subject: '', message: '', website: '' },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ message: 'Please complete every field with valid details.' });
});

test('contact endpoint refuses submissions from another site', async ({ request }) => {
  const response = await request.post('/api/contact', {
    headers: { Origin: 'https://elsewhere.example' },
    data: { name: '', email: '', subject: '', message: '', website: '' },
  });
  expect(response.status()).toBe(403);
});

test('contact endpoint accepts its own host over HTTPS, as visitors reach it through the tunnel', async ({ request, baseURL }) => {
  const response = await request.post('/api/contact', {
    headers: { Origin: `https://${new URL(baseURL!).host}` },
    data: { name: '', email: 'not-an-email', subject: '', message: '', website: '' },
  });
  // Passing the host check leads to ordinary validation, not a 403.
  expect(response.status()).toBe(400);
});

test('contact honeypot quietly discards automated submissions', async ({ request }) => {
  const response = await request.post('/api/contact', {
    data: {
      name: 'Automated Visitor',
      email: 'robot@example.com',
      subject: 'Automated message',
      message: 'This should never reach Resend.',
      website: 'https://spam.example.com',
    },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
});
