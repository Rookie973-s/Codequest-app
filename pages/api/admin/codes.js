// pages/api/admin/codes.js
//
// TEMPORARY tool. Lets you generate/seed codes by visiting a URL in your
// browser, using whatever env vars are already live on Vercel - no local
// .env, no Vercel CLI, no dotenv needed. Delete this file (or at least
// remove ADMIN_KEY from your env vars) once you're done using it - it's
// powerful and you don't want it sitting around on a public URL forever.
//
// Setup (one time):
//   1. In Vercel -> Project -> Settings -> Environment Variables, add:
//        ADMIN_KEY = <any long random string you make up yourself>
//        SUBLEVEL_PEPPER = <any long random string you make up yourself>
//      (You choose these values, so unlike CODE_PEPPER/SESSION_SECRET
//      you'll actually know them.)
//   2. Redeploy so the new env vars take effect.
//
// Usage - visit these URLs in your browser (replace YOURSITE and KEY):
//
//   Backfill used/role fields on codes seeded before this update (run once):
//     https://YOURSITE/api/admin/codes?key=KEY&action=migrate
//
//   Create the 2 early-access codes (skip the class-schedule date lock):
//     https://YOURSITE/api/admin/codes?key=KEY&action=early-access&count=2
//
//   Create more normal single-use student codes (e.g. 10 more, on top of
//   whatever you already have):
//     https://YOURSITE/api/admin/codes?key=KEY&action=students&count=10
//
//   Generate ALL 28 weekly topic unlock codes:
//     https://YOURSITE/api/admin/codes?key=KEY&action=sublevel
//
//   Regenerate just one week's topic codes (e.g. week 3, later in the term):
//     https://YOURSITE/api/admin/codes?key=KEY&action=sublevel&week=w3
//
// Every response is JSON containing the plain-text codes. Copy them down
// somewhere safe immediately - they are NOT stored anywhere in plain text,
// only their hashes are, so if you lose this response you'll need to
// generate fresh codes.

import { getDb } from '../../../lib/mongodb';
import { hashCode, normalizeCode } from '../../../lib/codeHash';
import { hashSubCode } from '../../../lib/subCodeHash';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L

function randomChunk(len) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

const SUBLEVEL_IDS = [
  'w1-1', 'w1-2', 'w1-3', 'w1-4', 'w1-5', 'w1-6', 'w1-7',
  'w2-1', 'w2-2', 'w2-3', 'w2-4', 'w2-5', 'w2-6',
  'w3-1', 'w3-2', 'w3-3', 'w3-4', 'w3-5',
  'w4-1', 'w4-2', 'w4-3', 'w4-4',
  'w5-1', 'w5-2', 'w5-3', 'w5-4', 'w5-5', 'w5-6',
];

async function actionMigrate(db) {
  const col = db.collection('accessCodes');
  const markUsed = await col.updateMany(
    { used: { $exists: false }, useCount: { $gt: 0 } },
    { $set: { used: true, usedAt: new Date() } }
  );
  const markUnused = await col.updateMany(
    { used: { $exists: false } },
    { $set: { used: false } }
  );
  const roleResult = await col.updateMany(
    { role: { $exists: false } },
    { $set: { role: 'student' } }
  );
  return {
    markedAlreadyUsed: markUsed.modifiedCount,
    markedUnused: markUnused.modifiedCount,
    roleBackfilled: roleResult.modifiedCount,
  };
}

async function actionStudents(db, count) {
  const col = db.collection('accessCodes');
  await col.createIndex({ lookupHash: 1 }, { unique: true });
  const existingCount = await col.countDocuments({ role: { $in: ['student', 'early_access'] } });

  const created = [];
  let n = existingCount;
  while (created.length < count) {
    n += 1;
    const code = `TB-${String(n).padStart(2, '0')}-${randomChunk(5)}`;
    const normalized = normalizeCode(code);
    const lookupHash = await hashCode(normalized);
    const existing = await col.findOne({ lookupHash });
    if (existing) continue; // extremely unlikely collision, just retry
    await col.insertOne({
      lookupHash,
      label: `Student ${n}`,
      role: 'student',
      active: true,
      used: false,
      useCount: 0,
      createdAt: new Date(),
    });
    created.push({ code, label: `Student ${n}` });
  }
  return created;
}

async function actionEarlyAccess(db, count) {
  const col = db.collection('accessCodes');
  await col.createIndex({ lookupHash: 1 }, { unique: true });
  const existingCount = await col.countDocuments({ role: { $in: ['student', 'early_access'] } });

  const created = [];
  let n = existingCount;
  while (created.length < count) {
    n += 1;
    const code = `TB-EA-${randomChunk(5)}`;
    const normalized = normalizeCode(code);
    const lookupHash = await hashCode(normalized);
    const existing = await col.findOne({ lookupHash });
    if (existing) continue;
    const label = `Student ${n} (Early Access)`;
    await col.insertOne({
      lookupHash,
      label,
      role: 'early_access',
      active: true,
      used: false,
      useCount: 0,
      createdAt: new Date(),
    });
    created.push({ code, label });
  }
  return created;
}

async function actionSublevel(db, weekFilter) {
  const col = db.collection('sublevelCodes');
  const ids = weekFilter ? SUBLEVEL_IDS.filter((id) => id.startsWith(weekFilter)) : SUBLEVEL_IDS;
  if (ids.length === 0) throw new Error(`No sub-level ids match "${weekFilter}".`);

  const generated = [];
  for (const id of ids) {
    const code = randomChunk(8);
    const hash = await hashSubCode(id, code);
    await col.updateOne({ _id: id }, { $set: { hash, updatedAt: new Date() } }, { upsert: true });
    generated.push({ id: id.toUpperCase(), code });
  }
  return generated;
}

export default async function handler(req, res) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.length < 16) {
    return res.status(500).json({ error: 'ADMIN_KEY is not set on the server. Add it in Vercel env vars and redeploy first.' });
  }
  if (req.query.key !== adminKey) {
    return res.status(401).json({ error: 'Missing or wrong key.' });
  }

  const action = req.query.action;
  const count = Math.max(1, Math.min(200, parseInt(req.query.count, 10) || 2));

  try {
    const db = await getDb();

    if (action === 'migrate') {
      return res.status(200).json({ action, result: await actionMigrate(db) });
    }
    if (action === 'students') {
      return res.status(200).json({ action, count, codes: await actionStudents(db, count) });
    }
    if (action === 'early-access') {
      return res.status(200).json({ action, count, codes: await actionEarlyAccess(db, count) });
    }
    if (action === 'sublevel') {
      const week = req.query.week || null;
      return res.status(200).json({ action, week: week || 'all', codes: await actionSublevel(db, week) });
    }

    return res.status(400).json({
      error: 'Unknown or missing action.',
      validActions: ['migrate', 'students', 'early-access', 'sublevel'],
    });
  } catch (err) {
    console.error('admin/codes error:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
}
