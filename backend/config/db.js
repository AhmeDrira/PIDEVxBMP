const mongoose = require('mongoose');

if (typeof mongoose.set === 'function') {
  mongoose.set('bufferCommands', false);
  mongoose.set('bufferTimeoutMS', 0);
}

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  const connectOptions = process.env.NODE_ENV === 'test'
    ? undefined
    : { serverSelectionTimeoutMS: 5000 };

  try {
    const conn = connectOptions ? await mongoose.connect(mongoUri, connectOptions) : await mongoose.connect(mongoUri);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (process.env.NODE_ENV === 'test') {
      console.error(`Error: ${error.message}`);
      process.exit(1);
      return null;
    }

    console.warn(`MongoDB connection failed (${error.message}). Starting backend in degraded mode without a database connection.`);
    return null;
  }
};

module.exports = connectDB;
