import { Schema, model, models, type Model, type Types } from "mongoose";
import {
  PLAYLIST_VISIBILITIES,
  MOODS,
  type PlaylistVisibility,
  type Mood,
} from "../constants";

export interface IPlaylist {
  _id: Types.ObjectId;
  name: string;
  description?: string | null;
  coverImageKey?: string | null;
  owner: Types.ObjectId;
  collaborators: Types.ObjectId[]; // collaborative playlists
  visibility: PlaylistVisibility;
  mood?: Mood | null; // mood playlists (focus, energy, night, ...)
  shareToken: string; // for private/unlisted share links
  followersCount: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlaylist>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: null, maxlength: 1000 },
    coverImageKey: { type: String, default: null },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    collaborators: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    visibility: { type: String, enum: PLAYLIST_VISIBILITIES, default: "public" },
    mood: { type: String, enum: MOODS, default: null },
    shareToken: { type: String, required: true, unique: true },
    followersCount: { type: Number, default: 0 },
    itemCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Playlist: Model<IPlaylist> = models.Playlist || model<IPlaylist>("Playlist", schema);
