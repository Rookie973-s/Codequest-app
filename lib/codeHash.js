// lib/codeHash.js
//
// Access codes are never stored in plain text in MongoDB. Instead we store
// a deterministic HMAC-SHA256 of the (normalized) code, keyed by a secret
// "pepper" that only lives in your environment variables. This lets us look
// the code up with a single indexed query without ever keeping the raw
// code value in the database.

function getPepper() {
  const pepper = process.env.CODE_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new Error(
      'CODE_PEPPER is missing or too short. Set a long random string in your environment variables.'
    );
  }
  return pepper;
}

export function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

async function importKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashCode(rawCode) {
  const pepper = getPepper();
  const key = await importKey(pepper);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(normalizeCode(rawCode)));
  return toHex(sig);
}
