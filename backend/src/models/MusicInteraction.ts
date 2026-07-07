import { Schema, model, models, type Model, type Types } from "mongoose";
import { INTERACTION_TYPES, type InteractionType } from "../constants";

export interface IMusicInteraction {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  music: Types.ObjectId;
  type: InteractionType;
  listenDuration: number; // seconds actually listened (for play/complete_play/skip)
  createdAt: Date;
}

const schema = new Schema<IMusicInteraction>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    music: { type: Schema.Types.ObjectId, ref: "Music", required: true },
    type: { type: String, enum: INTERACTION_TYPES, required: true },
    listenDuration: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ user: 1, createdAt: -1 });
schema.index({ music: 1, type: 1, createdAt: -1 });

export const MusicInteraction: Model<IMusicInteraction> =
  models.MusicInteraction || model<IMusicInteraction>("MusicInteraction", schema);
