// npm run seed                          – loads the sample months for the first account, if it has no months yet
// npm run seed -- --user you@example.com – the same for that account
// npm run seed -- --force               – wipes that account's money data first (the login is kept)
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { User } from '../src/models/index.js';
import { hasData, seedSampleData } from './seed-lib.js';

const force = process.argv.includes('--force');
const userArg = process.argv[process.argv.indexOf('--user') + 1];
const email = process.argv.includes('--user') ? userArg?.toLowerCase() : null;

await connectDb(config.mongoUri);
try {
  const user = email ? await User.findOne({ email }).lean() : await User.findOne().sort({ createdAt: 1, _id: 1 }).lean();
  if (!user) {
    console.log(email ? `No account uses ${email}.` : 'There is no account yet. Run  npm run create-user  first.');
    process.exitCode = 1;
  } else if ((await hasData(user._id)) && !force) {
    console.log(`${user.email || user.phone} already has months, so nothing was changed.`);
    console.log('To wipe that account\'s data and reload the sample data, add  -- --force');
    process.exitCode = 1;
  } else {
    const { months } = await seedSampleData(user._id);
    console.log(`Loaded ${months} sample months (Jan–Oct 2026) for ${user.email || user.phone}.`);
  }
} finally {
  await disconnectDb();
}
