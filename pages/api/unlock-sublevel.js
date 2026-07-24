// pages/api/unlock-sublevel.js
//
// Verifies a weekly per-topic unlock code (e.g. "W1-1") against the
// hashed value stored in MongoDB (collection: sublevelCodes). Replaces
// the old client-side CODE_HASHES map in codequest.html - the browser
// now only ever sees "correct" or "incorrect", never the hash itself.
import { getDb } from '../../lib/mongodb';
import { hashSubCode } from '../../lib/subCodeHash';

// Same lightweight per-instance rate limiter used on /api/login.
const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 30;

function tooManyAttempts(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

const VALID_ID = /^w[1-5]-[1-9]$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (tooManyAttempts(ip)) {
    return res.status(429).json({ ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' });
  }

  const { id, code } = req.body || {};

  if (!id || !VALID_ID.test(id) || !code || String(code).trim().length < 3) {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }

  try {
    const db = await getDb();
    const record = await db.collection('sublevelCodes').findOne({ _id: id });

    if (!record) {
      // No code configured for this sub-level - treat as not-yet-locked
      // rather than leaking whether an id exists.
      return res.status(200).json({ ok: false });
    }

    const hash = await hashSubCode(id, code);
    const ok = hash === record.hash;
    return res.status(200).json({ ok });
  } catch (err) {
    console.error('unlock-sublevel error:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
