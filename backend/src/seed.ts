/**
 * Seed script — idempotent-ish (wipes demo collections, then re-creates).
 * Demo tracks reference placeholder audio keys that don't exist in storage, so
 * `streamUrl` is presigned but won't actually play. Upload a real file through
 * the upload-session flow to exercise playback end-to-end.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { connectDb, disconnectDb } from "./db/mongoose";
import {
  User,
  Genre,
  Music,
  Follow,
  Reaction,
  Playlist,
  PlaylistItem,
  MusicInteraction,
  RecommendationProfile,
} from "./models";
import { hashPassword } from "./auth/password";
import { buildNormalized, randomToken } from "./utils/text";
import { interactionService } from "./services/interaction.service";

const GENRES = [
  { slug: "pop", nameEn: "Pop", nameFa: "پاپ" },
  { slug: "rap", nameEn: "Rap", nameFa: "رپ" },
  { slug: "traditional", nameEn: "Traditional", nameFa: "سنتی" },
  { slug: "rock", nameEn: "Rock", nameFa: "راک" },
  { slug: "electronic", nameEn: "Electronic", nameFa: "الکترونیک" },
  { slug: "instrumental", nameEn: "Instrumental", nameFa: "بی‌کلام" },
  { slug: "podcast", nameEn: "Podcast", nameFa: "پادکست" },
  { slug: "religious", nameEn: "Religious", nameFa: "مذهبی" },
  { slug: "local", nameEn: "Local", nameFa: "محلی" },
  { slug: "classic", nameEn: "Classic", nameFa: "کلاسیک" },
  { slug: "other", nameEn: "Other", nameFa: "سایر" },
];

async function main() {
  await connectDb();
  console.log("Seeding…");

  await Promise.all([
    User.deleteMany({}),
    Genre.deleteMany({}),
    Music.deleteMany({}),
    Follow.deleteMany({}),
    Reaction.deleteMany({}),
    Playlist.deleteMany({}),
    PlaylistItem.deleteMany({}),
    MusicInteraction.deleteMany({}),
    RecommendationProfile.deleteMany({}),
  ]);

  await Genre.insertMany(GENRES);
  const genres = await Genre.find().lean();
  const gid = (slug: string) => genres.find((g) => g.slug === slug)!._id;

  const passwordHash = await hashPassword("password123");
  const [admin, , nima, sara, leo] = await User.create([
    { email: "admin@harmony.dev", displayName: "Harmony Admin", role: "admin", locale: "en", passwordHash, isTrusted: true, bio: "Platform administrator." },
    { email: "mod@harmony.dev", displayName: "Moderator", role: "admin", locale: "en", passwordHash, isTrusted: true },
    { email: "nima@harmony.dev", displayName: "Nima", role: "user", locale: "fa", passwordHash, isVerifiedArtist: true, bio: "تهیه‌کننده از تهران." },
    { email: "sara@harmony.dev", displayName: "Sara", role: "user", locale: "en", passwordHash, bio: "Indie pop singer." },
    { email: "leo@harmony.dev", displayName: "Leo", role: "user", locale: "en", passwordHash, bio: "Beatmaker & DJ." },
  ]);

  const tracks = [
    { title: "Midnight Drive", artistName: "Leo", uploader: leo, genre: "electronic", tags: ["synthwave", "night", "chill"], playCount: 1840, duration: 212 },
    { title: "شب‌های تهران", artistName: "Nima", uploader: nima, genre: "traditional", tags: ["tehran", "santur", "ambient"], playCount: 960, duration: 305 },
    { title: "Golden Hour", artistName: "Sara", uploader: sara, genre: "pop", tags: ["summer", "vocal", "uplifting"], playCount: 3120, duration: 198 },
    { title: "Concrete Flow", artistName: "Leo", uploader: leo, genre: "rap", tags: ["boombap", "lofi"], playCount: 770, duration: 176 },
    { title: "باران", artistName: "Nima", uploader: nima, genre: "classic", tags: ["piano", "rain", "calm"], playCount: 410, duration: 254 },
    { title: "Neon Memories", artistName: "Sara", uploader: sara, genre: "electronic", tags: ["synthwave", "retro"], playCount: 1290, duration: 233 },
    { title: "Desert Wind", artistName: "Leo", uploader: leo, genre: "instrumental", tags: ["ambient", "calm"], playCount: 95, duration: 220 },
  ];

  const created = [];
  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const m = await Music.create({
      title: t.title,
      artistName: t.artistName,
      genre: gid(t.genre),
      tags: t.tags,
      audioFileKey: `audio/seed-${i}.mp3`,
      mimeType: "audio/mpeg",
      fileSize: 4_200_000,
      fileHash: crypto.randomBytes(16).toString("hex"),
      duration: t.duration,
      uploadedBy: t.uploader._id,
      status: "published",
      visibility: "public",
      playCount: t.playCount,
      publishedAt: new Date(),
      normalized: buildNormalized([t.title, t.artistName, ...t.tags]),
    });
    created.push(m);
  }

  // Follows
  await Follow.create([
    { follower: sara._id, following: leo._id },
    { follower: sara._id, following: nima._id },
    { follower: nima._id, following: leo._id },
    { follower: leo._id, following: sara._id },
  ]);

  // A playlist with items (drives saveCount + "similar users" signal)
  const playlist = await Playlist.create({
    owner: sara._id,
    name: "Sara's Favourites",
    description: "Late-night electronic + pop.",
    visibility: "public",
    shareToken: randomToken(),
  });
  const picks = [created[0], created[2], created[5]];
  await PlaylistItem.insertMany(
    picks.map((m, position) => ({ playlist: playlist._id, music: m._id, position, addedBy: sara._id })),
  );
  playlist.itemCount = picks.length;
  await playlist.save();
  await Music.updateMany({ _id: { $in: picks.map((m) => m._id) } }, { $inc: { saveCount: 1 } });

  // Reactions
  await Reaction.create([
    { user: sara._id, music: created[0]._id, type: "fire" },
    { user: nima._id, music: created[2]._id, type: "like" },
    { user: leo._id, music: created[2]._id, type: "star" },
  ]);
  for (const m of created) {
    const n = await Reaction.countDocuments({ music: m._id });
    if (n) await Music.updateOne({ _id: m._id }, { $set: { reactionCount: n } });
  }

  // Interactions → builds Sara a taste profile so recommendations are personalized.
  await interactionService.record(sara._id, created[0].toObject(), "complete_play", 200);
  await interactionService.record(sara._id, created[5].toObject(), "complete_play", 230);
  await interactionService.record(sara._id, created[5].toObject(), "reaction");

  console.log("Seed complete:");
  console.log("  admin@harmony.dev / password123  (admin)");
  console.log("  sara@harmony.dev  / password123  (user)");
  console.log(`  ${created.length} tracks, ${genres.length} genres seeded.`);
  void admin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
