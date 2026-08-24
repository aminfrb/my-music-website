/**
 * One-off migration: populate `dedupeKey` and `artistKey` on Music documents
 * created before cross-user duplicate detection existed.
 *
 * Run once after deploying:  npx tsx scripts/backfill-dedupe-keys.ts
 *
 * Tracks that collide with an earlier upload are reported but left alone —
 * deciding what to do with pre-existing duplicates is a moderation call, not
 * something a migration should make silently.
 */
import "dotenv/config";
import { connectDb, disconnectDb } from "../src/db/mongoose";
import { Music, User } from "../src/models";
import { dedupeKeyFor, normalizeText } from "../src/utils/text";

async function main() {
  await connectDb();

  const all = await Music.find({}).select("title artistName uploadedBy status createdAt").lean().exec();
  console.log(`scanning ${all.length} tracks…`);

  const seen = new Map<string, { id: string; uploader: string }>();
  const collisions: { title: string; artist: string; firstUploader: string }[] = [];
  let updated = 0;

  // Oldest first, so the original upload is the one that owns the key.
  all.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const m of all) {
    const dedupeKey = dedupeKeyFor(m.title, m.artistName);
    const artistKey = normalizeText(m.artistName ?? "");
    await Music.updateOne({ _id: m._id }, { $set: { dedupeKey, artistKey } });
    updated++;

    if (!dedupeKey) continue;
    const claiming = m.status === "published" || m.status === "pending";
    if (!claiming) continue;
    const prev = seen.get(dedupeKey);
    if (prev) {
      collisions.push({
        title: m.title,
        artist: m.artistName,
        firstUploader: prev.uploader,
      });
    } else {
      seen.set(dedupeKey, { id: m._id.toString(), uploader: m.uploadedBy.toString() });
    }
  }

  console.log(`updated ${updated} tracks`);

  if (collisions.length) {
    const names = new Map(
      (await User.find({}).select("displayName").lean().exec()).map((u) => [
        u._id.toString(),
        u.displayName,
      ]),
    );
    console.log(`\n${collisions.length} pre-existing duplicate(s) — review manually:`);
    for (const c of collisions) {
      console.log(`  "${c.title}" by ${c.artist} (first posted by ${names.get(c.firstUploader) ?? c.firstUploader})`);
    }
  } else {
    console.log("no duplicate songs found");
  }

  await disconnectDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
