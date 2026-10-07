// npm run seed            – loads the sample months into an empty database
// npm run seed -- --force – wipes existing money data first (your login is kept)
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { hasData, seedSampleData } from './seed-lib.js';

const force = process.argv.includes('--force');
await connectDb(config.mongoUri);
try {
  if ((await hasData()) && !force) {
    console.log('The database already has months in it, so nothing was changed.');
    console.log('To wipe it and reload the sample data, run:  npm run seed -- --force');
    process.exitCode = 1;
  } else {
    const { months } = await seedSampleData();
    console.log(`Loaded ${months} sample months (Jan–Oct 2026) into ${config.mongoUri}.`);
  }
} finally {
  await disconnectDb();
}
