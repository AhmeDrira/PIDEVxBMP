const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const startTestDb = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGO_URI = uri;
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  return uri;
};

const stopTestDb = async () => {
  await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

const clearTestDb = async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({}).catch(() => {});
  }
};

module.exports = { startTestDb, stopTestDb, clearTestDb };
