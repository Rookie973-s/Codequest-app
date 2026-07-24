// scripts/migrate-add-used-field.js
// One-time fix for codes that were already seeded into MongoDB BEFORE the
// single-use update. Adds used:false and role:"student" to any accessCodes
// document that doesn't already have those fields. Safe to run more than
// once - it only touches documents missing the field.
// Run with: node scripts/migrate-add-used-field.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'codequest';

if (!uri) {
  console.error('Missing MONGODB_URI in your .env file.');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
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

  console.log(`Marked ${markUsed.modifiedCount} already-redeemed code(s) as used:true.`);
  console.log(`Set used:false on ${markUnused.modifiedCount} never-used code(s).`);
  console.log(`Set role:"student" on ${roleResult.modifiedCount} existing code(s).`);
  console.log('Already-seeded codes are now single-use going forward.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
