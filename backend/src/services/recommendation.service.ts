import { Types } from "mongoose";
import {
  Follow,
  Music,
  MusicInteraction,
  PlaylistItem,
  Reaction,
  RecommendationProfile,
  User,
  type IMusic,
  type IUser,
} from "../models";
import { t } from "../i18n";
import { normalizeText } from "../utils/text";

const PUBLIC = { status: "published", visibility: "public" } as const;

/* -------------------------------------------------------------------------- */
/*                              Scoring constants                             */
/* -------------------------------------------------------------------------- */

/**
 * Relative pull of each signal on the final ranking. Social signals are
 * deliberately the strongest single terms: on a social music platform, "someone
 * you follow loves this" is a better predictor than any content similarity.
 */
const W = {
  /** Uploader is someone you follow. */
  followedUploader: 6,
  /** Several people you follow have played/saved/reacted to this. */
  peerLoved: 5.5,
  /** Same artist as artists you keep listening to. */
  favoriteArtist: 5,
  /** Genre that people in your network favor — the "follow → their genre" rule. */
  networkGenre: 4,
  /** Genre from your own listening history. */
  favoriteGenre: 4,
  /** Uploader whose tracks you engage with, without following them. */
  favoriteUploader: 3,
  /** Uploader is followed by people you follow (second-degree). */
  networkUploader: 2.5,
  /** Per matching tag, capped below. */
  favoriteTag: 1.6,
  /** Global popularity, log-scaled so a viral track can't flatten everything. */
  popularity: 2,
  /** Reactions per play — lets a small, well-loved track compete with a big one. */
  engagement: 2.5,
  /** Freshness, decaying exponentially with age. */
  recency: 2.5,
  /** Verified artists get a small nudge. */
  verified: 0.6,
  /** Genre you demonstrably skip. */
  skippedGenre: -3.5,
  /** Already played but never engaged with — show it far less, don't hide it. */
  alreadyPlayed: -4.5,
} as const;

const TAG_MATCH_CAP = 3; // at most 3 tags contribute, so tag spam can't dominate
const RECENCY_HALF_LIFE_DAYS = 45;
const CANDIDATE_POOL = 400;
/** Max tracks by one uploader, and one genre, inside a single rendered row. */
const MAX_PER_UPLOADER = 2;
const MAX_PER_GENRE = 4;
/** Share of the main feed handed to tracks with no affinity at all. */
const EXPLORATION_RATIO = 0.2;

export type ReasonKey =
  | "followedUploader"
  | "peerLoved"
  | "favoriteArtist"
  | "networkGenre"
  | "favoriteGenre"
  | "favoriteUploader"
  | "networkUploader"
  | "favoriteTag"
  | "fresh"
  | "trending"
  | "discovery";

export interface ScoredTrack {
  music: IMusic;
  score: number;
  reasonKey: ReasonKey;
  reasonParams: Record<string, string | number>;
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

type ScoreMap = Record<string, number> | Map<string, number> | undefined;

function toMap(map: ScoreMap): Map<string, number> {
  if (!map) return new Map();
  if (map instanceof Map) return new Map(map);
  return new Map(Object.entries(map));
}

/**
 * Rescale a raw score map to 0..1 against its own maximum. Absolute weights
 * drift as a user interacts more; ratios don't, so every signal stays on the
 * same footing regardless of how long someone has used the site.
 */
function normalizeScores(map: Map<string, number>): Map<string, number> {
  let max = 0;
  for (const v of map.values()) if (v > max) max = v;
  if (max <= 0) return new Map();
  const out = new Map<string, number>();
  for (const [k, v] of map) if (v > 0) out.set(k, v / max);
  return out;
}

function topKeys(map: Map<string, number>, k: number): string[] {
  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key]) => key);
}

function toObjectIds(ids: Iterable<string>): Types.ObjectId[] {
  return [...ids].filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
}

/**
 * A heavy listener accumulates thousands of engaged tracks, and a `$nin` that
 * large stops using the index. We send the server a bounded slice and finish
 * the exclusion in memory with `dropExcluded`, which is exact and free.
 */
const EXCLUDE_QUERY_CAP = 400;

function excludeIds(ctx: { excluded: Set<string> }): Types.ObjectId[] {
  return toObjectIds([...ctx.excluded].slice(0, EXCLUDE_QUERY_CAP));
}

/** Exact exclusion pass over fetched documents. */
function dropExcluded(docs: IMusic[], ctx: { excluded: Set<string> }): IMusic[] {
  if (ctx.excluded.size <= EXCLUDE_QUERY_CAP) return docs;
  return docs.filter((m) => !ctx.excluded.has(m._id.toString()));
}

function idSet(ids: (Types.ObjectId | undefined | null)[]): Set<string> {
  const set = new Set<string>();
  for (const id of ids) if (id) set.add(id.toString());
  return set;
}

/* -------------------------------------------------------------------------- */
/*                            Recommendation context                          */
/* -------------------------------------------------------------------------- */

/**
 * Everything the ranker needs about one user, loaded once per request. The old
 * implementation rebuilt this per section, so a single "For You" page ran the
 * same profile and exclusion queries six times over.
 */
export interface RecContext {
  userId: Types.ObjectId;
  /** Taste scores, each rescaled to 0..1. */
  genres: Map<string, number>;
  tags: Map<string, number>;
  uploaders: Map<string, number>;
  /** Keyed by normalized artist name. */
  artists: Map<string, number>;
  skippedGenres: Set<string>;
  /** Users this person follows. */
  following: Set<string>;
  /** Followed by the people this person follows (second-degree network). */
  network: Set<string>;
  /** Genres favored across that network — drives the "follow → their genre" rule. */
  networkGenres: Set<string>;
  /** Listeners with overlapping taste → how strongly they overlap (0..1). */
  peers: Map<string, number>;
  /** musicId → collaborative score from peers who engaged with it. */
  peerTracks: Map<string, number>;
  /** Engaged with (saved / reacted / completed / skipped) or uploaded — never re-shown. */
  excluded: Set<string>;
  /** Merely played — heavily demoted rather than excluded, so favorites can return. */
  played: Set<string>;
  hasTaste: boolean;
}

/** Tracks the user has committed to in some way; these should not come back. */
async function loadExcluded(userId: Types.ObjectId): Promise<{ excluded: Set<string>; played: Set<string> }> {
  const [engaged, played, own] = await Promise.all([
    MusicInteraction.distinct("music", {
      user: userId,
      type: { $in: ["complete_play", "add_to_playlist", "reaction", "skip", "share"] },
    }),
    MusicInteraction.distinct("music", { user: userId, type: "play" }),
    Music.find({ uploadedBy: userId }).select("_id").lean().exec(),
  ]);
  const excluded = idSet([...(engaged as Types.ObjectId[]), ...own.map((m) => m._id)]);
  const playedSet = idSet(played as Types.ObjectId[]);
  for (const id of excluded) playedSet.delete(id);
  return { excluded, played: playedSet };
}

/**
 * Listeners whose taste overlaps this user's, found from shared reactions and
 * shared playlist saves. Overlap is normalized by the best match so "peer
 * strength" means the same thing for a user with 5 saves and one with 500.
 */
async function loadPeers(
  userId: Types.ObjectId,
  engagedIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  if (engagedIds.length === 0) return new Map();
  const counts = new Map<string, number>();

  const [byReaction, bySave] = await Promise.all([
    Reaction.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { music: { $in: engagedIds }, user: { $ne: userId } } },
      { $group: { _id: "$user", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 200 },
    ]),
    PlaylistItem.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { music: { $in: engagedIds }, addedBy: { $ne: userId } } },
      { $group: { _id: "$addedBy", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 200 },
    ]),
  ]);

  for (const r of byReaction) counts.set(r._id.toString(), (counts.get(r._id.toString()) ?? 0) + r.n * 1.5);
  for (const s of bySave) counts.set(s._id.toString(), (counts.get(s._id.toString()) ?? 0) + s.n * 2);

  return normalizeScores(counts);
}

/** What the taste-peers are into that this user hasn't heard yet. */
async function loadPeerTracks(
  peers: Map<string, number>,
  excluded: Set<string>,
): Promise<Map<string, number>> {
  const peerIds = toObjectIds(topKeys(peers, 60));
  if (peerIds.length === 0) return new Map();
  const skip = toObjectIds([...excluded].slice(0, EXCLUDE_QUERY_CAP));

  const [reacted, saved] = await Promise.all([
    Reaction.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { user: { $in: peerIds }, music: { $nin: skip } } },
      { $group: { _id: "$music", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 300 },
    ]),
    PlaylistItem.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { addedBy: { $in: peerIds }, music: { $nin: skip } } },
      { $group: { _id: "$music", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 300 },
    ]),
  ]);

  const counts = new Map<string, number>();
  for (const r of reacted) counts.set(r._id.toString(), (counts.get(r._id.toString()) ?? 0) + r.n);
  for (const s of saved) counts.set(s._id.toString(), (counts.get(s._id.toString()) ?? 0) + s.n * 1.5);
  return normalizeScores(counts);
}

/**
 * The social graph around a user, and the genres it listens to.
 *
 * This is the mechanism behind "follow someone and you'll be recommended music
 * in their genre": we take the taste profiles of everyone the user follows —
 * plus everyone whose tracks they react to — and treat those genres as a
 * first-class signal, alongside the user's own history.
 */
async function loadNetwork(
  userId: Types.ObjectId,
  likedUploaders: string[],
): Promise<{ following: Set<string>; network: Set<string>; networkGenres: Set<string> }> {
  const follows = await Follow.find({ follower: userId }).select("following").lean().exec();
  const following = idSet(follows.map((f) => f.following));

  // People the user engages with count as "connections" even without a follow —
  // reacting to someone's uploads is an endorsement of their taste too.
  const connections = new Set<string>([...following, ...likedUploaders]);
  if (connections.size === 0) {
    return { following, network: new Set(), networkGenres: new Set() };
  }
  const connectionIds = toObjectIds(connections);

  const [secondDegree, profiles, uploaded] = await Promise.all([
    Follow.find({ follower: { $in: connectionIds } }).select("following").limit(500).lean().exec(),
    RecommendationProfile.find({ user: { $in: connectionIds } })
      .select("favoriteGenres")
      .lean()
      .exec(),
    // Genres of what those people publish — covers artists who upload but
    // haven't built a listening profile yet.
    Music.find({ ...PUBLIC, uploadedBy: { $in: connectionIds } })
      .select("genre")
      .limit(300)
      .lean()
      .exec(),
  ]);

  const network = idSet(secondDegree.map((f) => f.following));
  network.delete(userId.toString());
  for (const id of connections) network.delete(id);

  const networkGenres = new Set<string>();
  for (const p of profiles) for (const g of p.favoriteGenres ?? []) networkGenres.add(g.toString());
  for (const m of uploaded) networkGenres.add(m.genre.toString());

  return { following, network, networkGenres };
}

/** Assemble the full ranking context for a user in as few round trips as possible. */
export async function buildContext(userId: Types.ObjectId): Promise<RecContext> {
  const [profile, exclusions] = await Promise.all([
    RecommendationProfile.findOne({ user: userId }).lean().exec(),
    loadExcluded(userId),
  ]);

  const genres = normalizeScores(toMap(profile?.genreScores as ScoreMap));
  const tags = normalizeScores(toMap(profile?.tagScores as ScoreMap));
  const uploaders = normalizeScores(toMap(profile?.uploaderScores as ScoreMap));
  const rawArtists = toMap(profile?.artistScores as ScoreMap);
  // Artist keys are stored as typed by the uploader; fold them for matching.
  const artists = normalizeScores(
    new Map([...rawArtists].map(([name, v]) => [normalizeText(name), v])),
  );

  // Overlap is measured against a recent slice; the whole history isn't needed
  // to establish that two people like the same things.
  const engagedIds = toObjectIds([...exclusions.excluded].slice(0, EXCLUDE_QUERY_CAP));
  const [network, peers] = await Promise.all([
    loadNetwork(userId, topKeys(uploaders, 15)),
    loadPeers(userId, engagedIds),
  ]);
  const peerTracks = await loadPeerTracks(peers, exclusions.excluded);
  for (const id of exclusions.excluded) peerTracks.delete(id);

  return {
    userId,
    genres,
    tags,
    uploaders,
    artists,
    skippedGenres: idSet(profile?.skippedGenres ?? []),
    following: network.following,
    network: network.network,
    networkGenres: network.networkGenres,
    peers,
    peerTracks,
    excluded: exclusions.excluded,
    played: exclusions.played,
    hasTaste:
      genres.size > 0 ||
      tags.size > 0 ||
      artists.size > 0 ||
      network.following.size > 0 ||
      peers.size > 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Scoring                                   */
/* -------------------------------------------------------------------------- */

/**
 * Score one candidate against a context and record *why* it scored — the
 * strongest contributing signal becomes the reason shown on the card
 * ("Because you follow Sara"), which is both a UX feature and the fastest way
 * to debug the ranker.
 */
export function scoreTrack(music: IMusic, ctx: RecContext, maxPlays: number): ScoredTrack {
  const genreId = music.genre?.toString() ?? "";
  const uploaderId = music.uploadedBy.toString();
  const artistKey = normalizeText(music.artistName ?? "");

  let score = 0;
  let reasonKey: ReasonKey = "trending";
  let reasonParams: Record<string, string | number> = {};
  let best = 0;

  /** Add a signal and remember it if it's the strongest so far. */
  const add = (value: number, key: ReasonKey, params: Record<string, string | number> = {}) => {
    if (value <= 0) return;
    score += value;
    if (value > best) {
      best = value;
      reasonKey = key;
      reasonParams = params;
    }
  };

  // --- Social ---
  if (ctx.following.has(uploaderId)) {
    add(W.followedUploader, "followedUploader", { name: music.artistName });
  } else if (ctx.network.has(uploaderId)) {
    add(W.networkUploader, "networkUploader");
  }
  const peerScore = ctx.peerTracks.get(music._id.toString()) ?? 0;
  add(peerScore * W.peerLoved, "peerLoved");

  // --- Content affinity ---
  const artistAffinity = ctx.artists.get(artistKey) ?? 0;
  add(artistAffinity * W.favoriteArtist, "favoriteArtist", { name: music.artistName });

  const genreAffinity = ctx.genres.get(genreId) ?? 0;
  add(genreAffinity * W.favoriteGenre, "favoriteGenre");

  // A genre the user's network listens to, that they haven't explored themselves.
  if (ctx.networkGenres.has(genreId) && genreAffinity < 0.5) {
    add(W.networkGenre * (1 - genreAffinity), "networkGenre");
  }

  const uploaderAffinity = ctx.uploaders.get(uploaderId) ?? 0;
  if (!ctx.following.has(uploaderId)) {
    add(uploaderAffinity * W.favoriteUploader, "favoriteUploader", { name: music.artistName });
  }

  let tagScore = 0;
  let matchedTags = 0;
  for (const tag of music.tags ?? []) {
    const v = ctx.tags.get(tag);
    if (v && matchedTags < TAG_MATCH_CAP) {
      tagScore += v * W.favoriteTag;
      matchedTags++;
    }
  }
  add(tagScore, "favoriteTag", { tag: music.tags?.[0] ?? "" });

  // --- Quality & freshness (never the headline reason unless nothing else fired) ---
  const plays = music.playCount ?? 0;
  score += (Math.log1p(plays) / Math.log1p(Math.max(maxPlays, 1))) * W.popularity;
  // Reactions per play rewards tracks people actually respond to, which a raw
  // play count doesn't — it's how a 200-play gem outranks a 5,000-play upload.
  const engagementRate = plays > 0 ? Math.min(1, (music.reactionCount ?? 0) / plays) : 0;
  score += engagementRate * W.engagement;

  const ageDays = (Date.now() - (music.publishedAt ?? music.createdAt).getTime()) / 86_400_000;
  const freshness = Math.exp(-Math.max(0, ageDays) / RECENCY_HALF_LIFE_DAYS);
  score += freshness * W.recency;

  // --- Penalties ---
  if (ctx.skippedGenres.has(genreId) && genreAffinity <= 0) score += W.skippedGenre;
  if (ctx.played.has(music._id.toString())) score += W.alreadyPlayed;

  if (best === 0) {
    // Nothing personal matched — label it by what carried it instead.
    reasonKey = ageDays < 14 ? "fresh" : plays > 0 ? "trending" : "discovery";
  }

  return { music, score, reasonKey, reasonParams };
}

/**
 * Greedy re-rank that keeps a row from filling up with one artist or one genre.
 *
 * A strict cap would leave rows short on a small catalog, so the caps are
 * relaxed in passes (1x, then 2x, then unlimited) until the row is full. The
 * best-scoring track always survives the first pass, and the row never ends up
 * shorter than an undiversified one would have been.
 */
function diversify(items: ScoredTrack[], limit: number): ScoredTrack[] {
  const picked: ScoredTrack[] = [];
  const taken = new Set<string>();
  const perUploader = new Map<string, number>();
  const perGenre = new Map<string, number>();

  for (const relax of [1, 2, Infinity]) {
    if (picked.length >= limit) break;
    const uploaderCap = MAX_PER_UPLOADER * relax;
    const genreCap = MAX_PER_GENRE * relax;

    for (const item of items) {
      if (picked.length >= limit) break;
      const id = item.music._id.toString();
      if (taken.has(id)) continue;
      const u = item.music.uploadedBy.toString();
      const g = item.music.genre?.toString() ?? "";
      if ((perUploader.get(u) ?? 0) >= uploaderCap || (perGenre.get(g) ?? 0) >= genreCap) continue;
      perUploader.set(u, (perUploader.get(u) ?? 0) + 1);
      perGenre.set(g, (perGenre.get(g) ?? 0) + 1);
      taken.add(id);
      picked.push(item);
    }
  }
  return picked;
}

/** Candidate fetch: everything plausibly relevant, ranked cheaply by the DB. */
async function loadCandidates(ctx: RecContext, extra: Record<string, unknown> = {}): Promise<IMusic[]> {
  const skip = excludeIds(ctx);
  const or: Record<string, unknown>[] = [];

  const genreIds = toObjectIds([...ctx.genres.keys(), ...ctx.networkGenres]);
  if (genreIds.length) or.push({ genre: { $in: genreIds } });
  const tagNames = topKeys(ctx.tags, 12);
  if (tagNames.length) or.push({ tags: { $in: tagNames } });
  const uploaderIds = toObjectIds([...ctx.uploaders.keys(), ...ctx.following, ...ctx.network]);
  if (uploaderIds.length) or.push({ uploadedBy: { $in: uploaderIds } });
  const peerTrackIds = toObjectIds(topKeys(ctx.peerTracks, 120));
  if (peerTrackIds.length) or.push({ _id: { $in: peerTrackIds } });
  const artistNames = topKeys(ctx.artists, 15);
  if (artistNames.length) or.push({ artistKey: { $in: artistNames } });

  const filter: Record<string, unknown> = { ...PUBLIC, ...extra, _id: { $nin: skip } };
  if (or.length) filter.$or = or;

  return Music.find(filter)
    .sort({ publishedAt: -1, playCount: -1 })
    .limit(CANDIDATE_POOL)
    .lean<IMusic[]>()
    .exec();
}

/** Rank a candidate list and take the best `limit`, kept diverse. */
function rank(candidates: IMusic[], ctx: RecContext, limit: number): ScoredTrack[] {
  const pool = dropExcluded(candidates, ctx);
  const maxPlays = Math.max(1, ...pool.map((c) => c.playCount ?? 0));
  const scored = pool.map((m) => scoreTrack(m, ctx, maxPlays));
  scored.sort((a, b) => b.score - a.score);
  return diversify(scored, limit);
}

/** Backfill a short row with popular tracks the user hasn't seen. */
async function topUp(
  rows: ScoredTrack[],
  ctx: RecContext,
  limit: number,
  reasonKey: ReasonKey = "trending",
): Promise<ScoredTrack[]> {
  if (rows.length >= limit) return rows;
  const have = new Set(rows.map((r) => r.music._id.toString()));
  const skip = toObjectIds([...new Set([...have, ...ctx.excluded])].slice(0, EXCLUDE_QUERY_CAP));
  const filler = await Music.find({ ...PUBLIC, _id: { $nin: skip } })
    .sort({ playCount: -1, publishedAt: -1 })
    .limit(limit - rows.length + 10)
    .lean<IMusic[]>()
    .exec();
  const usable = dropExcluded(filler, ctx)
    .filter((m) => !have.has(m._id.toString()))
    .slice(0, limit - rows.length);
  return [...rows, ...usable.map((m) => ({ music: m, score: 0, reasonKey, reasonParams: {} }))];
}

/** Localized, human-readable explanation for why a track was recommended. */
export function reasonText(item: ScoredTrack): string {
  return t(`rec.reason.${item.reasonKey}`, item.reasonParams);
}

/* -------------------------------------------------------------------------- */
/*                                Public API                                  */
/* -------------------------------------------------------------------------- */

export const recommendationService = {
  buildContext,

  /**
   * The main personalized ranking, with a slice reserved for exploration so the
   * feed can't collapse into a single genre the user happened to click once.
   */
  async forYouScored(ctx: RecContext, limit = 20): Promise<ScoredTrack[]> {
    if (!ctx.hasTaste) {
      const trending = await Music.find({ ...PUBLIC, _id: { $nin: excludeIds(ctx) } })
        .sort({ playCount: -1, reactionCount: -1 })
        .limit(limit + 10)
        .lean<IMusic[]>()
        .exec();
      return dropExcluded(trending, ctx)
        .slice(0, limit)
        .map((m) => ({ music: m, score: 0, reasonKey: "trending" as const, reasonParams: {} }));
    }

    const candidates = await loadCandidates(ctx);
    const exploreSlots = Math.max(1, Math.round(limit * EXPLORATION_RATIO));
    const ranked = rank(candidates, ctx, limit);

    // Exploration slots go to well-liked tracks from outside the profile, so
    // taste can widen instead of narrowing with every interaction.
    const chosen = new Set(ranked.map((r) => r.music._id.toString()));
    const outsideRaw = await Music.find({
      ...PUBLIC,
      _id: { $nin: toObjectIds([...new Set([...chosen, ...ctx.excluded])].slice(0, EXCLUDE_QUERY_CAP)) },
      genre: { $nin: toObjectIds(ctx.genres.keys()) },
    })
      .sort({ reactionCount: -1, playCount: -1 })
      .limit(exploreSlots + 10)
      .lean<IMusic[]>()
      .exec();
    const outside = dropExcluded(outsideRaw, ctx)
      .filter((m) => !chosen.has(m._id.toString()))
      .slice(0, exploreSlots);

    const merged = [
      ...ranked.slice(0, Math.max(0, limit - outside.length)),
      ...outside.map((m) => ({
        music: m,
        score: 0,
        reasonKey: "discovery" as const,
        reasonParams: {},
      })),
    ];
    return topUp(merged, ctx, limit);
  },

  async forYou(userId: Types.ObjectId, limit = 20): Promise<IMusic[]> {
    const ctx = await buildContext(userId);
    return (await this.forYouScored(ctx, limit)).map((s) => s.music);
  },

  /**
   * Tracks the people you follow have reacted to or saved — their taste, not
   * their uploads (that's `followingFeed`). This is what makes following
   * someone immediately change what you're shown.
   */
  async becauseYouFollow(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const followingIds = toObjectIds(ctx.following);
    if (followingIds.length === 0) return [];
    const skip = excludeIds(ctx);

    const [reacted, saved] = await Promise.all([
      Reaction.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { user: { $in: followingIds }, music: { $nin: skip } } },
        { $group: { _id: "$music", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 120 },
      ]),
      PlaylistItem.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { addedBy: { $in: followingIds }, music: { $nin: skip } } },
        { $group: { _id: "$music", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 120 },
      ]),
    ]);

    const weights = new Map<string, number>();
    for (const r of reacted) weights.set(r._id.toString(), (weights.get(r._id.toString()) ?? 0) + r.n);
    for (const s of saved) weights.set(s._id.toString(), (weights.get(s._id.toString()) ?? 0) + s.n * 1.5);
    if (weights.size === 0) return [];

    const found = await Music.find({ ...PUBLIC, _id: { $in: toObjectIds(weights.keys()) } })
      .lean<IMusic[]>()
      .exec();
    const docs = dropExcluded(found, ctx);
    docs.sort(
      (a, b) => (weights.get(b._id.toString()) ?? 0) - (weights.get(a._id.toString()) ?? 0),
    );
    return diversify(
      docs.map((m) => ({ music: m, score: 0, reasonKey: "peerLoved" as const, reasonParams: {} })),
      limit,
    ).map((s) => s.music);
  },

  /**
   * Music in the genres this user's network listens to — the direct answer to
   * "I followed a rap artist, show me rap".
   */
  async genresFromYourNetwork(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const genreIds = toObjectIds(ctx.networkGenres);
    if (genreIds.length === 0) return [];
    const candidates = await Music.find({
      ...PUBLIC,
      _id: { $nin: excludeIds(ctx) },
      genre: { $in: genreIds },
    })
      .sort({ playCount: -1, publishedAt: -1 })
      .limit(200)
      .lean<IMusic[]>()
      .exec();
    return rank(candidates, ctx, limit).map((s) => s.music);
  },

  /** More from the artists this user keeps coming back to. */
  async fromArtistsYouLike(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const names = topKeys(ctx.artists, 12);
    if (names.length === 0) return [];
    const candidates = await Music.find({
      ...PUBLIC,
      _id: { $nin: excludeIds(ctx) },
      artistKey: { $in: names },
    })
      .sort({ playCount: -1 })
      .limit(200)
      .lean<IMusic[]>()
      .exec();
    return rank(candidates, ctx, limit).map((s) => s.music);
  },

  /** Tracks similar (genre/tag) to what the user has saved into playlists. */
  async similarToSaved(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const savedItems = await PlaylistItem.find({ addedBy: ctx.userId }).select("music").lean().exec();
    if (savedItems.length === 0) return [];
    const saved = await Music.find({ _id: { $in: savedItems.map((i) => i.music) } })
      .select("genre tags")
      .lean<IMusic[]>()
      .exec();
    const genres = toObjectIds(new Set(saved.map((s) => s.genre.toString())));
    const tags = [...new Set(saved.flatMap((s) => s.tags ?? []))].slice(0, 20);
    if (genres.length === 0 && tags.length === 0) return [];

    const candidates = await Music.find({
      ...PUBLIC,
      _id: { $nin: excludeIds(ctx) },
      $or: [
        ...(genres.length ? [{ genre: { $in: genres } }] : []),
        ...(tags.length ? [{ tags: { $in: tags } }] : []),
      ],
    })
      .sort({ playCount: -1 })
      .limit(200)
      .lean<IMusic[]>()
      .exec();
    return rank(candidates, ctx, limit).map((s) => s.music);
  },

  /** Popular tracks within the user's own favorite genres. */
  async basedOnGenres(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const genres = toObjectIds(topKeys(ctx.genres, 5));
    if (genres.length === 0) return [];
    const candidates = await Music.find({
      ...PUBLIC,
      _id: { $nin: excludeIds(ctx) },
      genre: { $in: genres },
    })
      .sort({ playCount: -1, _id: -1 })
      .limit(200)
      .lean<IMusic[]>()
      .exec();
    return rank(candidates, ctx, limit).map((s) => s.music);
  },

  /** Collaborative filtering: what listeners with your taste are playing. */
  async popularAmongSimilar(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const ids = toObjectIds(topKeys(ctx.peerTracks, limit * 4));
    if (ids.length === 0) return [];
    const docs = dropExcluded(
      await Music.find({ _id: { $in: ids }, ...PUBLIC }).lean<IMusic[]>().exec(),
      ctx,
    );
    docs.sort(
      (a, b) =>
        (ctx.peerTracks.get(b._id.toString()) ?? 0) - (ctx.peerTracks.get(a._id.toString()) ?? 0),
    );
    return diversify(
      docs.map((m) => ({ music: m, score: 0, reasonKey: "peerLoved" as const, reasonParams: {} })),
      limit,
    ).map((s) => s.music);
  },

  /** Newly published tracks matching the user's (or their network's) taste. */
  async newReleases(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const genres = toObjectIds(new Set([...topKeys(ctx.genres, 5), ...ctx.networkGenres]));
    const tags = topKeys(ctx.tags, 10);
    const match: Record<string, unknown> = { ...PUBLIC, _id: { $nin: excludeIds(ctx) } };
    if (genres.length || tags.length) {
      match.$or = [
        ...(genres.length ? [{ genre: { $in: genres } }] : []),
        ...(tags.length ? [{ tags: { $in: tags } }] : []),
      ];
    }
    const docs = dropExcluded(
      await Music.find(match)
        .sort({ publishedAt: -1, _id: -1 })
        .limit(limit * 3)
        .lean<IMusic[]>()
        .exec(),
      ctx,
    );
    return diversify(
      docs.map((m) => ({ music: m, score: 0, reasonKey: "fresh" as const, reasonParams: {} })),
      limit,
    ).map((s) => s.music);
  },

  /** Under-played tracks, biased toward the user's genres when known. */
  async newDiscovery(ctx: RecContext, limit = 12): Promise<IMusic[]> {
    const genres = toObjectIds(topKeys(ctx.genres, 5));
    const base: Record<string, unknown> = {
      ...PUBLIC,
      _id: { $nin: excludeIds(ctx) },
      playCount: { $lt: 50 },
    };
    let docs = dropExcluded(
      await Music.find(genres.length ? { ...base, genre: { $in: genres } } : base)
        .sort({ _id: -1 })
        .limit(limit * 3)
        .lean<IMusic[]>()
        .exec(),
      ctx,
    );

    if (docs.length < limit) {
      const have = new Set(docs.map((d) => d._id.toString()));
      const more = await Music.find({
        ...PUBLIC,
        playCount: { $lt: 50 },
        _id: { $nin: toObjectIds([...new Set([...have, ...ctx.excluded])].slice(0, EXCLUDE_QUERY_CAP)) },
      })
        .sort({ _id: -1 })
        .limit(limit - docs.length + 10)
        .lean<IMusic[]>()
        .exec();
      docs = [...docs, ...dropExcluded(more, ctx).filter((m) => !have.has(m._id.toString()))];
    }
    return diversify(
      docs.map((m) => ({ music: m, score: 0, reasonKey: "discovery" as const, reasonParams: {} })),
      limit,
    ).map((s) => s.music);
  },

  /**
   * People worth following, ranked by how much of this user's taste they share.
   * Recommending *listeners*, not just tracks, is what makes the social signals
   * above get stronger over time.
   */
  async suggestedUsers(
    ctx: RecContext,
    limit = 8,
  ): Promise<{ user: IUser; reasonKey: string; mutualCount: number; sharedGenres: Types.ObjectId[] }[]> {
    const exclude = new Set<string>([...ctx.following, ctx.userId.toString()]);

    const scores = new Map<string, { score: number; reasonKey: string; mutual: number }>();
    const bump = (id: string, value: number, reasonKey: string, mutual = 0) => {
      if (exclude.has(id)) return;
      const prev = scores.get(id);
      if (!prev || value > prev.score) {
        scores.set(id, { score: value, reasonKey, mutual: Math.max(mutual, prev?.mutual ?? 0) });
      } else {
        prev.score += value * 0.3;
        prev.mutual = Math.max(prev.mutual, mutual);
      }
    };

    // 1. Taste twins.
    for (const [id, overlap] of ctx.peers) bump(id, 4 * overlap, "sharedTaste");
    // 2. Uploaders whose music the user reacts to but doesn't follow.
    for (const [id, affinity] of ctx.uploaders) bump(id, 5 * affinity, "youLikeTheirMusic");
    // 3. Followed by the people this user follows.
    if (ctx.following.size > 0) {
      const mutuals = await Follow.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { follower: { $in: toObjectIds(ctx.following) } } },
        { $group: { _id: "$following", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 60 },
      ]);
      const maxMutual = Math.max(1, ...mutuals.map((m) => m.n));
      for (const m of mutuals) {
        bump(m._id.toString(), 3.5 * (m.n / maxMutual), "followedByYourNetwork", m.n);
      }
    }

    if (scores.size === 0) return [];

    const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit * 2);
    const users = await User.find({
      _id: { $in: toObjectIds(ranked.map(([id]) => id)) },
      status: "active",
    })
      .lean<IUser[]>()
      .exec();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));

    const myGenres = new Set(topKeys(ctx.genres, 8));
    const profiles = await RecommendationProfile.find({ user: { $in: users.map((u) => u._id) } })
      .select("user favoriteGenres")
      .lean()
      .exec();
    const genresByUser = new Map(
      profiles.map((p) => [p.user.toString(), (p.favoriteGenres ?? []).map((g) => g.toString())]),
    );

    const out: { user: IUser; reasonKey: string; mutualCount: number; sharedGenres: Types.ObjectId[] }[] = [];
    for (const [id, meta] of ranked) {
      const user = byId.get(id);
      if (!user) continue;
      const shared = (genresByUser.get(id) ?? []).filter((g) => myGenres.has(g));
      out.push({
        user,
        reasonKey: meta.reasonKey,
        mutualCount: meta.mutual,
        sharedGenres: toObjectIds(shared),
      });
      if (out.length >= limit) break;
    }
    return out;
  },
};
