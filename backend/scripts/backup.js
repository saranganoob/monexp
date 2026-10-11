// npm run backup  – saves every collection (except login sessions/undo snapshots) to
// backups/monexp-YYYY-MM-DD-HHMM.json in the project folder.
// For the live database:  MONGODB_URI="<your Atlas connection string>" npm run backup
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from '../src/config.js';

const SKIP = new Set(['undos']); // temporary data
const { EJSON } = mongoose.mongo.BSON;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backups');

await mongoose.connect(config.mongoUri);
try {
  const db = mongoose.connection.db;
  const data = {};
  for (const { name } of await db.listCollections().toArray()) {
    if (SKIP.has(name) || name.startsWith('system.')) continue;
    data[name] = await db.collection(name).find().toArray();
  }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `monexp-${stamp}.json`);
  fs.writeFileSync(file, EJSON.stringify({ database: db.databaseName, savedAt: new Date(), data }, null, 1, { relaxed: false }));
  const counts = Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join(', ');
  console.log(`Backup saved: ${file}\n${counts}`);
} finally {
  await mongoose.disconnect();
}
