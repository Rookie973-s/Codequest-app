// lib/subCodeHash.js
//
// Server-side verification for the weekly per-topic "unlock codes"
// (w1-1, w1-2, ... w5-6). These used to be verified entirely in the
// browser against a hard-coded list of SHA-256 hashes sitting in the
// codequest.html <script> tag. That's not real security: anyone who
// opens dev tools can copy the whole hash list and brute-force it
// offline, as fast as their own machine can compute SHA-256 - no rate
// limit, no pepper, nothing stopping them.
//
// Now the codes are hashed with HMAC-SHA256 + a secret pepper (like the
// login access codes) and the hash list lives only in MongoDB. The
// browser never sees the hashes - it just POSTs a guess to
// /api/unlock-sublevel and gets back { ok: true/false }. That endpoint
// is rate-limited, so brute-forcing it is no longer practical.

function getPepper() {
  const pepper = process.env.SUBLEVEL_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new Error(
      'SUBLEVEL_PEPPER is missing or too short. Set a long random string in your environment variables.'
    );
  }
  return pepper;
}

export function normalizeSubCode(raw) {
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

// Same "id:CODE" convention the old client-side version used, just now
// signed with a real secret instead of hashed with nothing.
export async function hashSubCode(id, rawCode) {
  const pepper = getPepper();
  const key = await importKey(pepper);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    enc.encode(`${id}:${normalizeSubCode(rawCode)}`)
  );
  return toHex(sig);
}
