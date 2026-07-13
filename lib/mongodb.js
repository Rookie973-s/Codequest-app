// lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'codequest';

if (!uri) {
  throw new Error('Missing MONGODB_URI environment variable.');
}

// In serverless environments, functions can be reused between invocations.
// Caching the client on the global object avoids reconnecting on every request.
let cached = global._codequestMongo;
if (!cached) {
  cached = global._codequestMongo = { client: null, promise: null };
}

export async function getDb() {
  if (cached.client) {
    return cached.client.db(dbName);
  }
  if (!cached.promise) {
    const client = new MongoClient(uri, {});
    cached.promise = client.connect().then((c) => {
      cached.client = c;
      return c;
    });
  }
  const client = await cached.promise;
  return client.db(dbName);
}
