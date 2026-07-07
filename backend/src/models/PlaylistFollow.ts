import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IPlaylistFollow {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  playlist: Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<IPlaylistFollow>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    playlist: { type: Schema.Types.ObjectId, ref: "Playlist", required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ user: 1, playlist: 1 }, { unique: true });

export const PlaylistFollow: Model<IPlaylistFollow> =
  models.PlaylistFollow || model<IPlaylistFollow>("PlaylistFollow", schema);
