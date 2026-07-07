import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

mongoose.set("strictQuery", true);

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connecting) {
    connecting = mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10_000,
    });
    mongoose.connection.on("error", (err) =>
      logger.error("mongo connection error", { error: err.message }),
    );
    mongoose.connection.once("open", () => logger.info("mongo connected"));
  }
  return connecting;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect().catch(() => undefined);
  connecting = null;
}

export { mongoose };
