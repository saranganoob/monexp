import { config, assertConfig } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

assertConfig();
await connectDb(config.mongoUri);
console.log(`MongoDB connected: ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);

createApp().listen(config.port, () => {
  console.log(`MonEXP API running at http://localhost:${config.port}/api`);
});
