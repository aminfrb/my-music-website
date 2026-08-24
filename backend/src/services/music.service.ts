import { z } from "zod";
import { Types } from "mongoose";
import {
  Music,
  Reaction,
  MusicInteraction,
  Genre,
  Tag,
  type IMusic,
  type IUser,
} from "../models";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { interactionService } from "./interaction.service";
import { playLimiter, anonPlayLimiter, playCooldown } from "../middleware/rateLimit";
import { buildNormalized, normalizeTag, dedupeKeyFor, normalizeText } from "../utils/text";
import { assertValidTitle, assertValidArtistName } from "../upload/nameValidation";
import { duplicateService } from "./duplicate.service";
import {
  buildConnection,
  afterIdFilter,
  clampLimit,
  idCursor,
  type Connection,
  type PageArgs,
} from "../utils/pagination";

const PUBLIC: Record<string, unknown> = { status: "published", visibility: "public" };

const updateSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  artistName: z.string().min(1).max(120).optional(),
  caption: z.string().max(280).nullish(),
  description: z.string().max(2000).nullish(),
  genreId: z.string().optional(),
  tags: z.array(z.string().min(1).max(30)).max(15).optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

function canView(music: IMusic, viewer: IUser | null): boolean {
  if (music.status === "published" && music.visibility === "public") return true;
  if (!viewer) return false;
  if (music.uploadedBy.equals(viewer._id)) return true;
  if (viewer.role === "admin") return true;
  // published private → owner/admin only (already returned above)
  return false;
}

function startOf(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 86_400_000);
}
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Fetch musics by id list, preserving the given order. */
async function byIdsOrdered(ids: Types.ObjectId[]): Promise<IMusic[]> {
  if (ids.length === 0) return [];
  const docs = await Music.find({ _id: { $in: ids }, ...PUBLIC }).lean<IMusic[]>().exec();
  const map = new Map(docs.map((d) => [d._id.toString(), d]));
  return ids.map((id) => map.get(id.toString())).filter((m): m is IMusic => !!m);
}

/** Below this, a listen is a page load or a scrub, not a play. */
const MIN_PLAY_SECONDS = 5;
/** Floor for the replay cooldown, so very short tracks still can't be looped. */
const MIN_REPLAY_COOLDOWN_MS = 30_000;
/** Fallback cap when a track has no known duration (5 hours, the upload max). */
const MAX_LISTEN_SECONDS = 60 * 60 * 5;

export const musicService = {
  async byId(id: string, viewer: IUser | null): Promise<IMusic> {
    if (!Types.ObjectId.isValid(id)) throw errors.notFound("errors.musicNotFound");
    const music = await Music.findById(id).lean<IMusic>().exec();
    if (!music || !canView(music, viewer)) throw errors.notFound("errors.musicNotFound");
    return music;
  },

  async update(user: IUser, id: string, input: unknown): Promise<IMusic> {
    const music = await Music.findById(id);
    if (!music) throw errors.notFound("errors.musicNotFound");
    if (!music.uploadedBy.equals(user._id) && user.role !== "admin") {
      throw errors.forbidden("errors.notOwner");
    }
    const data = parse(updateSchema, input);
    if (data.genreId) {
      if (!Types.ObjectId.isValid(data.genreId) || !(await Genre.exists({ _id: data.genreId }))) {
        throw errors.badInput("errors.genreNotFound");
      }
      music.genre = new Types.ObjectId(data.genreId);
    }
    // Renaming goes through the same naming rules and duplicate check as the
    // original upload — otherwise a valid title could be swapped for junk, or
    // for a song someone else already owns, right after publishing.
    if (data.title !== undefined) {
      assertValidTitle(data.title);
      music.title = data.title;
    }
    if (data.artistName !== undefined) {
      assertValidArtistName(data.artistName);
      music.artistName = data.artistName;
    }
    if (data.title !== undefined || data.artistName !== undefined) {
      await duplicateService.assertNotDuplicate(
        user._id,
        music.title,
        music.artistName,
        null,
        music._id,
      );
      music.dedupeKey = dedupeKeyFor(music.title, music.artistName);
      music.artistKey = normalizeText(music.artistName);
    }
    if (data.caption !== undefined) music.caption = data.caption;
    if (data.description !== undefined) music.description = data.description;
    if (data.visibility) music.visibility = data.visibility;
    if (data.tags) {
      music.tags = data.tags.map(normalizeTag).filter(Boolean);
      for (const tag of music.tags) {
        await Tag.updateOne(
          { name: tag },
          { $inc: { usageCount: 1 }, $setOnInsert: { isBanned: false } },
          { upsert: true },
        );
      }
    }
    music.normalized = buildNormalized([music.title, music.artistName, ...music.tags]);
    await music.save();
    return music.toObject();
  },

  async remove(user: IUser, id: string): Promise<boolean> {
    const music = await Music.findById(id);
    if (!music) throw errors.notFound("errors.musicNotFound");
    if (!music.uploadedBy.equals(user._id) && user.role !== "admin") {
      throw errors.forbidden("errors.notOwner");
    }
    await music.deleteOne();
    return true;
  },

  /**
   * Record a play / completion; updates counters + taste profile for signed-in
   * users.
   *
   * `playCount` feeds both the homepage rankings and the recommendation ranker,
   * so this endpoint is the obvious lever for anyone wanting to promote a
   * track. The client is treated as hostile: the reported listen time is
   * clamped to the real duration, a play too short to be a listen is ignored,
   * uploaders can't farm their own uploads, and the same listener can't count
   * the same track again until enough time has passed for them to have
   * actually heard it. Anything rejected is dropped silently — a listener
   * whose replay doesn't count shouldn't see an error.
   */
  async recordPlay(
    id: string,
    viewer: IUser | null,
    seconds: number,
    ip = "unknown",
  ): Promise<IMusic> {
    const music = await Music.findById(id).lean<IMusic>().exec();
    if (!music || music.status !== "published") throw errors.notFound("errors.musicNotFound");

    // Never trust the reported time: cap it at the track's real length so a
    // huge value can't force `complete_play` or skew averageListenDuration.
    const cap = music.duration > 0 ? music.duration : MAX_LISTEN_SECONDS;
    const listened = Math.min(Math.max(0, Math.floor(seconds || 0)), cap);

    // Too brief to be a listen. Also covers the `seconds: 0` call that used to
    // earn a signed-in user a free increment.
    if (listened < MIN_PLAY_SECONDS) return music;

    // Uploaders don't inflate their own numbers.
    if (viewer && music.uploadedBy.equals(viewer._id)) return music;

    const listener = viewer ? `u:${viewer._id.toString()}` : `ip:${ip}`;
    // Burst guard, well above any genuine listening rate. Anonymous listeners
    // get a looser bucket because an IP can be a whole NAT'd network.
    (viewer ? playLimiter : anonPlayLimiter).consume(listener);

    // You cannot legitimately hear the same track twice in less time than the
    // track runs for.
    const cooldownMs = Math.max(MIN_REPLAY_COOLDOWN_MS, cap * 1000);
    if (!playCooldown.check(`${listener}|${music._id.toString()}`, cooldownMs)) return music;

    // The in-memory cooldown is lost on restart and isn't shared across
    // instances; for signed-in users the interaction log is authoritative.
    if (viewer) {
      const recent = await MusicInteraction.findOne({
        user: viewer._id,
        music: music._id,
        type: { $in: ["play", "complete_play"] },
        createdAt: { $gte: new Date(Date.now() - cooldownMs) },
      })
        .select("_id")
        .lean()
        .exec();
      if (recent) return music;
    }

    const completed = music.duration > 0 && listened >= music.duration * 0.9;
    const type = completed ? "complete_play" : "play";

    if (viewer) {
      // Increments playCount and updates the taste profile.
      await interactionService.record(viewer._id, music, type, listened);
    } else {
      await Music.updateOne({ _id: music._id }, { $inc: { playCount: 1 } });
    }
    return (await Music.findById(id).lean<IMusic>().exec())!;
  },

  /** Generic interaction recorder (skip, share, …) for signed-in users. */
  async recordInteraction(
    viewer: IUser,
    id: string,
    type: "skip" | "share",
    seconds = 0,
  ): Promise<boolean> {
    const music = await Music.findById(id).lean<IMusic>().exec();
    if (!music || music.status !== "published") throw errors.notFound("errors.musicNotFound");
    // Same burst guard as plays: these write an interaction row each time.
    playLimiter.consume(`i:${viewer._id.toString()}`);
    const cap = music.duration > 0 ? music.duration : MAX_LISTEN_SECONDS;
    await interactionService.record(
      viewer._id,
      music,
      type,
      Math.min(Math.max(0, Math.floor(seconds || 0)), cap),
    );
    return true;
  },

  // ── Discovery / homepage sections ──

  async feedLatest(page: PageArgs): Promise<Connection<IMusic>> {
    const limit = clampLimit(page.first);
    const filter = { ...PUBLIC, ...afterIdFilter(page.after) };
    const [rows, totalCount] = await Promise.all([
      Music.find(filter).sort({ _id: -1 }).limit(limit + 1).lean<IMusic[]>().exec(),
      Music.countDocuments(PUBLIC),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  async trending(limit = 12): Promise<IMusic[]> {
    const recent = { ...PUBLIC, publishedAt: { $gte: startOf(30) } };
    const count = await Music.countDocuments(recent);
    const filter = count > 0 ? recent : PUBLIC;
    return Music.find(filter)
      .sort({ playCount: -1, reactionCount: -1, _id: -1 })
      .limit(limit)
      .lean<IMusic[]>().exec();
  },

  async todayPopular(limit = 12): Promise<IMusic[]> {
    const agg = await MusicInteraction.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { type: { $in: ["play", "complete_play"] }, createdAt: { $gte: startOfToday() } } },
      { $group: { _id: "$music", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: limit },
    ]);
    return byIdsOrdered(agg.map((a) => a._id));
  },

  async weekMostReacted(limit = 12): Promise<IMusic[]> {
    const agg = await Reaction.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { createdAt: { $gte: startOf(7) } } },
      { $group: { _id: "$music", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: limit },
    ]);
    return byIdsOrdered(agg.map((a) => a._id));
  },

  /** Less-discovered: published tracks with low play counts, newest first. */
  async lessDiscovered(limit = 12): Promise<IMusic[]> {
    return Music.find({ ...PUBLIC, playCount: { $lt: 50 } })
      .sort({ _id: -1 })
      .limit(limit)
      .lean<IMusic[]>().exec();
  },

  async similar(id: string, limit = 12): Promise<IMusic[]> {
    if (!Types.ObjectId.isValid(id)) return [];
    const base = await Music.findById(id).lean<IMusic>().exec();
    if (!base) return [];
    return Music.find({
      ...PUBLIC,
      _id: { $ne: base._id },
      $or: [{ genre: base.genre }, { tags: { $in: base.tags } }],
    })
      .sort({ playCount: -1, _id: -1 })
      .limit(limit)
      .lean<IMusic[]>()
      .exec();
  },

  async byUploader(
    uploaderId: Types.ObjectId,
    viewer: IUser | null,
    page: PageArgs,
  ): Promise<Connection<IMusic>> {
    const limit = clampLimit(page.first);
    const isSelfOrAdmin = viewer && (viewer._id.equals(uploaderId) || viewer.role === "admin");
    const filter: Record<string, unknown> = {
      uploadedBy: uploaderId,
      ...afterIdFilter(page.after),
      ...(isSelfOrAdmin ? {} : { status: "published", visibility: "public" }),
    };
    const countFilter = isSelfOrAdmin
      ? { uploadedBy: uploaderId }
      : { uploadedBy: uploaderId, status: "published", visibility: "public" };
    const [rows, totalCount] = await Promise.all([
      Music.find(filter).sort({ _id: -1 }).limit(limit + 1).lean<IMusic[]>().exec(),
      Music.countDocuments(countFilter),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  reactionCount(musicId: Types.ObjectId): Promise<number> {
    return Reaction.countDocuments({ music: musicId }).exec();
  },
};
