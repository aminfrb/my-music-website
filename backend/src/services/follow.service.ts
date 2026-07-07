import { Types } from "mongoose";
import { Follow, User, Music, type IUser, type IMusic } from "../models";
import { errors } from "../utils/errors";
import { notificationService } from "./notification.service";
import {
  buildConnection,
  afterIdFilter,
  clampLimit,
  idCursor,
  type Connection,
  type PageArgs,
} from "../utils/pagination";

export const followService = {
  async follow(user: IUser, targetId: string): Promise<IUser> {
    if (!Types.ObjectId.isValid(targetId)) throw errors.notFound("errors.notFound", { entity: "User" });
    if (user._id.equals(targetId)) throw errors.badInput("errors.cannotFollowSelf");
    const target = await User.findById(targetId);
    if (!target || target.status !== "active") throw errors.notFound("errors.notFound", { entity: "User" });

    try {
      await Follow.create({ follower: user._id, following: target._id });
    } catch {
      throw errors.conflict("errors.alreadyFollowing");
    }
    await notificationService.notify(
      target._id,
      user._id,
      "new_follower",
      { name: user.displayName },
      { kind: "User", id: user._id },
    );
    return target.toObject();
  },

  async unfollow(user: IUser, targetId: string): Promise<IUser> {
    if (!Types.ObjectId.isValid(targetId)) throw errors.notFound("errors.notFound", { entity: "User" });
    const target = await User.findById(targetId);
    if (!target) throw errors.notFound("errors.notFound", { entity: "User" });
    const res = await Follow.deleteOne({ follower: user._id, following: target._id });
    if (res.deletedCount === 0) throw errors.badInput("errors.notFollowing");
    return target.toObject();
  },

  async followers(userId: Types.ObjectId, page: PageArgs): Promise<Connection<IUser>> {
    const limit = clampLimit(page.first);
    const filter = { following: userId, ...afterIdFilter(page.after) };
    const [rows, totalCount] = await Promise.all([
      Follow.find(filter).sort({ _id: -1 }).limit(limit + 1).populate<{ follower: IUser }>("follower").lean().exec(),
      Follow.countDocuments({ following: userId }),
    ]);
    const conn = buildConnection(rows, limit, totalCount, idCursor);
    return {
      ...conn,
      nodes: conn.nodes.map((f) => f.follower),
      edges: conn.edges.map((e) => ({ cursor: e.cursor, node: e.node.follower })),
    };
  },

  async following(userId: Types.ObjectId, page: PageArgs): Promise<Connection<IUser>> {
    const limit = clampLimit(page.first);
    const filter = { follower: userId, ...afterIdFilter(page.after) };
    const [rows, totalCount] = await Promise.all([
      Follow.find(filter).sort({ _id: -1 }).limit(limit + 1).populate<{ following: IUser }>("following").lean().exec(),
      Follow.countDocuments({ follower: userId }),
    ]);
    const conn = buildConnection(rows, limit, totalCount, idCursor);
    return {
      ...conn,
      nodes: conn.nodes.map((f) => f.following),
      edges: conn.edges.map((e) => ({ cursor: e.cursor, node: e.node.following })),
    };
  },

  /** Personalized feed: published public tracks from followed uploaders. */
  async personalizedFeed(userId: Types.ObjectId, page: PageArgs): Promise<Connection<IMusic>> {
    const limit = clampLimit(page.first);
    const follows = await Follow.find({ follower: userId }).select("following").lean().exec();
    const ids = follows.map((f) => f.following);
    if (ids.length === 0) return buildConnection<IMusic>([], limit, 0, idCursor);

    const base = { status: "published", visibility: "public", uploadedBy: { $in: ids } };
    const [rows, totalCount] = await Promise.all([
      Music.find({ ...base, ...afterIdFilter(page.after) }).sort({ _id: -1 }).limit(limit + 1).lean<IMusic[]>().exec(),
      Music.countDocuments(base),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },
};
