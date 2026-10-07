// npm run create-user – creates your login, or changes the password if it already exists.
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { User } from '../src/models/index.js';

function ask(question, { hidden = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Don't echo the password while it's typed.
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
  }
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    if (hidden) process.stdout.write('\n');
    resolve(answer.trim());
  }));
}

await connectDb(config.mongoUri);
try {
  const email = (await ask('Email: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That doesn’t look like an email address.');
  const phone = (await ask('Mobile number (optional, 10 digits, press Enter to skip): ')).replace(/\D/g, '').slice(-10);
  if (phone && !/^[6-9]\d{9}$/.test(phone)) throw new Error('Mobile number must be 10 digits starting with 6, 7, 8 or 9.');
  const password = await ask('Password (at least 8 characters): ', { hidden: true });
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');
  const again = await ask('Type the password again: ', { hidden: true });
  if (again !== password) throw new Error('The two passwords don’t match.');

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.set({ passwordHash, ...(phone ? { phone } : {}) });
    await existing.save();
    console.log(`Password updated for ${email}.`);
  } else {
    await User.create({ email, phone, passwordHash });
    console.log(`Account created for ${email}. You can now sign in.`);
  }
} catch (err) {
  console.error(`Not saved: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDb();
}
