import { Schema, model, models, type Model, type Types } from "mongoose";
import { NOTIFICATION_TYPES, type NotificationType } from "../constants";

export interface INotification {
  _id: Types.ObjectId;
  user: Types.ObjectId; // recipient
  type: NotificationType;
  title: string;
  message: string;
  relatedEntity?: { kind: string; id: Types.ObjectId } | null;
  isRead: boolean;
  createdAt: Date;
}

const schema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedEntity: {
      type: { kind: String, id: Schema.Types.ObjectId },
      default: null,
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  models.Notification || model<INotification>("Notification", schema);
