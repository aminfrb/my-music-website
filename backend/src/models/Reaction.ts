import { Schema, model, models, type Model, type Types } from "mongoose";
import { REACTION_TYPES, type ReactionType } from "../constants";

export interface IReaction {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  music: Types.ObjectId;
  type: ReactionType;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IReaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    music: { type: Schema.Types.ObjectId, ref: "Music", required: true, index: true },
    type: { type: String, enum: REACTION_TYPES, required: true },
  },
  { timestamps: true },
);

// One active reaction per user per track (changing reaction updates this doc).
schema.index({ user: 1, music: 1 }, { unique: true });

export const Reaction: Model<IReaction> = models.Reaction || model<IReaction>("Reaction", schema);
