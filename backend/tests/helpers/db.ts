import mongoose from "mongoose";

const URI = process.env.TEST_MONGODB_URI ?? "mongodb://localhost:27017/harmony_test";

let available: boolean | null = null;

/**
 * Integration specs need a real MongoDB — `docker compose up -d mongo`, or any
 * server pointed at by TEST_MONGODB_URI.
 *
 * We deliberately don't use an in-memory Mongo package: those download a mongod
 * binary from a foreign CDN on install, which isn't dependable everywhere this
 * project is developed. Instead the suite probes for a server once and skips
 * the integration specs cleanly when there isn't one, so `npm test` always runs.
 */
export async function mongoAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export async function connect(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 1500 });
  }
}

export async function disconnect(): Promise<void> {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

/** Empty every collection between test cases, keeping indexes intact. */
export async function clearDb(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

/**
 * Rewrite a document's `createdAt` past Mongoose's timestamp immutability.
 * Needed to test anything with a time window — an ordinary `updateOne` on
 * `createdAt` is silently ignored (modifiedCount: 0).
 */
export async function backdate(
  collection: string,
  filter: Record<string, unknown>,
  when: Date,
): Promise<void> {
  await mongoose.connection.collection(collection).updateMany(filter, {
    $set: { createdAt: when },
  });
}

export { mongoose };
