import { Types } from "mongoose";
import {
  Music,
  MusicInteraction,
  PlaylistItem,
  RecommendationProfile,
  type IMusic,
} from "../models";

const PUBLIC = { status: "published", visibility: "public" } as const;

type ScoreMap = Record<string, number> | Map<string, number>;

function entries(map: ScoreMap | undefined): [string, number][] {
  if (!map) return [];
  if (map instanceof Map) return [...map.entries()];
  return Object.entries(map);
}
function topKeys(map: ScoreMap | undefined, k: number): string[] {
  return entries(map)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key]) => key);
}
function toObjectIds(ids: string[]): Types.ObjectId[] {
  return ids.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
}

/** Ids the user has already engaged with (or uploaded) — excluded from recs. */
async function excludedIds(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const [interacted, own] = await Promise.all([
    MusicInteraction.distinct("music", { user: userId }),
    Music.find({ uploadedBy: userId }).select("_id").lean().exec(),
  ]);
  const set = new Map<string, Types.ObjectId>();
  for (const id of interacted as Types.ObjectId[]) set.set(id.toString(), id);
  for (const m of own) set.set(m._id.toString(), m._id);
  return [...set.values()];
}

export const recommendationService = {
  /**
   * "For You" — the main personalized ranking. Scores published candidates by
   * genre/tag/uploader affinity (from the taste profile) blended with popularity
   * and recency, excluding anything already seen. Cold-start → trending.
   */
  async forYou(userId: Types.ObjectId, limit = 20): Promise<IMusic[]> {
    const profile = await RecommendationProfile.findOne({ user: userId }).lean().exec();
    const exclude = await excludedIds(userId);

    const topGenres = toObjectIds(topKeys(profile?.genreScores as ScoreMap, 5));
    const topTags = topKeys(profile?.tagScores as ScoreMap, 10);
    const topUploaders = toObjectIds(topKeys(profile?.uploaderScores as ScoreMap, 10));

    if (topGenres.length === 0 && topTags.length === 0 && topUploaders.length === 0) {
      return Music.find({ ...PUBLIC, _id: { $nin: exclude } })
        .sort({ playCount: -1, reactionCount: -1 })
        .limit(limit)
        .lean<IMusic[]>().exec();
    }

    const or: Record<string, unknown>[] = [];
    if (topGenres.length) or.push({ genre: { $in: topGenres } });
    if (topTags.length) or.push({ tags: { $in: topTags } });
    if (topUploaders.length) or.push({ uploadedBy: { $in: topUploaders } });

    const candidates = await Music.find({ ...PUBLIC, _id: { $nin: exclude }, $or: or })
      .sort({ playCount: -1 })
      .limit(250)
      .lean<IMusic[]>().exec();

    const genreSet = new Set(topGenres.map((g) => g.toString()));
    const tagSet = new Set(topTags);
    const uploaderSet = new Set(topUploaders.map((u) => u.toString()));
    const maxPlays = Math.max(1, ...candidates.map((c) => c.playCount));
    const now = Date.now();

    const scored = candidates.map((m) => {
      let score = 0;
      if (genreSet.has(m.genre.toString())) score += 4;
      for (const tag of m.tags) if (tagSet.has(tag)) score += 1.5;
      if (uploaderSet.has(m.uploadedBy.toString())) score += 3;
      score += 2 * (m.playCount / maxPlays);
      score += m.reactionCount * 0.05;
      const ageDays = (now - (m.publishedAt ?? m.createdAt).getTime()) / 86_400_000;
      score += Math.max(0, 2 - ageDays / 30);
      return { m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const result = scored.slice(0, limit).map((s) => s.m);

    if (result.length < limit) {
      const have = new Set([...exclude.map(String), ...result.map((r) => r._id.toString())]);
      const filler = await Music.find({
        ...PUBLIC,
        _id: { $nin: [...have].map((id) => new Types.ObjectId(id)) },
      })
        .sort({ playCount: -1 })
        .limit(limit - result.length)
        .lean<IMusic[]>().exec();
      result.push(...filler);
    }
    return result;
  },

  /** Tracks similar (genre/tag) to what the user has saved into playlists. */
  async similarToSaved(userId: Types.ObjectId, limit = 12): Promise<IMusic[]> {
    const savedItems = await PlaylistItem.find({ addedBy: userId }).select("music").lean().exec();
    const savedIds = savedItems.map((i) => i.music);
    if (savedIds.length === 0) return [];
    const saved = await Music.find({ _id: { $in: savedIds } }).select("genre tags").lean<IMusic[]>().exec();
    const genres = [...new Set(saved.map((s) => s.genre.toString()))];
    const tags = [...new Set(saved.flatMap((s) => s.tags))];
    const exclude = await excludedIds(userId);
    return Music.find({
      ...PUBLIC,
      _id: { $nin: exclude },
      $or: [{ genre: { $in: toObjectIds(genres) } }, { tags: { $in: tags } }],
    })
      .sort({ playCount: -1, _id: -1 })
      .limit(limit)
      .lean<IMusic[]>().exec();
  },

  /** Popular tracks within the user's favorite genres. */
  async basedOnGenres(userId: Types.ObjectId, limit = 12): Promise<IMusic[]> {
    const profile = await RecommendationProfile.findOne({ user: userId }).lean().exec();
    const genres = toObjectIds(topKeys(profile?.genreScores as ScoreMap, 5));
    if (genres.length === 0) return [];
    const exclude = await excludedIds(userId);
    return Music.find({ ...PUBLIC, _id: { $nin: exclude }, genre: { $in: genres } })
      .sort({ playCount: -1, _id: -1 })
      .limit(limit)
      .lean<IMusic[]>().exec();
  },

  /**
   * Collaborative signal: find users who saved the same tracks as me, then
   * surface other tracks those "similar users" saved.
   */
  async popularAmongSimilar(userId: Types.ObjectId, limit = 12): Promise<IMusic[]> {
    const myItems = await PlaylistItem.find({ addedBy: userId }).select("music").lean().exec();
    const myMusic = myItems.map((i) => i.music);
    if (myMusic.length === 0) return [];

    const peers = await PlaylistItem.distinct("addedBy", {
      music: { $in: myMusic },
      addedBy: { $ne: userId },
    });
    if (peers.length === 0) return [];

    const exclude = await excludedIds(userId);
    const agg = await PlaylistItem.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { addedBy: { $in: peers as Types.ObjectId[] }, music: { $nin: exclude } } },
      { $group: { _id: "$music", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: limit },
    ]);
    const ids = agg.map((a) => a._id);
    const docs = await Music.find({ _id: { $in: ids }, ...PUBLIC }).lean<IMusic[]>().exec();
    const map = new Map(docs.map((d) => [d._id.toString(), d]));
    return ids.map((id) => map.get(id.toString())).filter((m): m is IMusic => !!m);
  },

  /** Newly published tracks matching favorite genres/tags. */
  async newReleases(userId: Types.ObjectId, limit = 12): Promise<IMusic[]> {
    const profile = await RecommendationProfile.findOne({ user: userId }).lean().exec();
    const genres = toObjectIds(topKeys(profile?.genreScores as ScoreMap, 5));
    const tags = topKeys(profile?.tagScores as ScoreMap, 10);
    const exclude = await excludedIds(userId);
    const match: Record<string, unknown> = { ...PUBLIC, _id: { $nin: exclude } };
    if (genres.length || tags.length) {
      match.$or = [
        ...(genres.length ? [{ genre: { $in: genres } }] : []),
        ...(tags.length ? [{ tags: { $in: tags } }] : []),
      ];
    }
    return Music.find(match).sort({ publishedAt: -1, _id: -1 }).limit(limit).lean<IMusic[]>().exec();
  },

  /** Discovery: under-played tracks, biased toward the user's genres when known. */
  async newDiscovery(userId: Types.ObjectId, limit = 12): Promise<IMusic[]> {
    const profile = await RecommendationProfile.findOne({ user: userId }).lean().exec();
    const genres = toObjectIds(topKeys(profile?.genreScores as ScoreMap, 5));
    const exclude = await excludedIds(userId);
    const match: Record<string, unknown> = {
      ...PUBLIC,
      _id: { $nin: exclude },
      playCount: { $lt: 50 },
    };
    if (genres.length) match.genre = { $in: genres };
    const res = await Music.find(match).sort({ _id: -1 }).limit(limit).lean<IMusic[]>().exec();
    if (res.length >= limit) return res;
    // top up ignoring genre constraint
    const have = new Set([...exclude.map(String), ...res.map((r) => r._id.toString())]);
    const more = await Music.find({
      ...PUBLIC,
      playCount: { $lt: 50 },
      _id: { $nin: [...have].map((id) => new Types.ObjectId(id)) },
    })
      .sort({ _id: -1 })
      .limit(limit - res.length)
      .lean<IMusic[]>().exec();
    return [...res, ...more];
  },
};
