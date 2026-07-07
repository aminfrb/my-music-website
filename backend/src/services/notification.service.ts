import { Types } from "mongoose";
import { Notification, User, type INotification } from "../models";
import { t, type Locale } from "../i18n";
import type { NotificationType } from "../constants";
import {
  buildConnection,
  afterIdFilter,
  clampLimit,
  idCursor,
  type Connection,
  type PageArgs,
} from "../utils/pagination";

export const notificationService = {
  /**
   * Create a notification, rendering its title/body in the *recipient's* locale.
   * Self-notifications (acting on your own content) are skipped.
   */
  async notify(
    recipientId: Types.ObjectId,
    actorId: Types.ObjectId | null,
    type: NotificationType,
    params: Record<string, string | number>,
    related?: { kind: string; id: Types.ObjectId },
  ): Promise<void> {
    if (actorId && recipientId.equals(actorId)) return;
    const recipient = await User.findById(recipientId).select("locale").lean().exec();
    if (!recipient) return;
    const locale = recipient.locale as Locale;
    await Notification.create({
      user: recipientId,
      type,
      title: t(`notif.${type}.title`, params, locale),
      message: t(`notif.${type}.body`, params, locale),
      relatedEntity: related ?? null,
    });
  },

  async list(userId: Types.ObjectId, page: PageArgs): Promise<Connection<INotification>> {
    const limit = clampLimit(page.first);
    const filter = { user: userId, ...afterIdFilter(page.after) };
    const [rows, totalCount] = await Promise.all([
      Notification.find(filter).sort({ _id: -1 }).limit(limit + 1).lean<INotification[]>().exec(),
      Notification.countDocuments({ user: userId }),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  unreadCount(userId: Types.ObjectId): Promise<number> {
    return Notification.countDocuments({ user: userId, isRead: false }).exec();
  },

  async markRead(userId: Types.ObjectId, ids: string[]): Promise<number> {
    const res = await Notification.updateMany(
      { user: userId, _id: { $in: ids.filter((id) => Types.ObjectId.isValid(id)) } },
      { $set: { isRead: true } },
    );
    return res.modifiedCount;
  },

  async markAllRead(userId: Types.ObjectId): Promise<number> {
    const res = await Notification.updateMany(
      { user: userId, isRead: false },
      { $set: { isRead: true } },
    );
    return res.modifiedCount;
  },
};
