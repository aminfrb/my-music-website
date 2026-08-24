import { Types } from "mongoose";
import { User, Genre, Music, type IUser, type IMusic, type IGenre } from "../../src/models";
import { dedupeKeyFor, normalizeText, buildNormalized } from "../../src/utils/text";

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${counter++}`;

export async function makeGenre(slug = "pop"): Promise<IGenre> {
  const existing = await Genre.findOne({ slug }).lean<IGenre>().exec();
  if (existing) return existing;
  return (
    await Genre.create({ slug, nameEn: slug, nameFa: slug })
  ).toObject();
}

export async function makeUser(overrides: Partial<IUser> = {}): Promise<IUser> {
  const n = uniq();
  const doc = await User.create({
    displayName: overrides.displayName ?? `User${n}`,
    email: overrides.email ?? `u${n}@test.local`,
    passwordHash: "x",
    ...overrides,
  });
  return doc.toObject();
}

export interface TrackOptions {
  title?: string;
  artistName?: string;
  genre?: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  duration?: number;
  playCount?: number;
  reactionCount?: number;
  tags?: string[];
  status?: string;
  publishedAt?: Date;
}

/** A published, public track with the derived keys the app maintains on write. */
export async function makeTrack(opts: TrackOptions): Promise<IMusic> {
  const n = uniq();
  const title = opts.title ?? `Song ${n}`;
  const artistName = opts.artistName ?? "Some Artist";
  const genre = opts.genre ?? (await makeGenre())._id;
  const tags = opts.tags ?? [];

  const doc = await Music.create({
    title,
    artistName,
    genre,
    tags,
    uploadedBy: opts.uploadedBy,
    audioFileKey: `audio/${n}`,
    mimeType: "audio/mpeg",
    fileHash: `hash-${n}`,
    duration: opts.duration ?? 200,
    playCount: opts.playCount ?? 0,
    reactionCount: opts.reactionCount ?? 0,
    status: opts.status ?? "published",
    visibility: "public",
    publishedAt: opts.publishedAt ?? new Date(),
    normalized: buildNormalized([title, artistName, ...tags]),
    dedupeKey: dedupeKeyFor(title, artistName),
    artistKey: normalizeText(artistName),
  });
  return doc.toObject();
}

/** Current playCount straight from the database. */
export async function playCountOf(id: Types.ObjectId): Promise<number> {
  const doc = await Music.findById(id).select("playCount").lean().exec();
  return doc?.playCount ?? 0;
}
