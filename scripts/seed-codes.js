// scripts/seed-codes.js
// Reads codes.json (from generate-codes.js), hashes each code with
// HMAC-SHA256 + CODE_PEPPER, and upserts them into MongoDB. The plain-text
// code is never written to the database - only the hash is stored.
// Each code starts life as used:false so it can be redeemed exactly once
// by /api/login.
// Run with: npm run seed-codes
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

function normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase();
}

function hashCode(code) {
  return crypto.createHmac('sha256', pepper).update(normalizeCode(code)).digest('hex');
}

async function main() {
  const codesPath = path.join(__dirname, '..', 'codes.json');
  if (!fs.existsSync(codesPath)) {
    console.error('codes.json not found. Run "npm run generate-codes" first.');
    process.exit(1);
  }
  const codes = JSON.parse(fs.readFileSync(codesPath, 'utf8'));

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('accessCodes');

  await col.createIndex({ lookupHash: 1 }, { unique: true });

  let inserted = 0;
  for (const { code, label } of codes) {
    const lookupHash = hashCode(code);
    const res = await col.updateOne(
      { lookupHash },
      {
        $setOnInsert: {
          lookupHash,
          label,
          role: 'student',
          active: true,
          used: false,
          useCount: 0,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
    if (res.upsertedCount) inserted += 1;
  }

  console.log(`Seeded ${inserted} new access codes (out of ${codes.length} total in codes.json).`);
  console.log('Each code is single-use: used:false until someone logs in with it.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
