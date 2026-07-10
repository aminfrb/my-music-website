import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  MUSIC_STATUSES,
  VISIBILITIES,
  type MusicStatus,
  type Visibility,
} from "../constants";

export interface IMusic {
  _id: Types.ObjectId;
  title: string;
  artistName: string;
  caption?: string | null;
  description?: string | null;
  genre: Types.ObjectId;
  tags: string[];
  coverImageKey?: string | null;
  audioFileKey: string;
  duration: number; // seconds
  fileSize: number; // bytes
  mimeType: string;
  fileHash: string; // sha256, for dedup
  uploadedBy: Types.ObjectId;
  status: MusicStatus;
  visibility: Visibility;
  playCount: number;
  saveCount: number;
  reactionCount: number;
  reactionCounts: Record<string, number>; // per-emoji breakdown
  // Normalized text (Persian-folded) used by search.
  normalized: string;
  moderationNote?: string | null;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMusic>(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    artistName: { type: String, required: true, trim: true, maxlength: 120 },
    caption: { type: String, default: null, trim: true, maxlength: 280 },
    description: { type: String, default: null, maxlength: 2000 },
    genre: { type: Schema.Types.ObjectId, ref: "Genre", required: true, index: true },
    tags: { type: [String], default: [], index: true },
    coverImageKey: { type: String, default: null },
    audioFileKey: { type: String, required: true },
    duration: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, required: true },
    fileHash: { type: String, required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: MUSIC_STATUSES, default: "pending", index: true },
    visibility: { type: String, enum: VISIBILITIES, default: "public" },
    playCount: { type: Number, default: 0, index: true },
    saveCount: { type: Number, default: 0 },
    reactionCount: { type: Number, default: 0 },
    reactionCounts: { type: Schema.Types.Mixed, default: {} },
    normalized: { type: String, default: "" },
    moderationNote: { type: String, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Duplicate detection is scoped per uploader (same person can't post the same file twice).
schema.index({ uploadedBy: 1, fileHash: 1 }, { unique: true });
schema.index({ status: 1, visibility: 1, publishedAt: -1 });
schema.index({ normalized: "text" });

export const Music: Model<IMusic> = models.Music || model<IMusic>("Music", schema);
