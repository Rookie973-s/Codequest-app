// scripts/upload-pdfs.js
// Uploads every PDF in a local ./pdfs folder into MongoDB GridFS, so the
// /api/pdf/[id] route can serve them to logged-in students.
//
// Name your files to match each sub-level id exactly, e.g.:
//   pdfs/w1-1.pdf   pdfs/w1-2.pdf   pdfs/w2-3.pdf   ...   pdfs/w5-6.pdf
//
// Run with: npm run upload-pdfs
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, GridFSBucket } = require('mongodb');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'codequest';
const pdfDir = path.join(__dirname, '..', 'pdfs');

if (!uri) {
  console.error('Missing MONGODB_URI in your .env file.');
  process.exit(1);
}

async function main() {
  if (!fs.existsSync(pdfDir)) {
    console.error(`No "pdfs" folder found at ${pdfDir}. Create it and add your PDF files there first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(pdfDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  if (!files.length) {
    console.log('No PDF files found in ./pdfs — nothing to upload.');
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });

  for (const filename of files) {
    // Remove any existing file with the same name so re-uploads replace it
    const existing = await db.collection('pdfs.files').find({ filename }).toArray();
    for (const doc of existing) {
      await bucket.delete(doc._id);
    }

    await new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, { contentType: 'application/pdf' });
      fs.createReadStream(path.join(pdfDir, filename))
        .pipe(uploadStream)
        .on('error', reject)
        .on('finish', resolve);
    });

    console.log(`Uploaded ${filename}`);
  }

  console.log(`Done. Uploaded ${files.length} PDF(s).`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
