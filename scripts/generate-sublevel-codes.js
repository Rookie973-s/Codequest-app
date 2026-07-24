// scripts/generate-sublevel-codes.js
// Generates a strong, random unlock code for every weekly sub-level
// (w1-1 ... w5-6), hashes each one with HMAC-SHA256 + SUBLEVEL_PEPPER, and
// upserts the hashes into MongoDB (collection: sublevelCodes). The plain
// codes are written to sublevel-codes.txt so you can hand them out to
// the class week by week - they are never stored in the database.
//
// Why this replaces the old CODE_HASHES list in codequest.html:
// that list put every hash directly in the page source with no salt/
// pepper, so anyone could copy it and brute-force short/guessable codes
// entirely offline, with no rate limit. These new codes are (a) longer
// and random rather than memorable words, (b) hashed with a secret
// pepper that never leaves your server, and (c) checked only through
// the rate-limited /api/unlock-sublevel endpoint - the hash itself is
// never sent to the browser.
//
// Run with: node scripts/generate-sublevel-codes.js
// Re-run any week to rotate that week's codes (pass a filter, e.g.):
//   node scripts/generate-sublevel-codes.js w3
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const pepper = process.env.SUBLEVEL_PEPPER;
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'codequest';

if (!pepper || pepper.length < 16) {
  console.error('Missing or too-short SUBLEVEL_PEPPER in your .env file.');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}
if (!uri) {
  console.error('Missing MONGODB_URI in your .env file.');
  process.exit(1);
}

// Mirrors the sub-level ids in codequest.html.
const SUBLEVEL_IDS = [
  'w1-1', 'w1-2', 'w1-3', 'w1-4', 'w1-5', 'w1-6', 'w1-7',
  'w2-1', 'w2-2', 'w2-3', 'w2-4', 'w2-5', 'w2-6',
  'w3-1', 'w3-2', 'w3-3', 'w3-4', 'w3-5',
  'w4-1', 'w4-2', 'w4-3', 'w4-4',
  'w5-1', 'w5-2', 'w5-3', 'w5-4', 'w5-5', 'w5-6',
];

// Avoids visually-confusing characters: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomChunk(len) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function normalizeSubCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function hashSubCode(id, code) {
  return crypto.createHmac('sha256', pepper).update(`${id}:${normalizeSubCode(code)}`).digest('hex');
}

async function main() {
  const filter = process.argv[2]; // e.g. "w3" to only rotate week 3
  const ids = filter ? SUBLEVEL_IDS.filter((id) => id.startsWith(filter)) : SUBLEVEL_IDS;

  if (ids.length === 0) {
    console.error(`No sub-level ids match filter "${filter}".`);
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('sublevelCodes');

  // 8 random characters gives ~1.1 trillion combinations - long enough
  // that guessing isn't realistic, short enough to type/hand out.
  const generated = ids.map((id) => ({ id, code: randomChunk(8) }));

  for (const { id, code } of generated) {
    const hash = hashSubCode(id, code);
    await col.updateOne(
      { _id: id },
      { $set: { hash, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  const outPath = path.join(__dirname, '..', 'sublevel-codes.txt');
  const lines = generated.map(({ id, code }) => `${id.toUpperCase()}: ${code}`);
  const header = filter
    ? `Rotated codes for "${filter}" - ${new Date().toISOString()}\n`
    : `All weekly unlock codes - ${new Date().toISOString()}\n`;
  fs.writeFileSync(outPath, header + lines.join('\n') + '\n');

  console.log(`Wrote/updated ${generated.length} sub-level code hash(es) in MongoDB.`);
  console.log(`Plain codes saved to ${outPath} (git-ignored, kept out of your repo).`);
  console.log('Hand these out week by week - only the hash lives in the database, never the code itself.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
