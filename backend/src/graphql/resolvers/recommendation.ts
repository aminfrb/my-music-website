import type { Context } from "../../context";
import { Genre, type IRecommendationProfile } from "../../models";
import { recommendationService } from "../../services/recommendation.service";
import { interactionService } from "../../services/interaction.service";
import { clampLimit } from "../../utils/pagination";

export const recommendationResolvers = {
  Query: {
    recommendations(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      const user = ctx.requireUser();
      return recommendationService.forYou(user._id, clampLimit(limit));
    },
    async recommendationSections(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      const user = ctx.requireUser();
      const n = limit ? clampLimit(limit) : 12;
      const [forYou, similarToSaved, basedOnGenres, popularAmongSimilar, newReleases, newDiscovery] =
        await Promise.all([
          recommendationService.forYou(user._id, n),
          recommendationService.similarToSaved(user._id, n),
          recommendationService.basedOnGenres(user._id, n),
          recommendationService.popularAmongSimilar(user._id, n),
          recommendationService.newReleases(user._id, n),
          recommendationService.newDiscovery(user._id, n),
        ]);
      return { forYou, similarToSaved, basedOnGenres, popularAmongSimilar, newReleases, newDiscovery };
    },
    recommendationProfile(_p: unknown, _a: unknown, ctx: Context) {
      const user = ctx.requireUser();
      return interactionService.getProfile(user._id);
    },
  },

  RecommendationProfile: {
    favoriteGenres: (p: IRecommendationProfile) =>
      Genre.find({ _id: { $in: p.favoriteGenres } }).lean().exec(),
  },
};
