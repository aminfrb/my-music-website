import { Schema, model, models, type Model, type Types } from "mongoose";

export interface IConversation {
  _id: Types.ObjectId;
  /** The two participants, stored sorted so `pairKey` is stable. */
  participants: Types.ObjectId[];
  /** Stable "smallerId:largerId" key guaranteeing one conversation per pair. */
  pairKey: string;
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      index: true,
    },
    pairKey: { type: String, required: true, unique: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

export const Conversation: Model<IConversation> =
  models.Conversation || model<IConversation>("Conversation", schema);
