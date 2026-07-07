import { z } from "zod";
import { Types } from "mongoose";
import {
  User,
  Conversation,
  Message,
  type IUser,
  type IMessage,
  type IConversation,
} from "../models";
import { errors } from "../utils/errors";
import { parse } from "./auth.service";
import { emitToUser } from "../realtime";
import {
  afterIdFilter,
  buildConnection,
  clampLimit,
  idCursor,
  type Connection,
  type PageArgs,
} from "../utils/pagination";

const bodySchema = z.string().trim().min(1).max(2000);

function pairKey(a: Types.ObjectId, b: Types.ObjectId): string {
  return [a.toString(), b.toString()].sort().join(":");
}

/** Compact, JSON-safe shape pushed over the WebSocket. */
function serialize(m: IMessage) {
  return {
    id: m._id.toString(),
    conversationId: m.conversation.toString(),
    senderId: m.sender.toString(),
    recipientId: m.recipient.toString(),
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

export const messageService = {
  /** Whether `sender` is allowed to open/continue a DM with `recipientId`. */
  async canMessage(sender: IUser, recipientId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(recipientId)) return false;
    if (sender._id.equals(recipientId)) return false;
    const recipient = await User.findById(recipientId).lean<IUser>().exec();
    if (!recipient || recipient.status !== "active") return false;
    return recipient.allowMessages !== false;
  },

  async send(sender: IUser, recipientId: string, rawBody: unknown): Promise<IMessage> {
    const body = parse(bodySchema, rawBody);
    if (!Types.ObjectId.isValid(recipientId)) throw errors.badInput();
    if (sender._id.equals(recipientId)) throw errors.badInput();

    const recipient = await User.findById(recipientId);
    if (!recipient || recipient.status !== "active") {
      throw errors.notFound("errors.notFound", { entity: "User" });
    }
    if (recipient.allowMessages === false) throw errors.forbidden("errors.messagesDisabled");

    const key = pairKey(sender._id, recipient._id);
    const now = new Date();
    const conversation = await Conversation.findOneAndUpdate(
      { pairKey: key },
      {
        $set: { lastMessage: body, lastMessageAt: now },
        $setOnInsert: {
          pairKey: key,
          participants: [sender._id, recipient._id].sort((a, b) =>
            a.toString().localeCompare(b.toString()),
          ),
        },
      },
      { upsert: true, new: true },
    ).exec();

    const doc = await Message.create({
      conversation: conversation._id,
      sender: sender._id,
      recipient: recipient._id,
      body,
    });
    const message = doc.toObject();

    // Realtime fan-out to both participants (all their tabs/devices).
    emitToUser(recipient._id.toString(), "message:new", serialize(message));
    emitToUser(sender._id.toString(), "message:new", serialize(message));

    return message;
  },

  /** A user's conversations, most-recently-active first. */
  async conversations(userId: Types.ObjectId, first?: number | null): Promise<IConversation[]> {
    const limit = clampLimit(first);
    return Conversation.find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .limit(limit)
      .lean<IConversation[]>()
      .exec();
  },

  /** Messages exchanged with `otherUserId`, newest-first, cursor-paginated. */
  async thread(
    userId: Types.ObjectId,
    otherUserId: string,
    page: PageArgs,
  ): Promise<Connection<IMessage>> {
    if (!Types.ObjectId.isValid(otherUserId)) throw errors.badInput();
    const limit = clampLimit(page.first);
    const key = pairKey(userId, new Types.ObjectId(otherUserId));
    const conversation = await Conversation.findOne({ pairKey: key }).lean<IConversation>().exec();
    if (!conversation) {
      return { nodes: [], edges: [], pageInfo: { hasNextPage: false, endCursor: null }, totalCount: 0 };
    }

    const filter = { conversation: conversation._id, ...afterIdFilter(page.after) };
    const [rows, totalCount] = await Promise.all([
      Message.find(filter).sort({ _id: -1 }).limit(limit + 1).lean<IMessage[]>().exec(),
      Message.countDocuments({ conversation: conversation._id }),
    ]);
    return buildConnection(rows, limit, totalCount, idCursor);
  },

  /** Mark every message the given user received in this pair as read. */
  async markRead(userId: Types.ObjectId, otherUserId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(otherUserId)) return false;
    const key = pairKey(userId, new Types.ObjectId(otherUserId));
    const conversation = await Conversation.findOne({ pairKey: key }).lean<IConversation>().exec();
    if (!conversation) return false;
    await Message.updateMany(
      { conversation: conversation._id, recipient: userId, readAt: null },
      { $set: { readAt: new Date() } },
    ).exec();
    return true;
  },

  unreadTotal(userId: Types.ObjectId): Promise<number> {
    return Message.countDocuments({ recipient: userId, readAt: null }).exec();
  },

  unreadInConversation(conversationId: Types.ObjectId, userId: Types.ObjectId): Promise<number> {
    return Message.countDocuments({
      conversation: conversationId,
      recipient: userId,
      readAt: null,
    }).exec();
  },

  async setAllowMessages(userId: Types.ObjectId, allow: boolean): Promise<IUser> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { allowMessages: allow } },
      { new: true },
    ).exec();
    if (!user) throw errors.notFound("errors.notFound", { entity: "User" });
    return user.toObject();
  },

  /** The participant of a conversation who isn't `userId`. */
  otherParticipantId(conversation: IConversation, userId: Types.ObjectId): Types.ObjectId {
    return conversation.participants.find((p) => !p.equals(userId)) ?? conversation.participants[0];
  },
};
