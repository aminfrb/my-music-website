import type { Context } from "../../context";
import { Genre, Music, User, type IMusic, type IGenre, type ITag } from "../../models";
import { musicService } from "../../services/music.service";
import { reactionService } from "../../services/reaction.service";
import { reportService } from "../../services/report.service";
import { catalogService } from "../../services/catalog.service";
import { presignGetUrl } from "../../upload/storage";
import { idOf, mediaUrl } from "./helpers";
import type { ReactionType } from "../../constants";
import { clampLimit, type PageArgs } from "../../utils/pagination";

export const musicResolvers = {
  Query: {
    music(_p: unknown, { id }: { id: string }, ctx: Context) {
      return musicService.byId(id, ctx.user).catch(() => null);
    },
    latestMusic(_p: unknown, page: PageArgs) {
      return musicService.feedLatest(page);
    },
    trendingMusic(_p: unknown, { limit }: { limit?: number }) {
      return musicService.trending(clampLimit(limit));
    },
    todayPopularMusic(_p: unknown, { limit }: { limit?: number }) {
      return musicService.todayPopular(clampLimit(limit));
    },
    weekMostReactedMusic(_p: unknown, { limit }: { limit?: number }) {
      return musicService.weekMostReacted(clampLimit(limit));
    },
    lessDiscoveredMusic(_p: unknown, { limit }: { limit?: number }) {
      return musicService.lessDiscovered(clampLimit(limit));
    },
    genres() {
      return catalogService.genres();
    },
    genre(_p: unknown, { slug }: { slug: string }) {
      return catalogService.genreBySlug(slug);
    },
    tags(_p: unknown, { query, limit }: { query?: string | null; limit?: number }) {
      return catalogService.tags(query, limit ? clampLimit(limit) : 30);
    },
  },

  Music: {
    id: idOf,
    coverUrl: (p: IMusic) => mediaUrl(p.coverImageKey),
    streamUrl: (p: IMusic) => presignGetUrl(p.audioFileKey),
    uploader: (p: IMusic) => User.findById(p.uploadedBy).lean().exec(),
    genre: (p: IMusic) => Genre.findById(p.genre).lean().exec(),
    reactionBreakdown: (p: IMusic) =>
      Object.entries((p.reactionCounts as Record<string, number>) ?? {}).map(([type, count]) => ({
        type,
        count,
      })),
    myReaction: (p: IMusic, _a: unknown, ctx: Context) =>
      ctx.user ? reactionService.myReaction(ctx.user._id, p._id) : null,
    similar: (p: IMusic, { limit }: { limit?: number }) =>
      musicService.similar(idOf(p), clampLimit(limit)),
    moderationNote: (p: IMusic, _a: unknown, ctx: Context) => {
      const viewer = ctx.user;
      const canSee =
        viewer && (viewer._id.equals(p.uploadedBy) || viewer.role === "admin");
      return canSee ? p.moderationNote : null;
    },
  },

  Genre: {
    id: idOf,
    name: (p: IGenre, _a: unknown, ctx: Context) => (ctx.locale === "fa" ? p.nameFa : p.nameEn),
    trackCount: (p: IGenre) =>
      Music.countDocuments({ genre: p._id, status: "published", visibility: "public" }).exec(),
  },

  Tag: {
    id: idOf,
    name: (p: ITag) => p.name,
  },

  Mutation: {
    updateMusic(_p: unknown, { id, input }: { id: string; input: unknown }, ctx: Context) {
      return musicService.update(ctx.requireUser(), id, input);
    },
    deleteMusic(_p: unknown, { id }: { id: string }, ctx: Context) {
      return musicService.remove(ctx.requireUser(), id);
    },
    recordPlay(_p: unknown, { musicId, seconds }: { musicId: string; seconds?: number }, ctx: Context) {
      return musicService.recordPlay(musicId, ctx.user, seconds ?? 0);
    },
    recordInteraction(
      _p: unknown,
      { musicId, kind, seconds }: { musicId: string; kind: "skip" | "share"; seconds?: number },
      ctx: Context,
    ) {
      return musicService.recordInteraction(ctx.requireUser(), musicId, kind, seconds ?? 0);
    },
    reactToMusic(
      _p: unknown,
      { musicId, type }: { musicId: string; type: ReactionType },
      ctx: Context,
    ) {
      return reactionService.react(ctx.requireUser(), musicId, type);
    },
    unreactToMusic(_p: unknown, { musicId }: { musicId: string }, ctx: Context) {
      return reactionService.unreact(ctx.requireUser(), musicId);
    },
    reportMusic(_p: unknown, { input }: { input: unknown }, ctx: Context) {
      return reportService.report(ctx.requireUser(), input);
    },
  },
};
