import type { Context } from "../../context";
import type { IConversation, IMessage } from "../../models";
import { messageService } from "../../services/message.service";
import { userService } from "../../services/user.service";
import { idOf } from "./helpers";
import type { PageArgs } from "../../utils/pagination";

export const messageResolvers = {
  Query: {
    conversations(_p: unknown, { first }: { first?: number | null }, ctx: Context) {
      return messageService.conversations(ctx.requireUser()._id, first);
    },
    messagesWith(
      _p: unknown,
      { userId, ...page }: { userId: string } & PageArgs,
      ctx: Context,
    ) {
      return messageService.thread(ctx.requireUser()._id, userId, page);
    },
    canMessage(_p: unknown, { userId }: { userId: string }, ctx: Context) {
      return messageService.canMessage(ctx.requireUser(), userId);
    },
    unreadMessageCount(_p: unknown, _a: unknown, ctx: Context) {
      return messageService.unreadTotal(ctx.requireUser()._id);
    },
  },

  Mutation: {
    sendMessage(
      _p: unknown,
      { toUserId, body }: { toUserId: string; body: string },
      ctx: Context,
    ) {
      return messageService.send(ctx.requireUser(), toUserId, body);
    },
    markConversationRead(_p: unknown, { userId }: { userId: string }, ctx: Context) {
      return messageService.markRead(ctx.requireUser()._id, userId);
    },
    setAllowMessages(_p: unknown, { allow }: { allow: boolean }, ctx: Context) {
      return messageService.setAllowMessages(ctx.requireUser()._id, allow);
    },
  },

  Message: {
    id: idOf,
    conversationId: (m: IMessage) => m.conversation.toString(),
    sender: (m: IMessage) => userService.byId(m.sender.toString()),
    recipient: (m: IMessage) => userService.byId(m.recipient.toString()),
    isRead: (m: IMessage) => m.readAt != null,
    mine: (m: IMessage, _a: unknown, ctx: Context) =>
      ctx.user ? m.sender.equals(ctx.user._id) : false,
    createdAt: (m: IMessage) => m.createdAt,
  },

  Conversation: {
    id: idOf,
    otherUser: (c: IConversation, _a: unknown, ctx: Context) =>
      userService.byId(messageService.otherParticipantId(c, ctx.requireUser()._id).toString()),
    unreadCount: (c: IConversation, _a: unknown, ctx: Context) =>
      messageService.unreadInConversation(c._id, ctx.requireUser()._id),
  },
};
