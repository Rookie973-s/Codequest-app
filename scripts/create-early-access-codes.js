// scripts/create-early-access-codes.js
// Creates access codes marked role:"early_access". Logging in with one of
// these skips the class-schedule date lock (the "Code Quest follows your
// class schedule..." countdown) - same as an instructor - but it does NOT
// reveal the instructor "Preview / testing tools" panel and does NOT
// auto-unlock every weekly topic code. Students using these codes still
// need to enter each week's unlock code and finish each level's topics
// in order; they just aren't stopped by the calendar date.
//
// These codes are single-use, exactly like the 40 student codes (that's
// enforced in /api/login, based on role, not on how the code was created).
//
// Run with: node scripts/create-early-access-codes.js
// Optionally pass how many to create (default 2):
//   node scripts/create-early-access-codes.js 2
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const pepper = process.env.CODE_PEPPER;
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'codequest';

if (!pepper || pepper.length < 16) {
  console.error('Missing or too-short CODE_PEPPER in your .env file.');
  process.exit(1);
}
if (!uri) {
  console.error('Missing MONGODB_URI in your .env file.');
  process.exit(1);
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomChunk(len) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function hashCode(code) {
  return crypto.createHmac('sha256', pepper).update(normalizeCode(code)).digest('hex');
}

async function main() {
  const count = Math.max(1, parseInt(process.argv[2], 10) || 2);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('accessCodes');
  await col.createIndex({ lookupHash: 1 }, { unique: true });

  // Find how many student/early-access codes already exist so labels
  // keep incrementing (e.g. "Student 41", "Student 42") instead of
  // restarting at 1.
  const existingCount = await col.countDocuments({ role: { $in: ['student', 'early_access'] } });

  const created = [];
  for (let i = 0; i < count; i++) {
    const code = `TB-EA-${randomChunk(5)}`;
    const lookupHash = hashCode(code);
    const existing = await col.findOne({ lookupHash });
    if (existing) {
      console.log(`Collision on ${code}, skipping (extremely unlikely - just rerun).`);
      continue;
    }
    const label = `Student ${existingCount + created.length + 1} (Early Access)`;
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

  const outPath = path.join(__dirname, '..', 'early-access-codes.txt');
  fs.writeFileSync(
    outPath,
    created.map((c) => `${c.label}: ${c.code}`).join('\n') + '\n'
  );

  console.log(`Created ${created.length} early-access code(s):`);
  created.forEach((c) => console.log(`  ${c.label}: ${c.code}`));
  console.log(`Saved to ${outPath} (git-ignored, kept out of your repo).`);
  console.log('These skip the class-schedule date lock but are still single-use, like the other 40.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
