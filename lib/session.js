// lib/session.js
//
// A tiny, dependency-free signed-cookie session, built entirely on the
// Web Crypto API (globalThis.crypto.subtle). This works identically in:
//   - Node.js API routes (pages/api/*)
//   - Vercel Edge Middleware (middleware.js)
// which is why the login you set in an API route is understood correctly
// by the middleware that guards the homepage.

export const COOKIE_NAME = 'cq_session';
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET is missing or too short. Set a long random string in your environment variables.'
    );
  }
  return secret;
}

async function importKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function toBase64Url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + ((4 - (str.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Creates a signed session cookie value: base64url(payload) + "." + base64url(signature)
 * payload = { code, iat, exp }
 */
export async function createSessionToken(payload) {
  const secret = getSecret();
  const key = await importKey(secret);
  const enc = new TextEncoder();
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = toBase64Url(enc.encode(payloadStr));
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuffer));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies a session token. Returns the payload object if valid and not expired,
 * or null if invalid/expired/tampered.
 */
export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  try {
    const secret = getSecret();
    const key = await importKey(secret);
    const enc = new TextEncoder();
    const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
    const expectedSigB64 = toBase64Url(new Uint8Array(expectedSigBuffer));

    // Constant-time-ish comparison
    if (expectedSigB64.length !== sigB64.length) return null;
    let diff = 0;
    for (let i = 0; i < expectedSigB64.length; i++) {
      diff |= expectedSigB64.charCodeAt(i) ^ sigB64.charCodeAt(i);
    }
    if (diff !== 0) return null;

    const payloadStr = new TextDecoder().decode(fromBase64Url(payloadB64));
    const payload = JSON.parse(payloadStr);

    if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function buildCookieHeader(token, maxAgeSeconds = MAX_AGE_SECONDS) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function buildLogoutCookieHeader() {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
