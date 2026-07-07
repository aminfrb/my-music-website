import { z } from "zod";
import { Types } from "mongoose";
import {
  Playlist,
  PlaylistItem,
  PlaylistFollow,
  Music,
  User,
  type IPlaylist,
  type IPlaylistItem,
  type IMusic,
  type IUser,
} from "../models";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { interactionService } from "./interaction.service";
import { notificationService } from "./notification.service";
import { randomToken } from "../utils/text";
import {
  buildConnection,
  afterIdFilter,
  clampLimit,
  idCursor,
  type Connection,
  type PageArgs,
} from "../utils/pagination";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullish(),
  visibility: z.enum(["public", "private", "unlisted"]).optional(),
  mood: z.enum(["focus", "energy", "night", "road", "study", "calm"]).nullish(),
  isCollaborative: z.boolean().optional(),
});
const updateSchema = createSchema.partial();

function isOwner(p: IPlaylist, user: IUser): boolean {
  return p.owner.equals(user._id);
}
function isEditor(p: IPlaylist, user: IUser): boolean {
  return isOwner(p, user) || p.collaborators.some((c) => c.equals(user._id)) || user.role === "admin";
}
function canView(p: IPlaylist, viewer: IUser | null): boolean {
  if (p.visibility === "public" || p.visibility === "unlisted") return true;
  if (!viewer) return false;
  return isEditor(p, viewer);
}

async function ownedPlaylist(user: IUser, id: string): Promise<InstanceType<typeof Playlist>> {
  if (!Types.ObjectId.isValid(id)) throw errors.notFound("errors.notFound", { entity: "Playlist" });
  const p = await Playlist.findById(id);
  if (!p) throw errors.notFound("errors.notFound", { entity: "Playlist" });
  if (!isOwner(p, user) && user.role !== "admin") throw errors.forbidden("errors.notPlaylistOwner");
  return p;
}

export const playlistService = {
  create(user: IUser, input: unknown): Promise<IPlaylist> {
    const data = parse(createSchema, input);
    return Playlist.create({
      owner: user._id,
      name: data.name,
      description: data.description ?? null,
      visibility: data.visibility ?? "public",
      mood: data.mood ?? null,
      shareToken: randomToken(),
    }).then((p) => p.toObject());
  },

  async update(user: IUser, id: string, input: unknown): Promise<IPlaylist> {
    const p = await ownedPlaylist(user, id);
    const data = parse(updateSchema, input);
    if (data.name !== undefined) p.name = data.name;
    if (data.description !== undefined) p.description = data.description;
    if (data.visibility) p.visibility = data.visibility;
    if (data.mood !== undefined) p.mood = data.mood;
    await p.save();
    return p.toObject();
  },

  async remove(user: IUser, id: string): Promise<boolean> {
    const p = await ownedPlaylist(user, id);
    await PlaylistItem.deleteMany({ playlist: p._id });
    await PlaylistFollow.deleteMany({ playlist: p._id });
    await p.deleteOne();
    return true;
  },

  async addCollaborator(user: IUser, id: string, collaboratorId: string): Promise<IPlaylist> {
    const p = await ownedPlaylist(user, id);
    if (!Types.ObjectId.isValid(collaboratorId)) throw errors.badInput();
    const exists = await User.exists({ _id: collaboratorId });
    if (!exists) throw errors.notFound("errors.notFound", { entity: "User" });
    const cid = new Types.ObjectId(collaboratorId);
    if (!p.collaborators.some((c) => c.equals(cid))) p.collaborators.push(cid);
    await p.save();
    return p.toObject();
  },

  async removeCollaborator(user: IUser, id: string, collaboratorId: string): Promise<IPlaylist> {
    const p = await ownedPlaylist(user, id);
    p.collaborators = p.collaborators.filter((c) => c.toString() !== collaboratorId);
    await p.save();
    return p.toObject();
  },

  // ── Items (save / remove / reorder) ──
  async addTrack(user: IUser, playlistId: string, musicId: string): Promise<IPlaylist> {
    if (!Types.ObjectId.isValid(playlistId) || !Types.ObjectId.isValid(musicId)) throw errors.badInput();
    const p = await Playlist.findById(playlistId);
    if (!p) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    if (!isEditor(p, user)) throw errors.forbidden("errors.notPlaylistOwner");
    const music = await Music.findById(musicId).lean<IMusic>().exec();
    if (!music || music.status !== "published") throw errors.notFound("errors.musicNotFound");

    const last = await PlaylistItem.findOne({ playlist: p._id }).sort({ position: -1 }).select("position").lean().exec();
    try {
      await PlaylistItem.create({
        playlist: p._id,
        music: music._id,
        position: (last?.position ?? -1) + 1,
        addedBy: user._id,
      });
    } catch {
      throw errors.conflict("errors.trackAlreadyInPlaylist");
    }
    p.itemCount += 1;
    await p.save();
    await Music.updateOne({ _id: music._id }, { $inc: { saveCount: 1 } });
    await interactionService.record(user._id, music, "add_to_playlist");
    await notificationService.notify(
      music.uploadedBy,
      user._id,
      "music_saved",
      { name: user.displayName, title: music.title },
      { kind: "Music", id: music._id },
    );
    return p.toObject();
  },

  async removeTrack(user: IUser, playlistId: string, musicId: string): Promise<IPlaylist> {
    if (!Types.ObjectId.isValid(playlistId) || !Types.ObjectId.isValid(musicId)) throw errors.badInput();
    const p = await Playlist.findById(playlistId);
    if (!p) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    if (!isEditor(p, user)) throw errors.forbidden("errors.notPlaylistOwner");
    const res = await PlaylistItem.deleteOne({ playlist: p._id, music: musicId });
    if (res.deletedCount > 0) {
      p.itemCount = Math.max(0, p.itemCount - 1);
      await p.save();
      await Music.updateOne({ _id: musicId }, { $inc: { saveCount: -1 } });
      const music = await Music.findById(musicId).lean<IMusic>().exec();
      if (music) await interactionService.record(user._id, music, "remove_from_playlist");
    }
    return p.toObject();
  },

  async reorder(user: IUser, playlistId: string, musicIds: string[]): Promise<IPlaylist> {
    const p = await Playlist.findById(playlistId);
    if (!p) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    if (!isEditor(p, user)) throw errors.forbidden("errors.notPlaylistOwner");
    const items = await PlaylistItem.find({ playlist: p._id });
    const byMusic = new Map(items.map((i) => [i.music.toString(), i]));
    await Promise.all(
      musicIds.map((mid, index) => {
        const item = byMusic.get(mid);
        if (!item) return null;
        item.position = index;
        return item.save();
      }),
    );
    return p.toObject();
  },

  // ── Follow playlists ──
  async followPlaylist(user: IUser, id: string): Promise<IPlaylist> {
    if (!Types.ObjectId.isValid(id)) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    const p = await Playlist.findById(id);
    if (!p || (p.visibility === "private" && !isEditor(p, user))) {
      throw errors.notFound("errors.notFound", { entity: "Playlist" });
    }
    try {
      await PlaylistFollow.create({ user: user._id, playlist: p._id });
    } catch {
      throw errors.conflict("errors.alreadyFollowingPlaylist");
    }
    p.followersCount += 1;
    await p.save();
    await notificationService.notify(
      p.owner,
      user._id,
      "playlist_followed",
      { name: user.displayName, title: p.name },
      { kind: "Playlist", id: p._id },
    );
    return p.toObject();
  },

  async unfollowPlaylist(user: IUser, id: string): Promise<IPlaylist> {
    if (!Types.ObjectId.isValid(id)) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    const p = await Playlist.findById(id);
    if (!p) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    const res = await PlaylistFollow.deleteOne({ user: user._id, playlist: p._id });
    if (res.deletedCount === 0) throw errors.badInput("errors.notFollowingPlaylist");
    p.followersCount = Math.max(0, p.followersCount - 1);
    await p.save();
    return p.toObject();
  },

  // ── Reads ──
  async byId(id: string, viewer: IUser | null): Promise<IPlaylist> {
    if (!Types.ObjectId.isValid(id)) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    const p = await Playlist.findById(id).lean<IPlaylist>().exec();
    if (!p || !canView(p, viewer)) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    return p;
  },

  async byShareToken(token: string): Promise<IPlaylist> {
    const p = await Playlist.findOne({ shareToken: token }).lean<IPlaylist>().exec();
    if (!p) throw errors.notFound("errors.notFound", { entity: "Playlist" });
    return p;
  },

  async items(
    playlistId: Types.ObjectId,
  ): Promise<Array<Omit<IPlaylistItem, "music"> & { music: IMusic }>> {
    const rows = await PlaylistItem.find({ playlist: playlistId })
      .sort({ position: 1 })
      .populate<{ music: IMusic }>("music")
      .lean().exec();
    return rows as unknown as Array<Omit<IPlaylistItem, "music"> & { music: IMusic }>;
  },

  async forUser(ownerId: Types.ObjectId, viewer: IUser | null, page: PageArgs): Promise<Connection<IPlaylist>> {
    const limit = clampLimit(page.first);
    const isSelf = viewer && viewer._id.equals(ownerId);
    const base = { owner: ownerId, ...(isSelf ? {} : { visibility: "public" }) };
    const [rows, totalCount] = await Promise.all([
      Playlist.find({ ...base, ...afterIdFilter(page.after) }).sort({ _id: -1 }).limit(limit + 1).lean<IPlaylist[]>().exec(),
      Playlist.countDocuments(base),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  popular(limit = 12): Promise<IPlaylist[]> {
    return Playlist.find({ visibility: "public" })
      .sort({ followersCount: -1, itemCount: -1, _id: -1 })
      .limit(limit)
      .lean<IPlaylist[]>().exec();
  },

  async isFollowedBy(playlistId: Types.ObjectId, viewerId?: Types.ObjectId): Promise<boolean> {
    if (!viewerId) return false;
    return !!(await PlaylistFollow.exists({ user: viewerId, playlist: playlistId }));
  },
};
