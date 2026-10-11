// npm run restore -- backups/monexp-2026-10-12-0130.json --yes
// REPLACES the collections in the target database with the ones in the backup file.
// For the live database, put MONGODB_URI="<Atlas connection string>" in front.
import fs from 'node:fs';
import mongoose from 'mongoose';
import { config } from '../src/config.js';

const { EJSON } = mongoose.mongo.BSON;
const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Give the backup file: npm run restore -- backups/monexp-....json --yes');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error('This replaces the data in the database. Add --yes to confirm.');
  process.exit(1);
}

const backup = EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });
await mongoose.connect(config.mongoUri);
try {
  const db = mongoose.connection.db;
  for (const [name, docs] of Object.entries(backup.data)) {
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
    console.log(`${name}: ${docs.length}`);
  }
  console.log(`Restored ${file} into ${db.databaseName}.`);
} finally {
  await mongoose.disconnect();
}
