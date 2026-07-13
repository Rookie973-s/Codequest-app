// pages/api/pdf/[id].js
import { GridFSBucket } from 'mongodb';
import { getDb } from '../../../lib/mongodb';
import { COOKIE_NAME, verifySessionToken } from '../../../lib/session';

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

// Only allow simple ids like "w1-1", "w2-6", etc.
const SAFE_ID = /^[a-zA-Z0-9_-]{1,40}$/;

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const session = await verifySessionToken(cookies[COOKIE_NAME]);

  if (!session) {
    return res.status(401).json({ error: 'Please log in to download notes.' });
  }

  const { id } = req.query;
  if (!id || !SAFE_ID.test(id)) {
    return res.status(400).json({ error: 'Invalid note id.' });
  }

  const filename = `${id}.pdf`;

  try {
    const db = await getDb();
    const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });

    const files = await db
      .collection('pdfs.files')
      .find({ filename })
      .toArray();

    if (!files.length) {
      return res.status(404).json({ error: 'This PDF has not been uploaded yet.' });
    }

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const downloadStream = bucket.openDownloadStreamByName(filename);
    downloadStream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ error: 'This PDF could not be found.' });
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('PDF download error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong fetching that PDF.' });
  }
}
