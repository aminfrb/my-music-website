/**
 * One-off: create/update the "amin" test account without wiping data.
 * Run:  npx tsx scripts/create-amin.ts
 * Login: amin@amin.com  /  amin
 */
import { connectDb, disconnectDb } from "../src/db/mongoose";
import { User } from "../src/models";
import { hashPassword } from "../src/auth/password";

async function main() {
  await connectDb();
  const passwordHash = await hashPassword("amin");
  const res = await User.updateOne(
    { email: "amin@amin.com" },
    {
      $set: { displayName: "amin", passwordHash, isTrusted: true, locale: "en" },
      $setOnInsert: { email: "amin@amin.com", role: "user", bio: "Test account." },
    },
    { upsert: true },
  );
  console.log(res.upsertedCount ? "Created amin@amin.com / amin" : "Updated amin@amin.com / amin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
