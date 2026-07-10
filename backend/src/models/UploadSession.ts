import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  UPLOAD_SESSION_STATUSES,
  VISIBILITIES,
  type UploadSessionStatus,
  type Visibility,
} from "../constants";

/**
 * Backs the step-by-step (Divar-style) upload flow. The client gets presigned
 * PUT URLs, uploads directly to object storage, and the server finalizes each
 * asset (sniffing real mime type + hashing) before publishing into a Music doc.
 */
export interface IUploadSession {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  status: UploadSessionStatus;
  step: number;
  audio?: {
    key: string;
    mimeType: string;
    size: number;
    duration: number;
    hash: string;
    finalized: boolean;
  } | null;
  cover?: {
    key: string;
    mimeType: string;
    size: number;
    finalized: boolean;
  } | null;
  metadata: {
    title?: string | null;
    artistName?: string | null;
    caption?: string | null;
    description?: string | null;
    genre?: Types.ObjectId | null;
    tags: string[];
    visibility: Visibility;
  };
  music?: Types.ObjectId | null; // set once published
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUploadSession>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: UPLOAD_SESSION_STATUSES, default: "draft", index: true },
    step: { type: Number, default: 1 },
    audio: {
      type: {
        key: String,
        mimeType: String,
        size: Number,
        duration: Number,
        hash: String,
        finalized: Boolean,
      },
      default: null,
    },
    cover: {
      type: {
        key: String,
        mimeType: String,
        size: Number,
        finalized: Boolean,
      },
      default: null,
    },
    metadata: {
      title: { type: String, default: null },
      artistName: { type: String, default: null },
      caption: { type: String, default: null },
      description: { type: String, default: null },
      genre: { type: Schema.Types.ObjectId, ref: "Genre", default: null },
      tags: { type: [String], default: [] },
      visibility: { type: String, enum: VISIBILITIES, default: "public" },
    },
    music: { type: Schema.Types.ObjectId, ref: "Music", default: null },
  },
  { timestamps: true },
);

export const UploadSession: Model<IUploadSession> =
  models.UploadSession || model<IUploadSession>("UploadSession", schema);
