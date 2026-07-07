import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IPlaylistItem {
  _id: Types.ObjectId;
  playlist: Types.ObjectId;
  music: Types.ObjectId;
  position: number;
  addedBy: Types.ObjectId; // supports collaborative playlists
  addedAt: Date;
}

const schema = new Schema<IPlaylistItem>(
  {
    playlist: { type: Schema.Types.ObjectId, ref: "Playlist", required: true },
    music: { type: Schema.Types.ObjectId, ref: "Music", required: true },
    position: { type: Number, required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ playlist: 1, music: 1 }, { unique: true });
schema.index({ playlist: 1, position: 1 });

export const PlaylistItem: Model<IPlaylistItem> =
  models.PlaylistItem || model<IPlaylistItem>("PlaylistItem", schema);
