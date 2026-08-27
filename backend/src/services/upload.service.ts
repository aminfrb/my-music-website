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
import { ALLOWED_AUDIO, ALLOWED_AUDIO_LABEL } from "../constants";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { presignPutUrl, inspectObject, deleteObject } from "../upload/storage";
import { uploadLimiter, presignLimiter } from "../middleware/rateLimit";
import { normalizeTag, normalizeText, buildNormalized, dedupeKeyFor } from "../utils/text";
import { assertValidTitle, assertValidArtistName } from "../upload/nameValidation";
import { duplicateService } from "./duplicate.service";

const metadataSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  artistName: z.string().min(1).max(120).optional(),
  caption: z.string().max(280).nullish(),
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

/** Reject tags that admins have banned, and titles/captions containing them. */
async function assertContentAllowed(
  title: string | undefined | null,
  caption: string | undefined | null,
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
  const haystack = normalizeText(`${title ?? ""} ${caption ?? ""}`);
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
    // Hourly ceiling on top of the daily cap: the daily limit counts published
    // tracks, so without this a script can open sessions (and, through them,
    // request presigned URLs) without ever publishing.
    uploadLimiter.consume(user._id.toString());
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
    presignLimiter.consume(user._id.toString());
    const key = `audio/${session._id}/${randomUUID()}`;
    const url = await presignPutUrl(key, contentType);
    session.audio = { key, mimeType: "", size: 0, duration: 0, hash: "", finalized: false };
    await session.save();
    return { session, key, url };
  },

  /**
   * Step: validate the uploaded audio object. Four gates, in order — the real
   * container type (sniff), that it actually decodes as playable audio of a
   * sane length (probe), and that nobody has already uploaded these exact bytes.
   * A file failing any of them is deleted from storage immediately.
   */
  async finalizeAudio(user: IUser, sessionId: string): Promise<IUploadSession> {
    const session = await getOwnedSession(user, sessionId);
    if (!session.audio?.key) throw errors.badInput("errors.uploadIncomplete");
    const audioKey = session.audio.key;
    const clientDuration = session.audio.duration ?? 0;

    const info = await inspectObject(audioKey, "audio", env.uploads.maxAudioBytes);

    /** Drop the rejected object and clear the slot before surfacing the error. */
    const reject = async (error: Error): Promise<never> => {
      await deleteObject(audioKey);
      session.audio = null;
      await session.save();
      throw error;
    };

    if (!info.sniff || !info.probe) {
      await reject(errors.badInput("errors.invalidAudioType", { allowed: ALLOWED_AUDIO_LABEL }));
    }
    const probe = info.probe!;

    // The bytes start like audio — now confirm the container really decodes.
    // A text file beginning with "ID3" gets this far and dies here.
    if (!probe.hasAudioFrames) {
      await reject(errors.badInput("errors.audioNotPlayable"));
    }
    if (!(probe.format in ALLOWED_AUDIO)) {
      await reject(errors.badInput("errors.invalidAudioType", { allowed: ALLOWED_AUDIO_LABEL }));
    }

    // Duration comes from the file itself, never from the client.
    const duration = probe.duration;
    if (duration !== null) {
      if (duration < env.uploads.minAudioSeconds) {
        await reject(errors.badInput("errors.audioTooShort", { seconds: env.uploads.minAudioSeconds }));
      }
      if (duration > env.uploads.maxAudioSeconds) {
        await reject(
          errors.badInput("errors.audioTooLong", {
            minutes: Math.round(env.uploads.maxAudioSeconds / 60),
          }),
        );
      }
    }

    // Byte-identical audio already on the platform — from anyone, not just this
    // user. Checked here so the file is rejected before metadata is even asked for.
    const dupe = await duplicateService.find(null, null, info.hash);
    if (dupe) {
      const details = await duplicateService.details(dupe);
      await reject(
        dupe.music.uploadedBy.equals(user._id)
          ? errors.conflict("errors.duplicateFile", { title: dupe.music.title }, { duplicate: details })
          : errors.conflict(
              "errors.duplicateTrack",
              {
                title: dupe.music.title,
                artist: dupe.music.artistName,
                name: dupe.uploader?.displayName ?? "",
              },
              { duplicate: details },
            ),
      );
    }

    session.audio = {
      key: audioKey,
      mimeType: info.sniff!.mime,
      size: info.size,
      duration: duration !== null ? Math.round(duration) : clientDuration,
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
    presignLimiter.consume(user._id.toString());
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
    const title = data.title ?? session.metadata.title;
    const artistName = data.artistName ?? session.metadata.artistName;

    // Names are checked here (not only at publish) so the user is corrected on
    // the details step, while the form is still in front of them.
    if (title != null) assertValidTitle(title);
    if (artistName != null) assertValidArtistName(artistName);

    await assertContentAllowed(
      title,
      data.caption ?? session.metadata.caption,
      tags,
    );

    if (title && artistName) {
      await duplicateService.assertNotDuplicate(user._id, title, artistName, session.audio?.hash);
    }

    session.metadata = {
      title: data.title ?? session.metadata.title ?? null,
      artistName: data.artistName ?? session.metadata.artistName ?? null,
      caption: data.caption ?? session.metadata.caption ?? null,
      genre: data.genreId ? new Types.ObjectId(data.genreId) : session.metadata.genre ?? null,
      tags,
      visibility: data.visibility ?? session.metadata.visibility ?? "public",
    };
    // Only trust the client's duration when the container didn't reveal one
    // (e.g. an M4A with its moov atom past the buffered head).
    if (data.duration !== undefined && session.audio && !session.audio.duration) {
      session.audio.duration = data.duration;
    }
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
    assertValidTitle(m.title);
    assertValidArtistName(m.artistName);
    await assertContentAllowed(m.title, m.caption, m.tags);
    // Re-checked at publish: the song may have been claimed by someone else
    // between the details step and now.
    await duplicateService.assertNotDuplicate(
      user._id,
      m.title,
      m.artistName,
      session.audio.hash,
    );

    const music = await Music.create({
      title: m.title,
      artistName: m.artistName,
      caption: m.caption ?? null,
      genre: m.genre,
      tags: m.tags,
      coverImageKey: session.cover?.finalized ? session.cover.key : null,
      audioFileKey: session.audio.key,
      duration: session.audio.duration ?? 0,
      fileSize: session.audio.size,
      mimeType: session.audio.mimeType,
      fileHash: session.audio.hash,
      dedupeKey: dedupeKeyFor(m.title, m.artistName),
      artistKey: normalizeText(m.artistName),
      uploadedBy: user._id,
      // Uploads go live immediately — there is no pre-publication review.
      // Moderation is after the fact: admins can still block or remove a track.
      status: "published",
      visibility: m.visibility,
      publishedAt: new Date(),
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
