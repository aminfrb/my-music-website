import type { Context } from "../../context";
import type { INotification } from "../../models";
import { notificationService } from "../../services/notification.service";
import { idOf } from "./helpers";
import type { PageArgs } from "../../utils/pagination";

export const notificationResolvers = {
  Query: {
    notifications(_p: unknown, page: PageArgs, ctx: Context) {
      return notificationService.list(ctx.requireUser()._id, page);
    },
    unreadNotificationCount(_p: unknown, _a: unknown, ctx: Context) {
      return notificationService.unreadCount(ctx.requireUser()._id);
    },
  },

  Notification: {
    id: idOf,
    relatedKind: (p: INotification) => p.relatedEntity?.kind ?? null,
    relatedId: (p: INotification) => p.relatedEntity?.id?.toString() ?? null,
  },

  Mutation: {
    markNotificationsRead(_p: unknown, { ids }: { ids: string[] }, ctx: Context) {
      return notificationService.markRead(ctx.requireUser()._id, ids);
    },
    markAllNotificationsRead(_p: unknown, _a: unknown, ctx: Context) {
      return notificationService.markAllRead(ctx.requireUser()._id);
    },
  },
};
