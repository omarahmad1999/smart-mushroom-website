import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false;

const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LIMIT_MAX = 5;
const attempts = new Map<string, number[]>();

type ContactMessage = {
  name: string;
  email: string;
  subject: string;
  message: string;
  website: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function field(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum + 1) : '';
}

function parseMessage(value: unknown): ContactMessage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const body = value as Record<string, unknown>;
  const message = {
    name: field(body.name, 80).replace(/\s+/g, ' '),
    email: field(body.email, 254),
    subject: field(body.subject, 150).replace(/[\r\n]+/g, ' '),
    message: field(body.message, 5000),
    website: field(body.website, 200),
  };
  if (!message.name || message.name.length > 80) return;
  if (!message.subject || message.subject.length > 150) return;
  if (!message.message || message.message.length > 5000) return;
  if (message.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.email)) return;
  return message;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

function isRateLimited(address: string) {
  const now = Date.now();
  for (const [key, timestamps] of attempts) {
    const current = timestamps.filter(timestamp => now - timestamp < LIMIT_WINDOW_MS);
    if (current.length) attempts.set(key, current);
    else attempts.delete(key);
  }
  const current = attempts.get(address) ?? [];
  if (current.length >= LIMIT_MAX) return true;
  current.push(now);
  attempts.set(address, current);
  return false;
}

export const POST: APIRoute = async ({ request, url, clientAddress }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ message: 'This request was not accepted.' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return json({ message: 'Please submit the contact form again.' }, 415);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Please check the form and try again.' }, 400);
  }

  const contact = parseMessage(body);
  if (!contact) return json({ message: 'Please complete every field with valid details.' }, 400);
  // A filled honeypot looks successful so automated submissions do not retry it.
  if (contact.website) return json({ ok: true });

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (isRateLimited(forwarded || clientAddress || 'unknown')) {
    return json({ message: 'Too many messages were sent. Please wait a few minutes and try again.' }, 429);
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() || import.meta.env.RESEND_API_KEY?.trim();
  const to = process.env.CONTACT_TO_EMAIL?.trim() || import.meta.env.CONTACT_TO_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || import.meta.env.CONTACT_FROM_EMAIL?.trim();
  if (!apiKey || !to || !from) {
    console.error('Contact delivery is missing RESEND_API_KEY, CONTACT_TO_EMAIL, or CONTACT_FROM_EMAIL.');
    return json({ message: 'Email is temporarily unavailable. Please try again later.' }, 503);
  }

  const safeName = escapeHtml(contact.name);
  const safeEmail = escapeHtml(contact.email);
  const safeSubject = escapeHtml(contact.subject);
  const safeMessage = escapeHtml(contact.message).replace(/\r?\n/g, '<br>');

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: contact.email,
      subject: `[Smart Mushroom Hub] ${contact.subject}`,
      text: `${contact.message}\n\nFrom: ${contact.name}\nReply to: ${contact.email}`,
      html: `<h2>${safeSubject}</h2><p>${safeMessage}</p><hr><p><strong>From:</strong> ${safeName}<br><strong>Reply to:</strong> ${safeEmail}</p>`,
    });
    if (error) {
      console.error('Resend contact delivery failed:', error.name, error.message);
      return json({ message: 'Your note could not be sent. Please try again.' }, 502);
    }
    return json({ ok: true });
  } catch (error) {
    console.error('Resend contact delivery failed:', error instanceof Error ? error.message : 'Unknown error');
    return json({ message: 'Your note could not be sent. Please try again.' }, 502);
  }
};
