import { Types } from "mongoose";
import type { Context } from "../../context";
import { UploadSession, Genre, Music, type IUploadSession } from "../../models";
import { uploadService } from "../../services/upload.service";
import { idOf } from "./helpers";

export const uploadResolvers = {
  Query: {
    async uploadSession(_p: unknown, { id }: { id: string }, ctx: Context) {
      const user = ctx.requireUser();
      if (!Types.ObjectId.isValid(id)) return null;
      const session = await UploadSession.findById(id).lean<IUploadSession>();
      if (!session || !session.user.equals(user._id)) return null;
      return session;
    },
  },

  UploadSession: {
    id: idOf,
    music: (p: IUploadSession) => (p.music ? Music.findById(p.music).lean().exec() : null),
  },

  UploadMetadata: {
    genre: (p: IUploadSession["metadata"]) => (p.genre ? Genre.findById(p.genre).lean().exec() : null),
  },

  UploadAsset: {
    finalized: (p: { finalized?: boolean }) => !!p.finalized,
  },

  Mutation: {
    createUploadSession(_p: unknown, _a: unknown, ctx: Context) {
      return uploadService.createSession(ctx.requireUser());
    },
    requestAudioUpload(
      _p: unknown,
      { sessionId, contentType }: { sessionId: string; contentType?: string },
      ctx: Context,
    ) {
      return uploadService.requestAudioUpload(ctx.requireUser(), sessionId, contentType ?? undefined);
    },
    finalizeAudioUpload(_p: unknown, { sessionId }: { sessionId: string }, ctx: Context) {
      return uploadService.finalizeAudio(ctx.requireUser(), sessionId);
    },
    requestCoverUpload(
      _p: unknown,
      { sessionId, contentType }: { sessionId: string; contentType?: string },
      ctx: Context,
    ) {
      return uploadService.requestCoverUpload(ctx.requireUser(), sessionId, contentType ?? undefined);
    },
    finalizeCoverUpload(_p: unknown, { sessionId }: { sessionId: string }, ctx: Context) {
      return uploadService.finalizeCover(ctx.requireUser(), sessionId);
    },
    setUploadMetadata(
      _p: unknown,
      { sessionId, input }: { sessionId: string; input: unknown },
      ctx: Context,
    ) {
      return uploadService.setMetadata(ctx.requireUser(), sessionId, input);
    },
    publishUpload(_p: unknown, { sessionId }: { sessionId: string }, ctx: Context) {
      return uploadService.publish(ctx.requireUser(), sessionId);
    },
  },
};
