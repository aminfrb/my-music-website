import { Types } from "mongoose";
import type { Context } from "../../context";
import { User, type IPlaylist, type IPlaylistItem } from "../../models";
import { playlistService } from "../../services/playlist.service";
import { idOf, mediaUrl } from "./helpers";
import { clampLimit, type PageArgs } from "../../utils/pagination";

function toId(id: string): Types.ObjectId {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : new Types.ObjectId();
}

export const playlistResolvers = {
  Query: {
    playlist(_p: unknown, { id }: { id: string }, ctx: Context) {
      return playlistService.byId(id, ctx.user).catch(() => null);
    },
    playlistByShareToken(_p: unknown, { token }: { token: string }) {
      return playlistService.byShareToken(token).catch(() => null);
    },
    userPlaylists(_p: unknown, { userId, ...page }: { userId: string } & PageArgs, ctx: Context) {
      return playlistService.forUser(toId(userId), ctx.user, page);
    },
    myPlaylists(_p: unknown, page: PageArgs, ctx: Context) {
      const user = ctx.requireUser();
      return playlistService.forUser(user._id, user, page);
    },
    popularPlaylists(_p: unknown, { limit }: { limit?: number }) {
      return playlistService.popular(clampLimit(limit));
    },
  },

  Playlist: {
    id: idOf,
    coverUrl: (p: IPlaylist) => mediaUrl(p.coverImageKey),
    owner: (p: IPlaylist) => User.findById(p.owner).lean().exec(),
    collaborators: (p: IPlaylist) => User.find({ _id: { $in: p.collaborators } }).lean().exec(),
    trackCount: (p: IPlaylist) => p.itemCount,
    items: (p: IPlaylist) => playlistService.items(p._id),
    isFollowedByMe: (p: IPlaylist, _a: unknown, ctx: Context) =>
      playlistService.isFollowedBy(p._id, ctx.user?._id),
  },

  PlaylistItem: {
    id: idOf,
    addedBy: (p: IPlaylistItem) => User.findById(p.addedBy).lean().exec(),
  },

  Mutation: {
    createPlaylist(_p: unknown, { input }: { input: unknown }, ctx: Context) {
      return playlistService.create(ctx.requireUser(), input);
    },
    updatePlaylist(_p: unknown, { id, input }: { id: string; input: unknown }, ctx: Context) {
      return playlistService.update(ctx.requireUser(), id, input);
    },
    deletePlaylist(_p: unknown, { id }: { id: string }, ctx: Context) {
      return playlistService.remove(ctx.requireUser(), id);
    },
    addMusicToPlaylist(
      _p: unknown,
      { playlistId, musicId }: { playlistId: string; musicId: string },
      ctx: Context,
    ) {
      return playlistService.addTrack(ctx.requireUser(), playlistId, musicId);
    },
    removeMusicFromPlaylist(
      _p: unknown,
      { playlistId, musicId }: { playlistId: string; musicId: string },
      ctx: Context,
    ) {
      return playlistService.removeTrack(ctx.requireUser(), playlistId, musicId);
    },
    reorderPlaylist(
      _p: unknown,
      { playlistId, musicIds }: { playlistId: string; musicIds: string[] },
      ctx: Context,
    ) {
      return playlistService.reorder(ctx.requireUser(), playlistId, musicIds);
    },
    addPlaylistCollaborator(
      _p: unknown,
      { playlistId, userId }: { playlistId: string; userId: string },
      ctx: Context,
    ) {
      return playlistService.addCollaborator(ctx.requireUser(), playlistId, userId);
    },
    removePlaylistCollaborator(
      _p: unknown,
      { playlistId, userId }: { playlistId: string; userId: string },
      ctx: Context,
    ) {
      return playlistService.removeCollaborator(ctx.requireUser(), playlistId, userId);
    },
    followPlaylist(_p: unknown, { playlistId }: { playlistId: string }, ctx: Context) {
      return playlistService.followPlaylist(ctx.requireUser(), playlistId);
    },
    unfollowPlaylist(_p: unknown, { playlistId }: { playlistId: string }, ctx: Context) {
      return playlistService.unfollowPlaylist(ctx.requireUser(), playlistId);
    },
  },
};
