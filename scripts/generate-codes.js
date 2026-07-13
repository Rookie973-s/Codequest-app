// scripts/generate-codes.js
// Generates 40 unique access codes, each starting with "TB", and writes
// them to codes.json (for seed-codes.js) and codes.txt (for you to read
// / print / hand out). Run with: npm run generate-codes
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COUNT = 40;
const PREFIX = 'TB';
// Avoids visually-confusing characters: 0/O, 1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomChunk(len) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function makeCode(n) {
  return `${PREFIX}-${String(n).padStart(2, '0')}-${randomChunk(5)}`;
}

const codes = new Set();
let n = 1;
while (codes.size < COUNT) {
  codes.add(makeCode(n));
  n += 1;
}

const list = Array.from(codes).map((code, i) => ({
  code,
  label: `Student ${i + 1}`,
}));

fs.writeFileSync(path.join(__dirname, '..', 'codes.json'), JSON.stringify(list, null, 2));
fs.writeFileSync(
  path.join(__dirname, '..', 'codes.txt'),
  list.map((c) => `${c.label}: ${c.code}`).join('\n') + '\n'
);

console.log(`Generated ${list.length} codes.`);
console.log('Saved to codes.json (for seeding) and codes.txt (for you to read/print).');
console.log('Next: run "npm run seed-codes" to upload them (hashed) to MongoDB.');
