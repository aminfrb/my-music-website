import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Types } from "mongoose";
import {
  UploadSession,
  Music,
  Genre,
  Tag,
  type IUploadSession,
  type IUser,
  type IMusic,
} from "../models";
import { env } from "../config/env";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { presignPutUrl, inspectObject, deleteObject } from "../upload/storage";
import { normalizeTag, normalizeText, buildNormalized } from "../utils/text";

const metadataSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  artistName: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullish(),
  genreId: z.string().optional(),
  tags: z.array(z.string().min(1).max(30)).max(15).optional(),
  visibility: z.enum(["public", "private"]).optional(),
  duration: z.number().int().min(0).max(60 * 60 * 5).optional(),
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function dailyLimitFor(user: IUser): Promise<number> {
  if (user.isTrusted) return env.uploads.dailyLimitTrusted;
  const ageHours = (Date.now() - user.createdAt.getTime()) / 3_600_000;
  if (ageHours < env.uploads.newUserAgeHours) return env.uploads.dailyLimitNewUser;
  return env.uploads.dailyLimitDefault;
}

async function assertDailyLimit(user: IUser): Promise<void> {
  const limit = await dailyLimitFor(user);
  const today = await Music.countDocuments({
    uploadedBy: user._id,
    createdAt: { $gte: startOfToday() },
  });
  if (today >= limit) throw errors.badInput("errors.dailyUploadLimit", { limit });
}

/** Reject tags that admins have banned, and titles/descriptions containing them. */
async function assertContentAllowed(
  title: string | undefined | null,
  description: string | undefined | null,
  tags: string[],
): Promise<void> {
  const banned = await Tag.find({ isBanned: true }).select("name").lean().exec();
  if (banned.length === 0) return;
  const bannedNames = banned.map((b) => b.name);

  for (const tag of tags) {
    if (bannedNames.includes(normalizeTag(tag))) {
      throw errors.badInput("errors.bannedTag", { tag });
    }
  }
  const haystack = normalizeText(`${title ?? ""} ${description ?? ""}`);
  for (const name of bannedNames) {
    if (name && haystack.includes(name.replace(/-/g, " "))) {
      throw errors.badInput("errors.bannedContent");
    }
  }
}

async function getOwnedSession(user: IUser, sessionId: string): Promise<IUploadSession & { save: () => Promise<unknown> }> {
  if (!Types.ObjectId.isValid(sessionId)) throw errors.notFound("errors.sessionNotFound");
  const session = await UploadSession.findById(sessionId);
  if (!session || !session.user.equals(user._id) || session.status === "published") {
    throw errors.notFound("errors.sessionNotFound");
  }
  return session as never;
}

export const uploadService = {
  async createSession(user: IUser): Promise<IUploadSession> {
    await assertDailyLimit(user);
    return UploadSession.create({ user: user._id, status: "draft", step: 1, metadata: {} });
  },

  /** Step: get a presigned PUT URL for the audio file. */
  async requestAudioUpload(
    user: IUser,
    sessionId: string,
    contentType = "application/octet-stream",
  ): Promise<{ session: IUploadSession; key: string; url: string }> {
    const session = await getOwnedSession(user, sessionId);
    const key = `audio/${session._id}/${randomUUID()}`;
    const url = await presignPutUrl(key, contentType);
    session.audio = { key, mimeType: "", size: 0, duration: 0, hash: "", finalized: false };
    await session.save();
    return { session, key, url };
  },

  /** Step: validate the uploaded audio object (sniff + size + dedup). */
  async finalizeAudio(user: IUser, sessionId: string): Promise<IUploadSession> {
    const session = await getOwnedSession(user, sessionId);
    if (!session.audio?.key) throw errors.badInput("errors.uploadIncomplete");

    const info = await inspectObject(session.audio.key, "audio", env.uploads.maxAudioBytes);
    if (!info.sniff) {
      await deleteObject(session.audio.key);
      session.audio = null;
      await session.save();
      throw errors.badInput("errors.invalidAudioType");
    }
    const dupe = await Music.exists({ uploadedBy: user._id, fileHash: info.hash });
    if (dupe) {
      await deleteObject(session.audio.key);
      session.audio = null;
      await session.save();
      throw errors.conflict("errors.duplicateFile");
    }
    session.audio = {
      key: session.audio.key,
      mimeType: info.sniff.mime,
      size: info.size,
      duration: session.audio.duration ?? 0,
      hash: info.hash,
      finalized: true,
    };
    session.step = Math.max(session.step, 2);
    await session.save();
    return session;
  },

  async requestCoverUpload(
    user: IUser,
    sessionId: string,
    contentType = "application/octet-stream",
  ): Promise<{ session: IUploadSession; key: string; url: string }> {
    const session = await getOwnedSession(user, sessionId);
    const key = `covers/${session._id}/${randomUUID()}`;
    const url = await presignPutUrl(key, contentType);
    session.cover = { key, mimeType: "", size: 0, finalized: false };
    await session.save();
    return { session, key, url };
  },

  async finalizeCover(user: IUser, sessionId: string): Promise<IUploadSession> {
    const session = await getOwnedSession(user, sessionId);
    if (!session.cover?.key) throw errors.badInput("errors.uploadIncomplete");
    const info = await inspectObject(session.cover.key, "image", env.uploads.maxImageBytes);
    if (!info.sniff) {
      await deleteObject(session.cover.key);
      session.cover = null;
      await session.save();
      throw errors.badInput("errors.invalidImageType");
    }
    session.cover = {
      key: session.cover.key,
      mimeType: info.sniff.mime,
      size: info.size,
      finalized: true,
    };
    await session.save();
    return session;
  },

  /** Step: persist metadata onto the session (validated + content-checked). */
  async setMetadata(user: IUser, sessionId: string, input: unknown): Promise<IUploadSession> {
    const session = await getOwnedSession(user, sessionId);
    const data = parse(metadataSchema, input);

    if (data.genreId) {
      if (!Types.ObjectId.isValid(data.genreId) || !(await Genre.exists({ _id: data.genreId }))) {
        throw errors.badInput("errors.genreNotFound");
      }
    }
    const tags = (data.tags ?? session.metadata.tags ?? []).map(normalizeTag).filter(Boolean);
    await assertContentAllowed(
      data.title ?? session.metadata.title,
      data.description ?? session.metadata.description,
      tags,
    );

    session.metadata = {
      title: data.title ?? session.metadata.title ?? null,
      artistName: data.artistName ?? session.metadata.artistName ?? null,
      description: data.description ?? session.metadata.description ?? null,
      genre: data.genreId ? new Types.ObjectId(data.genreId) : session.metadata.genre ?? null,
      tags,
      visibility: data.visibility ?? session.metadata.visibility ?? "public",
    };
    if (data.duration !== undefined && session.audio) session.audio.duration = data.duration;
    session.step = Math.max(session.step, 3);
    await session.save();
    return session;
  },

  /** Final step: create the Music document from the session. */
  async publish(user: IUser, sessionId: string): Promise<IMusic> {
    const session = await getOwnedSession(user, sessionId);
    const m = session.metadata;
    if (!session.audio?.finalized) throw errors.badInput("errors.uploadIncomplete");
    if (!m.title || !m.artistName || !m.genre) throw errors.badInput("errors.uploadIncomplete");

    await assertDailyLimit(user);
    await assertContentAllowed(m.title, m.description, m.tags);

    const autoPublish = env.uploads.autoPublish;
    const music = await Music.create({
      title: m.title,
      artistName: m.artistName,
      description: m.description ?? null,
      genre: m.genre,
      tags: m.tags,
      coverImageKey: session.cover?.finalized ? session.cover.key : null,
      audioFileKey: session.audio.key,
      duration: session.audio.duration ?? 0,
      fileSize: session.audio.size,
      mimeType: session.audio.mimeType,
      fileHash: session.audio.hash,
      uploadedBy: user._id,
      status: autoPublish ? "published" : "pending",
      visibility: m.visibility,
      publishedAt: autoPublish ? new Date() : null,
      normalized: buildNormalized([m.title, m.artistName, ...m.tags]),
    });

    // Upsert tags + bump usage counts.
    for (const tag of m.tags) {
      await Tag.updateOne(
        { name: tag },
        { $inc: { usageCount: 1 }, $setOnInsert: { isBanned: false } },
        { upsert: true },
      );
    }

    session.status = "published";
    session.music = music._id;
    await session.save();
    return music.toObject();
  },
};
