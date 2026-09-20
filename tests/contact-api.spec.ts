import { test, expect } from '@playwright/test';

test('contact endpoint rejects malformed submissions before delivery', async ({ request }) => {
  const response = await request.post('/api/contact', {
    data: { name: '', email: 'not-an-email', subject: '', message: '', website: '' },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ message: 'Please complete every field with valid details.' });
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
