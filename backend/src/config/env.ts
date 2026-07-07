import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}

const supportedLocales = required("SUPPORTED_LOCALES", "en,fa")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProd: process.env.NODE_ENV === "production",
  port: int("PORT", 4000),
  publicUrl: required("PUBLIC_URL", "http://localhost:4000").replace(/\/$/, ""),
  corsOrigins: required("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  mongoUri: required("MONGODB_URI", "mongodb://localhost:27017/harmony"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev-access-secret"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev-refresh-secret"),
    accessTtl: required("ACCESS_TOKEN_TTL", "15m"),
    refreshTtl: required("REFRESH_TOKEN_TTL", "30d"),
  },

  uploads: {
    maxAudioBytes: int("MAX_AUDIO_BYTES", 52_428_800), // 50 MB
    maxImageBytes: int("MAX_IMAGE_BYTES", 5_242_880), // 5 MB
    // Auto-publish bypasses the moderation queue (content lands "published").
    autoPublish: bool("AUTO_PUBLISH", false),
    // Daily upload caps — stricter for brand-new accounts, looser for trusted ones.
    dailyLimitNewUser: int("DAILY_UPLOAD_LIMIT_NEW", 3),
    dailyLimitDefault: int("DAILY_UPLOAD_LIMIT", 10),
    dailyLimitTrusted: int("DAILY_UPLOAD_LIMIT_TRUSTED", 50),
    // Accounts younger than this many hours are treated as "new".
    newUserAgeHours: int("NEW_USER_AGE_HOURS", 48),
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: required("S3_REGION", "us-east-1"),
    bucket: required("S3_BUCKET", "harmony-media"),
    accessKeyId: required("S3_ACCESS_KEY_ID", "harmony"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY", "harmony-secret"),
    forcePathStyle: bool("S3_FORCE_PATH_STYLE", true),
    // TTL (seconds) for presigned GET (playback) URLs.
    getTtl: int("PRESIGN_GET_TTL", 3600),
    // TTL (seconds) for presigned PUT (direct upload) URLs.
    putTtl: int("PRESIGN_PUT_TTL", 900),
  },

  i18n: {
    defaultLocale: required("DEFAULT_LOCALE", "en"),
    supportedLocales,
  },
} as const;

export type Env = typeof env;
