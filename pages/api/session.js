// pages/api/session.js
import { COOKIE_NAME, verifySessionToken } from '../../lib/session';

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const session = await verifySessionToken(cookies[COOKIE_NAME]);

  if (!session) {
    return res.status(200).json({ loggedIn: false, isInstructor: false });
  }

  return res.status(200).json({
    loggedIn: true,
    isInstructor: session.role === 'instructor',
  });
}
