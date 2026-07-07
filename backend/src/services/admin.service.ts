import { Types } from "mongoose";
import {
  User,
  Music,
  Report,
  MusicInteraction,
  type IUser,
  type IMusic,
  type IReport,
} from "../models";
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
import type { MusicStatus, ReportStatus } from "../constants";

export type ReviewAction = "approve" | "reject" | "block";

export interface AdminOverview {
  totalUsers: number;
  blockedUsers: number;
  totalMusic: number;
  pendingMusic: number;
  publishedMusic: number;
  openReports: number;
  totalPlays: number;
  activeUsers24h: number;
}

export const adminService = {
  // ── Users ──
  async listUsers(query: string | null | undefined, page: PageArgs): Promise<Connection<IUser>> {
    const limit = clampLimit(page.first);
    const filter: Record<string, unknown> = { ...afterIdFilter(page.after) };
    if (query) filter.$or = [{ displayName: new RegExp(query, "i") }, { email: new RegExp(query, "i") }];
    const [rows, totalCount] = await Promise.all([
      User.find(filter).sort({ _id: -1 }).limit(limit + 1).lean<IUser[]>().exec(),
      User.countDocuments(query ? { $or: filter.$or as object[] } : {}),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  async setUserBlocked(userId: string, blocked: boolean): Promise<IUser> {
    const u = await User.findByIdAndUpdate(
      userId,
      { $set: { status: blocked ? "blocked" : "active" } },
      { new: true },
    ).lean<IUser>().exec();
    if (!u) throw errors.notFound("errors.notFound", { entity: "User" });
    return u;
  },

  async setUserFlags(
    userId: string,
    flags: { isTrusted?: boolean; isVerifiedArtist?: boolean; role?: "user" | "admin" },
  ): Promise<IUser> {
    const set: Record<string, unknown> = {};
    if (flags.isTrusted !== undefined) set.isTrusted = flags.isTrusted;
    if (flags.isVerifiedArtist !== undefined) set.isVerifiedArtist = flags.isVerifiedArtist;
    if (flags.role) set.role = flags.role;
    const u = await User.findByIdAndUpdate(userId, { $set: set }, { new: true }).lean<IUser>().exec();
    if (!u) throw errors.notFound("errors.notFound", { entity: "User" });
    return u;
  },

  // ── Music moderation ──
  async musicQueue(status: MusicStatus | null | undefined, page: PageArgs): Promise<Connection<IMusic>> {
    const limit = clampLimit(page.first);
    const base = status ? { status } : { status: "pending" };
    const [rows, totalCount] = await Promise.all([
      Music.find({ ...base, ...afterIdFilter(page.after) }).sort({ _id: -1 }).limit(limit + 1).lean<IMusic[]>().exec(),
      Music.countDocuments(base),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  async reviewMusic(
    admin: IUser,
    musicId: string,
    action: ReviewAction,
    note?: string | null,
  ): Promise<IMusic> {
    const music = await Music.findById(musicId);
    if (!music) throw errors.notFound("errors.musicNotFound");
    const now = new Date();
    const status: MusicStatus =
      action === "approve" ? "published" : action === "reject" ? "rejected" : "blocked";
    music.status = status;
    music.moderationNote = note ?? null;
    music.reviewedBy = admin._id;
    music.reviewedAt = now;
    if (action === "approve" && !music.publishedAt) music.publishedAt = now;
    await music.save();

    if (action === "approve") {
      await notificationService.notify(music.uploadedBy, null, "music_published", { title: music.title }, { kind: "Music", id: music._id });
    } else if (action === "reject") {
      await notificationService.notify(music.uploadedBy, null, "music_rejected", { title: music.title, note: note ?? "" }, { kind: "Music", id: music._id });
    }
    if (action !== "approve") {
      await Report.updateMany(
        { music: music._id, status: { $in: ["pending", "reviewed"] } },
        { $set: { status: "resolved", reviewedBy: admin._id } },
      );
    }
    return music.toObject();
  },

  // ── Reports ──
  async listReports(status: ReportStatus | null | undefined, page: PageArgs): Promise<Connection<IReport>> {
    const limit = clampLimit(page.first);
    const base = status ? { status } : {};
    const [rows, totalCount] = await Promise.all([
      Report.find({ ...base, ...afterIdFilter(page.after) }).sort({ _id: -1 }).limit(limit + 1).lean<IReport[]>().exec(),
      Report.countDocuments(base),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  async resolveReport(admin: IUser, reportId: string, status: ReportStatus): Promise<IReport> {
    const r = await Report.findByIdAndUpdate(
      reportId,
      { $set: { status, reviewedBy: admin._id } },
      { new: true },
    ).lean<IReport>().exec();
    if (!r) throw errors.notFound("errors.notFound", { entity: "Report" });
    return r;
  },

  // ── Overview ──
  async overview(): Promise<AdminOverview> {
    const since = new Date(Date.now() - 86_400_000);
    const [
      totalUsers,
      blockedUsers,
      totalMusic,
      pendingMusic,
      publishedMusic,
      openReports,
      playsAgg,
      active,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: "blocked" }),
      Music.countDocuments({}),
      Music.countDocuments({ status: "pending" }),
      Music.countDocuments({ status: "published" }),
      Report.countDocuments({ status: { $in: ["pending", "reviewed"] } }),
      Music.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$playCount" } } }]),
      MusicInteraction.distinct("user", { createdAt: { $gte: since } }),
    ]);
    return {
      totalUsers,
      blockedUsers,
      totalMusic,
      pendingMusic,
      publishedMusic,
      openReports,
      totalPlays: playsAgg[0]?.total ?? 0,
      activeUsers24h: (active as Types.ObjectId[]).length,
    };
  },
};
