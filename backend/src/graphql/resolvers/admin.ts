import type { Context } from "../../context";
import { adminService, type ReviewAction } from "../../services/admin.service";
import { catalogService } from "../../services/catalog.service";
import type { MusicStatus, ReportStatus, Role } from "../../constants";
import type { PageArgs } from "../../utils/pagination";

function admin(ctx: Context) {
  return ctx.requireRole("admin");
}

export const adminResolvers = {
  Query: {
    adminOverview(_p: unknown, _a: unknown, ctx: Context) {
      admin(ctx);
      return adminService.overview();
    },
    adminUsers(_p: unknown, { query, ...page }: { query?: string | null } & PageArgs, ctx: Context) {
      admin(ctx);
      return adminService.listUsers(query, page);
    },
    adminMusicQueue(
      _p: unknown,
      { status, ...page }: { status?: MusicStatus | null } & PageArgs,
      ctx: Context,
    ) {
      admin(ctx);
      return adminService.musicQueue(status, page);
    },
    adminReports(
      _p: unknown,
      { status, ...page }: { status?: ReportStatus | null } & PageArgs,
      ctx: Context,
    ) {
      admin(ctx);
      return adminService.listReports(status, page);
    },
    adminBannedTags(_p: unknown, _a: unknown, ctx: Context) {
      admin(ctx);
      return catalogService.bannedTags();
    },
  },

  Mutation: {
    adminSetUserBlocked(
      _p: unknown,
      { userId, blocked }: { userId: string; blocked: boolean },
      ctx: Context,
    ) {
      admin(ctx);
      return adminService.setUserBlocked(userId, blocked);
    },
    adminSetUserFlags(
      _p: unknown,
      args: { userId: string; isTrusted?: boolean; isVerifiedArtist?: boolean; role?: Role },
      ctx: Context,
    ) {
      admin(ctx);
      return adminService.setUserFlags(args.userId, {
        isTrusted: args.isTrusted,
        isVerifiedArtist: args.isVerifiedArtist,
        role: args.role,
      });
    },
    adminReviewMusic(
      _p: unknown,
      { musicId, action, note }: { musicId: string; action: ReviewAction; note?: string | null },
      ctx: Context,
    ) {
      return adminService.reviewMusic(admin(ctx), musicId, action, note);
    },
    adminResolveReport(
      _p: unknown,
      { reportId, status }: { reportId: string; status: ReportStatus },
      ctx: Context,
    ) {
      return adminService.resolveReport(admin(ctx), reportId, status);
    },
    adminCreateGenre(
      _p: unknown,
      input: { slug: string; nameEn: string; nameFa: string },
      ctx: Context,
    ) {
      admin(ctx);
      return catalogService.createGenre(input);
    },
    adminSetGenreActive(
      _p: unknown,
      { slug, isActive }: { slug: string; isActive: boolean },
      ctx: Context,
    ) {
      admin(ctx);
      return catalogService.setGenreActive(slug, isActive);
    },
    adminSetTagBanned(
      _p: unknown,
      { name, isBanned }: { name: string; isBanned: boolean },
      ctx: Context,
    ) {
      admin(ctx);
      return catalogService.setTagBanned(name, isBanned);
    },
  },
};
