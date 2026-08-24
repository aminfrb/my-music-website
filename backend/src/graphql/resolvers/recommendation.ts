import type { Types } from "mongoose";
import type { Context } from "../../context";
import { Genre, type IMusic, type IUser, type IRecommendationProfile } from "../../models";
import {
  recommendationService,
  reasonText,
  type RecContext,
  type ScoredTrack,
} from "../../services/recommendation.service";
import { interactionService } from "../../services/interaction.service";
import { t } from "../../i18n";
import { clampLimit } from "../../utils/pagination";

interface SuggestedUserRow {
  user: IUser;
  reasonKey: string;
  mutualCount: number;
  sharedGenres: Types.ObjectId[];
}

/** Every section for one user, ranked from a single shared context. */
async function allSections(ctx: RecContext, n: number) {
  const [
    forYou,
    similarToSaved,
    basedOnGenres,
    popularAmongSimilar,
    newReleases,
    newDiscovery,
    becauseYouFollow,
    genresFromYourNetwork,
    fromArtistsYouLike,
    suggestedUsers,
  ] = await Promise.all([
    recommendationService.forYouScored(ctx, n),
    recommendationService.similarToSaved(ctx, n),
    recommendationService.basedOnGenres(ctx, n),
    recommendationService.popularAmongSimilar(ctx, n),
    recommendationService.newReleases(ctx, n),
    recommendationService.newDiscovery(ctx, n),
    recommendationService.becauseYouFollow(ctx, n),
    recommendationService.genresFromYourNetwork(ctx, n),
    recommendationService.fromArtistsYouLike(ctx, n),
    recommendationService.suggestedUsers(ctx, 8),
  ]);

  return {
    forYou: forYou.map((s: ScoredTrack) => s.music),
    similarToSaved,
    basedOnGenres,
    popularAmongSimilar,
    newReleases,
    newDiscovery,
    becauseYouFollow,
    genresFromYourNetwork,
    fromArtistsYouLike,
    suggestedUsers,
  };
}

export const recommendationResolvers = {
  Query: {
    async recommendations(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      const user = ctx.requireUser();
      const rc = await recommendationService.buildContext(user._id);
      const rows = await recommendationService.forYouScored(rc, clampLimit(limit));
      return rows.map((r) => r.music);
    },

    async recommendationFeed(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      const user = ctx.requireUser();
      const rc = await recommendationService.buildContext(user._id);
      return recommendationService.forYouScored(rc, clampLimit(limit));
    },

    async recommendationSections(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      const user = ctx.requireUser();
      const rc = await recommendationService.buildContext(user._id);
      return allSections(rc, limit ? clampLimit(limit) : 12);
    },

    async suggestedUsers(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      const user = ctx.requireUser();
      const rc = await recommendationService.buildContext(user._id);
      return recommendationService.suggestedUsers(rc, limit ? clampLimit(limit) : 8);
    },

    recommendationProfile(_p: unknown, _a: unknown, ctx: Context) {
      const user = ctx.requireUser();
      return interactionService.getProfile(user._id);
    },
  },

  RecommendedTrack: {
    music: (p: ScoredTrack): IMusic => p.music,
    reason: (p: ScoredTrack) => reasonText(p),
    score: (p: ScoredTrack) => Math.round(p.score * 100) / 100,
  },

  SuggestedUser: {
    reason: (p: SuggestedUserRow) => t(`rec.follow.${p.reasonKey}`, { count: p.mutualCount }),
    sharedGenres: (p: SuggestedUserRow) =>
      p.sharedGenres.length ? Genre.find({ _id: { $in: p.sharedGenres } }).lean().exec() : [],
  },

  RecommendationProfile: {
    favoriteGenres: (p: IRecommendationProfile) =>
      Genre.find({ _id: { $in: p.favoriteGenres } }).lean().exec(),
  },
};
