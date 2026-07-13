// scripts/create-instructor-code.js
// Creates ONE special access code marked role:"instructor". Logging in with
// this code (instead of a student TB-xx-xxxxx code) is what reveals the
// "Preview / testing tools" panel on the homepage.
//
// Run with: node scripts/create-instructor-code.js
// Optionally pass your own code: node scripts/create-instructor-code.js TB-INSTRUCTOR-MYCODE
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
  const customCode = process.argv[2];
  const code = customCode ? normalizeCode(customCode) : `TB-INSTRUCTOR-${randomChunk(6)}`;

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('accessCodes');
  await col.createIndex({ lookupHash: 1 }, { unique: true });

  const lookupHash = hashCode(code);
  const existing = await col.findOne({ lookupHash });
  if (existing) {
    console.log('That code already exists in the database. Choose a different one, or delete the existing record first.');
    await client.close();
    return;
  }

  await col.insertOne({
    lookupHash,
    label: 'Instructor',
    role: 'instructor',
    active: true,
    useCount: 0,
    createdAt: new Date(),
  });

  fs.writeFileSync(
    path.join(__dirname, '..', 'instructor-code.txt'),
    `Instructor code: ${code}\nKeep this one for yourself — logging in with it reveals the Preview / testing tools panel.\n`
  );

  console.log(`Instructor code created: ${code}`);
  console.log('Saved to instructor-code.txt (git-ignored, kept out of your repo).');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
