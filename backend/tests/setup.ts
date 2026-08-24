/**
 * Loaded before every spec. Pins the environment the code under test reads at
 * import time, so a developer's .env can't change what the suite asserts.
 */
process.env.NODE_ENV = "test";
process.env.MIN_AUDIO_SECONDS ??= "10";
process.env.MAX_AUDIO_SECONDS ??= String(60 * 60 * 5);
process.env.DEFAULT_LOCALE = "en";
process.env.SUPPORTED_LOCALES = "en,fa";
// Never point at the dev database by accident.
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI ?? "mongodb://localhost:27017/harmony_test";
