import { Types } from "mongoose";
import {
  MusicInteraction,
  Music,
  RecommendationProfile,
  type IMusic,
  type IRecommendationProfile,
} from "../models";
import type { InteractionType } from "../constants";

// How strongly each interaction shapes taste.
const WEIGHTS: Record<InteractionType, number> = {
  complete_play: 3,
  add_to_playlist: 4,
  reaction: 3,
  play: 1,
  share: 2,
  skip: -1.5,
  remove_from_playlist: -2,
};

function bumpMap(map: Map<string, number>, key: string, delta: number) {
  map.set(key, (map.get(key) ?? 0) + delta);
}

function topKeys(map: Map<string, number>, k: number): string[] {
  return [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([key]) => key);
}

export const interactionService = {
  /**
   * Record a behavioral event: writes a MusicInteraction, updates denormalized
   * play counts where relevant, and incrementally refreshes the user's taste
   * profile (which powers recommendations).
   */
  async record(
    userId: Types.ObjectId,
    music: IMusic,
    type: InteractionType,
    listenDuration = 0,
  ): Promise<void> {
    await MusicInteraction.create({
      user: userId,
      music: music._id,
      type,
      listenDuration: Math.max(0, Math.floor(listenDuration)),
    });

    if (type === "play" || type === "complete_play") {
      await Music.updateOne({ _id: music._id }, { $inc: { playCount: 1 } });
    }

    await this.updateProfile(userId, music, type, listenDuration);
  },

  async updateProfile(
    userId: Types.ObjectId,
    music: IMusic,
    type: InteractionType,
    listenDuration: number,
  ): Promise<void> {
    const weight = WEIGHTS[type] ?? 0;
    const profile =
      (await RecommendationProfile.findOne({ user: userId })) ??
      new RecommendationProfile({ user: userId });

    const genreId = music.genre.toString();
    const uploaderId = music.uploadedBy.toString();

    if (type === "skip") {
      // Track aversion without letting the genre go strongly negative.
      bumpMap(profile.genreScores, genreId, weight);
      if (!profile.skippedGenres.some((g) => g.equals(music.genre))) {
        profile.skippedGenres.push(music.genre);
      }
    } else if (weight !== 0) {
      bumpMap(profile.genreScores, genreId, weight);
      bumpMap(profile.uploaderScores, uploaderId, weight);
      bumpMap(profile.artistScores, music.artistName, weight);
      for (const tag of music.tags) bumpMap(profile.tagScores, tag, weight * 0.6);
    }

    if (listenDuration > 0) {
      const prev = profile.averageListenDuration || 0;
      profile.averageListenDuration = prev === 0 ? listenDuration : Math.round((prev * 4 + listenDuration) / 5);
    }

    profile.favoriteGenres = topKeys(profile.genreScores, 5)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    profile.favoriteTags = topKeys(profile.tagScores, 10);
    profile.favoriteArtists = topKeys(profile.artistScores, 10);
    profile.favoriteUploaders = topKeys(profile.uploaderScores, 10)
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    profile.lastInteractionAt = new Date();
    await profile.save();
  },

  getProfile(userId: Types.ObjectId): Promise<IRecommendationProfile | null> {
    return RecommendationProfile.findOne({ user: userId }).lean<IRecommendationProfile>().exec();
  },
};
