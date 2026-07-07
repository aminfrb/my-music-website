import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IMessage {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  body: string;
  /** Null until the recipient has read it. */
  readAt: Date | null;
  createdAt: Date;
}

const schema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, maxlength: 2000 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Thread reads (newest-first within a conversation).
schema.index({ conversation: 1, _id: -1 });
// Unread counts per recipient.
schema.index({ recipient: 1, readAt: 1 });

export const Message: Model<IMessage> =
  models.Message || model<IMessage>("Message", schema);
