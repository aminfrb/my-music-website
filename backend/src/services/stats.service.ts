import { Types } from "mongoose";
import { Music, MusicInteraction, type IMusic, type IUser } from "../models";
import { errors } from "../utils/errors";

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  count: number;
}
export interface MusicStats {
  music: IMusic;
  playCount: number;
  saveCount: number;
  reactionCount: number;
  mostReaction: string | null;
  completeRate: number; // 0..1
  dailyPlays: DailyPoint[];
}

function mostReactionOf(counts: Record<string, number> | undefined): string | null {
  if (!counts) return null;
  let best: string | null = null;
  let bestN = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

export const statsService = {
  async musicStats(user: IUser, musicId: string): Promise<MusicStats> {
    if (!Types.ObjectId.isValid(musicId)) throw errors.notFound("errors.musicNotFound");
    const music = await Music.findById(musicId).lean<IMusic>().exec();
    if (!music) throw errors.notFound("errors.musicNotFound");
    if (!music.uploadedBy.equals(user._id) && user.role !== "admin") {
      throw errors.forbidden("errors.notOwner");
    }

    const since = new Date(Date.now() - 30 * 86_400_000);
    const [counts, daily] = await Promise.all([
      MusicInteraction.aggregate<{ _id: string; n: number }>([
        { $match: { music: music._id, type: { $in: ["play", "complete_play"] } } },
        { $group: { _id: "$type", n: { $sum: 1 } } },
      ]),
      MusicInteraction.aggregate<{ _id: string; n: number }>([
        {
          $match: {
            music: music._id,
            type: { $in: ["play", "complete_play"] },
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            n: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const plays = counts.find((c) => c._id === "play")?.n ?? 0;
    const completes = counts.find((c) => c._id === "complete_play")?.n ?? 0;
    const total = plays + completes;

    return {
      music,
      playCount: music.playCount,
      saveCount: music.saveCount,
      reactionCount: music.reactionCount,
      mostReaction: mostReactionOf(music.reactionCounts as Record<string, number>),
      completeRate: total > 0 ? completes / total : 0,
      dailyPlays: daily.map((d) => ({ date: d._id, count: d.n })),
    };
  },

  /** A user's own most popular tracks. */
  topMusic(userId: Types.ObjectId, limit = 10): Promise<IMusic[]> {
    return Music.find({ uploadedBy: userId })
      .sort({ playCount: -1 })
      .limit(limit)
      .lean<IMusic[]>().exec();
  },
};
