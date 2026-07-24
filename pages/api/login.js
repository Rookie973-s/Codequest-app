// pages/api/login.js
import { getDb } from '../../lib/mongodb';
import { hashCode, normalizeCode } from '../../lib/codeHash';
import { createSessionToken, buildCookieHeader } from '../../lib/session';

// Simple in-memory rate limiting per server instance (best-effort, resets on
// cold start). Not a substitute for a real WAF, but stops naive brute forcing.
const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 20;

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

// Codes with these roles are shared, reusable instructor logins - not
// the one-per-student codes - so they're exempt from the single-use rule.
const REUSABLE_ROLES = new Set(['instructor']);

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
    return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
  }

  const { code } = req.body || {};
  const normalized = normalizeCode(code);

  if (!normalized || normalized.length < 4) {
    return res.status(400).json({ error: 'Please enter your access code.' });
  }

  try {
    const db = await getDb();
    const lookupHash = await hashCode(normalized);
    const col = db.collection('accessCodes');
    const record = await col.findOne({ lookupHash });

    if (!record || record.active === false) {
      return res.status(401).json({ error: 'That code is not valid. Double-check it and try again.' });
    }

    const role = record.role || 'student';
    const isReusable = REUSABLE_ROLES.has(role);

    if (!isReusable && record.used) {
      // Single-use code that's already been redeemed.
      return res.status(401).json({
        error: 'This code has already been used to log in and cannot be reused. Ask your instructor if you need help.',
      });
    }

    // Atomically claim the code so two near-simultaneous requests with
    // the same code can't both succeed (classic race condition on
    // "check then update").
    if (!isReusable) {
      const claim = await col.updateOne(
        { _id: record._id, used: { $ne: true } },
        { $set: { used: true, usedAt: new Date() }, $inc: { useCount: 1 } }
      );
      if (claim.modifiedCount === 0) {
        return res.status(401).json({
          error: 'This code has already been used to log in and cannot be reused. Ask your instructor if you need help.',
        });
      }
    } else {
      await col.updateOne(
        { _id: record._id },
        { $inc: { useCount: 1 }, $set: { lastUsedAt: new Date() } }
      );
    }

    const token = await createSessionToken({
      codeId: String(record._id),
      label: record.label || null,
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14, // 14 days
    });

    res.setHeader('Set-Cookie', buildCookieHeader(token));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
  }
}
