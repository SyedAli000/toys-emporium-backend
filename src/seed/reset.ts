import mongoose from 'mongoose';
import { MONGODB_URI, runSeed } from './seed';

async function resetDatabase() {
  await mongoose.connect(MONGODB_URI);
  const dbName = mongoose.connection.name;
  await mongoose.connection.dropDatabase();
  console.log(`Dropped database: ${dbName}`);
  await runSeed();
  await mongoose.disconnect();
  console.log('Database reset complete');
}

resetDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
