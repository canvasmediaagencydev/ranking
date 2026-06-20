import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

// Reuse connection across hot reloads in dev
const globalWithMongoose = global as typeof globalThis & {
  _mongooseConn?: typeof mongoose;
};

async function connectDB(): Promise<typeof mongoose> {
  if (globalWithMongoose._mongooseConn && mongoose.connection.readyState === 1) {
    return globalWithMongoose._mongooseConn;
  }
  const conn = await mongoose.connect(MONGODB_URI);
  globalWithMongoose._mongooseConn = conn;
  return conn;
}

export default connectDB;
