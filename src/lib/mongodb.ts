import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB;

type MongooseCache = {
  conn: mongoose.Mongoose | null;
  promise: Promise<mongoose.Mongoose> | null;
};

const globalCache = globalThis as { mongooseCache?: MongooseCache };
const cached: MongooseCache = globalCache.mongooseCache ?? {
  conn: null,
  promise: null,
};
globalCache.mongooseCache = cached;

export async function connectToDatabase(): Promise<mongoose.Mongoose> {
  if (cached.conn) {
    return cached.conn;
  }
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not defined. Copy .env.example to .env and fill it in."
    );
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      ...(MONGODB_DB ? { dbName: MONGODB_DB } : {}),
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
    });
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
}
