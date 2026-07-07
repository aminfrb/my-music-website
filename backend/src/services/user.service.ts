import { z } from "zod";
import { Types } from "mongoose";
import { User, Follow, Music, type IUser } from "../models";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { processImageUpload, type UploadArg } from "../upload/process";
import { deleteObject } from "../upload/storage";
import { normalizeText } from "../utils/text";
import {
  buildConnection,
  clampLimit,
  idCursor,
  type Connection,
  type PageArgs,
} from "../utils/pagination";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(500).nullish(),
  locale: z.enum(["en", "fa"]).optional(),
  mobileNumber: z
    .string()
    .regex(/^[+]?[0-9]{8,15}$/)
    .nullish(),
});

export const userService = {
  byId(id: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return User.findById(id).lean<IUser>().exec();
  },

  async updateProfile(
    userId: Types.ObjectId,
    input: unknown,
    profileImage?: UploadArg | null,
  ): Promise<IUser> {
    const data = parse(updateProfileSchema, input);
    const user = await User.findById(userId);
    if (!user) throw errors.notFound("errors.notFound", { entity: "User" });

    if (profileImage) {
      const stored = await processImageUpload(profileImage);
      if (user.profileImageKey) await deleteObject(user.profileImageKey);
      user.profileImageKey = stored.key;
    }
    if (data.displayName !== undefined) user.displayName = data.displayName;
    if (data.bio !== undefined) user.bio = data.bio;
    if (data.locale) user.locale = data.locale;
    if (data.mobileNumber !== undefined) user.mobileNumber = data.mobileNumber;
    await user.save();
    return user.toObject();
  },

  async search(query: string | null | undefined, page: PageArgs): Promise<Connection<IUser>> {
    const limit = clampLimit(page.first);
    const filter: Record<string, unknown> = { status: "active" };
    if (query) {
      const rx = new RegExp(escapeRegex(normalizeText(query)), "i");
      filter.$or = [{ displayName: rx }, { email: rx }];
    }
    const [rows, totalCount] = await Promise.all([
      User.find(filter).sort({ _id: -1 }).limit(limit + 1).lean<IUser[]>().exec(),
      User.countDocuments(filter),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  // ── Counts / stats (User field resolvers) ──
  followerCount(userId: Types.ObjectId): Promise<number> {
    return Follow.countDocuments({ following: userId }).exec();
  },
  followingCount(userId: Types.ObjectId): Promise<number> {
    return Follow.countDocuments({ follower: userId }).exec();
  },
  publishedTrackCount(userId: Types.ObjectId): Promise<number> {
    return Music.countDocuments({ uploadedBy: userId, status: "published" }).exec();
  },

  async aggregateCounts(userId: Types.ObjectId): Promise<{ totalPlays: number; totalReactions: number }> {
    const [agg] = await Music.aggregate<{ totalPlays: number; totalReactions: number }>([
      { $match: { uploadedBy: userId, status: "published" } },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: "$playCount" },
          totalReactions: { $sum: "$reactionCount" },
        },
      },
    ]);
    return { totalPlays: agg?.totalPlays ?? 0, totalReactions: agg?.totalReactions ?? 0 };
  },

  async isFollowedBy(targetUserId: Types.ObjectId, viewerId?: Types.ObjectId): Promise<boolean> {
    if (!viewerId) return false;
    const f = await Follow.exists({ follower: viewerId, following: targetUserId });
    return !!f;
  },
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
