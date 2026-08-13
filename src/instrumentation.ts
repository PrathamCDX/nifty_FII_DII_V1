export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (!process.env.MONGODB_URI) {
    console.warn(
      "[db] MONGODB_URI not set — skipping DB init (copy .env.example to .env)"
    );
    return;
  }
  try {
    const { connectToDatabase } = await import("@/lib/mongodb");
    await connectToDatabase();
  } catch (err) {
    console.error(
      "[db] MongoDB connection failed at startup — continuing without database:",
      err instanceof Error ? err.message : err
    );
  }
}
