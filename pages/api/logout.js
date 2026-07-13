// pages/api/logout.js
import { buildLogoutCookieHeader } from '../../lib/session';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', buildLogoutCookieHeader());
  res.status(200).json({ ok: true });
}
