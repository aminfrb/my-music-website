import {
  Music,
  User,
  Playlist,
  Genre,
  Tag,
  type IMusic,
  type IUser,
  type IPlaylist,
  type IGenre,
  type ITag,
} from "../models";
import { normalizeText } from "../utils/text";

export interface SearchResult {
  music: IMusic[];
  users: IUser[];
  playlists: IPlaylist[];
  genres: IGenre[];
  tags: ITag[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Cross-entity search with Persian normalization. The query is normalized the
 * same way Music.normalized is stored, so Arabic/Persian variants match. Results
 * are returned in categorized buckets.
 */
export const searchService = {
  async search(rawQuery: string, perCategory = 10): Promise<SearchResult> {
    const q = normalizeText(rawQuery ?? "");
    if (!q) return { music: [], users: [], playlists: [], genres: [], tags: [] };
    const rx = new RegExp(escapeRegex(q), "i");

    const [music, users, playlists, genres, tags] = await Promise.all([
      Music.find({
        status: "published",
        visibility: "public",
        $or: [
          { normalized: rx },
          { artistName: rx },
          { tags: q },
        ],
      })
        .sort({ playCount: -1 })
        .limit(perCategory)
        .lean<IMusic[]>().exec(),
      User.find({ status: "active", displayName: rx }).limit(perCategory).lean<IUser[]>().exec(),
      Playlist.find({ visibility: "public", name: rx }).limit(perCategory).lean<IPlaylist[]>().exec(),
      Genre.find({ isActive: true, $or: [{ nameEn: rx }, { nameFa: rx }, { slug: rx }] })
        .limit(perCategory)
        .lean<IGenre[]>().exec(),
      Tag.find({ isBanned: false, name: rx }).sort({ usageCount: -1 }).limit(perCategory).lean<ITag[]>().exec(),
    ]);

    return { music, users, playlists, genres, tags };
  },
};
