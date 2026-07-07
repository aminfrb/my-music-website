import type { Context } from "../../context";
import { statsService } from "../../services/stats.service";
import { clampLimit } from "../../utils/pagination";

export const statsResolvers = {
  Query: {
    musicStats(_p: unknown, { musicId }: { musicId: string }, ctx: Context) {
      return statsService.musicStats(ctx.requireUser(), musicId);
    },
    myTopMusic(_p: unknown, { limit }: { limit?: number }, ctx: Context) {
      return statsService.topMusic(ctx.requireUser()._id, clampLimit(limit));
    },
  },
};
