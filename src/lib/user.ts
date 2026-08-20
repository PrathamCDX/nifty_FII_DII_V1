import mongoose from "mongoose";
import { connectToDatabase } from "./mongodb";

export type GoogleUser = {
  email: string;
  name: string;
  image: string | null;
  googleId: string;
};

type UserDoc = {
  email: string;
  name: string;
  image: string | null;
  googleId: string;
  provider: string;
  signInCount: number;
  lastIndempotencyKey: number;
};

type UserModel = mongoose.Model<UserDoc>;

const userSchema = new mongoose.Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    image: { type: String, default: null },
    googleId: { type: String, required: true, unique: true, sparse: true },
    provider: { type: String, required: true, default: "google" },
    signInCount: { type: Number, default: 0 },
    lastIndempotencyKey: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "users" }
);

function getUserModel(): UserModel {
  const existing = mongoose.models.User as UserModel | undefined;
  return existing ?? mongoose.model<UserDoc>("User", userSchema);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function upsertGoogleUser(user: GoogleUser, currentIndempotencyKey: number): Promise<UserDoc | null> {
  try {
    await connectToDatabase();
    const currentUser = await getUserModel().findOne({ email: user.email }).lean();
    if (currentUser && currentUser.lastIndempotencyKey === currentIndempotencyKey) {
      return currentUser;
    }
    const doc = await getUserModel()
      .findOneAndUpdate(
        { email: user.email },
        {
          $setOnInsert: {
            email: user.email,
            googleId: user.googleId,
            provider: "google",
          },
          $set: { name: user.name, image: user.image ?? null, lastIndempotencyKey: currentIndempotencyKey },
          $inc: { signInCount: 1 },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
      .lean();
    return doc;
  } catch (err) {
    console.error(`[db] failed to upsert user ${user.email}: ${errorMessage(err)}`);
    return null;
  }
}
