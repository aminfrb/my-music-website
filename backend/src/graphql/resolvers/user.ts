import type { Context } from "../../context";
import type { IUser } from "../../models";
import { userService } from "../../services/user.service";
import { followService } from "../../services/follow.service";
import { musicService } from "../../services/music.service";
import { playlistService } from "../../services/playlist.service";
import { idOf, mediaUrl } from "./helpers";
import type { PageArgs } from "../../utils/pagination";

function selfOrAdmin(parent: IUser, ctx: Context): boolean {
  return !!ctx.user && (ctx.user._id.equals(parent._id) || ctx.user.role === "admin");
}

export const userResolvers = {
  Query: {
    me(_p: unknown, _a: unknown, ctx: Context) {
      return ctx.user;
    },
    user(_p: unknown, { id }: { id?: string | null }, ctx: Context) {
      return id ? userService.byId(id) : ctx.user;
    },
    users(_p: unknown, { query, ...page }: { query?: string | null } & PageArgs) {
      return userService.search(query, page);
    },
    followingFeed(_p: unknown, page: PageArgs, ctx: Context) {
      const user = ctx.requireUser();
      return followService.personalizedFeed(user._id, page);
    },
  },

  User: {
    id: idOf,
    joinDate: (p: IUser) => p.createdAt,
    avatarUrl: (p: IUser) => mediaUrl(p.profileImageKey),
    email: (p: IUser, _a: unknown, ctx: Context) => (selfOrAdmin(p, ctx) ? p.email : null),
    mobileNumber: (p: IUser, _a: unknown, ctx: Context) => (selfOrAdmin(p, ctx) ? p.mobileNumber : null),

    followerCount: (p: IUser) => userService.followerCount(p._id),
    followingCount: (p: IUser) => userService.followingCount(p._id),
    trackCount: (p: IUser) => userService.publishedTrackCount(p._id),
    totalPlayCount: async (p: IUser) => (await userService.aggregateCounts(p._id)).totalPlays,
    totalReactions: async (p: IUser) => (await userService.aggregateCounts(p._id)).totalReactions,
    isFollowedByMe: (p: IUser, _a: unknown, ctx: Context) =>
      userService.isFollowedBy(p._id, ctx.user?._id),

    music: (p: IUser, page: PageArgs, ctx: Context) =>
      musicService.byUploader(p._id, ctx.user, page),
    playlists: (p: IUser, page: PageArgs, ctx: Context) =>
      playlistService.forUser(p._id, ctx.user, page),
    followers: (p: IUser, page: PageArgs) => followService.followers(p._id, page),
    following: (p: IUser, page: PageArgs) => followService.following(p._id, page),
  },

  Mutation: {
    updateProfile(
      _p: unknown,
      { input, profileImage }: { input: unknown; profileImage?: unknown },
      ctx: Context,
    ) {
      const user = ctx.requireUser();
      return userService.updateProfile(user._id, input, profileImage as never);
    },
    followUser(_p: unknown, { userId }: { userId: string }, ctx: Context) {
      return followService.follow(ctx.requireUser(), userId);
    },
    unfollowUser(_p: unknown, { userId }: { userId: string }, ctx: Context) {
      return followService.unfollow(ctx.requireUser(), userId);
    },
  },
};
