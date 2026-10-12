import { config, assertConfig } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { assignUnownedData } from './services/ownerMigration.js';

assertConfig();
await connectDb(config.mongoUri);
console.log(`MongoDB connected: ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
const migrated = await assignUnownedData();
if (migrated.assigned) console.log(`Gave ${migrated.assigned} older records to ${migrated.to}.`);

createApp().listen(config.port, () => {
  console.log(`MonEXP API running at http://localhost:${config.port}/api`);
});
