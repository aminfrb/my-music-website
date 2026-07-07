import { Schema, model, models, type Model, type Types } from "mongoose";
import { type Mood } from "../constants";

/**
 * Per-user taste profile, rebuilt from MusicInteraction history. Scores are kept
 * as maps (id/name → weight) so ranking is cheap; the array fields expose the
 * top entries for display and simple queries.
 */
export interface IRecommendationProfile {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  genreScores: Map<string, number>; // genreId → score
  tagScores: Map<string, number>; // tag → score
  uploaderScores: Map<string, number>; // uploaderId → score
  artistScores: Map<string, number>; // artistName → score
  favoriteGenres: Types.ObjectId[];
  favoriteTags: string[];
  favoriteArtists: string[];
  favoriteUploaders: Types.ObjectId[];
  skippedGenres: Types.ObjectId[];
  averageListenDuration: number;
  preferredMood?: Mood | null;
  lastInteractionAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

const schema = new Schema<IRecommendationProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    genreScores: { type: Map, of: Number, default: {} },
    tagScores: { type: Map, of: Number, default: {} },
    uploaderScores: { type: Map, of: Number, default: {} },
    artistScores: { type: Map, of: Number, default: {} },
    favoriteGenres: { type: [Schema.Types.ObjectId], ref: "Genre", default: [] },
    favoriteTags: { type: [String], default: [] },
    favoriteArtists: { type: [String], default: [] },
    favoriteUploaders: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    skippedGenres: { type: [Schema.Types.ObjectId], ref: "Genre", default: [] },
    averageListenDuration: { type: Number, default: 0 },
    preferredMood: { type: String, default: null },
    lastInteractionAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const RecommendationProfile: Model<IRecommendationProfile> =
  models.RecommendationProfile ||
  model<IRecommendationProfile>("RecommendationProfile", schema);
