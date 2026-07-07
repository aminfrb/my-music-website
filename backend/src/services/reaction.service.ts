import { Types } from "mongoose";
import { Reaction, Music, type IMusic, type IUser } from "../models";
import { errors } from "../utils/errors";
import { interactionService } from "./interaction.service";
import { notificationService } from "./notification.service";
import { REACTION_TYPES, type ReactionType } from "../constants";

/** Recompute denormalized reaction totals + per-emoji breakdown for a track. */
async function recompute(musicId: Types.ObjectId): Promise<IMusic> {
  const agg = await Reaction.aggregate<{ _id: ReactionType; n: number }>([
    { $match: { music: musicId } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const a of agg) {
    counts[a._id] = a.n;
    total += a.n;
  }
  return (await Music.findByIdAndUpdate(
    musicId,
    { $set: { reactionCount: total, reactionCounts: counts } },
    { new: true },
  ).lean<IMusic>().exec())!;
}

export const reactionService = {
  /**
   * Set the user's reaction for a track. Re-reacting with the same emoji toggles
   * it off; a different emoji replaces the existing one (one active per user).
   */
  async react(user: IUser, musicId: string, type: ReactionType): Promise<IMusic> {
    if (!REACTION_TYPES.includes(type)) throw errors.badInput();
    if (!Types.ObjectId.isValid(musicId)) throw errors.notFound("errors.musicNotFound");
    const music = await Music.findById(musicId).lean<IMusic>().exec();
    if (!music || music.status !== "published") throw errors.notFound("errors.musicNotFound");

    const existing = await Reaction.findOne({ user: user._id, music: music._id });
    if (existing && existing.type === type) {
      await existing.deleteOne(); // toggle off
      return recompute(music._id);
    }
    if (existing) {
      existing.type = type;
      await existing.save();
    } else {
      await Reaction.create({ user: user._id, music: music._id, type });
    }
    const updated = await recompute(music._id);
    await interactionService.record(user._id, music, "reaction");
    await notificationService.notify(
      music.uploadedBy,
      user._id,
      "music_reaction",
      { name: user.displayName, title: music.title },
      { kind: "Music", id: music._id },
    );
    return updated;
  },

  async unreact(user: IUser, musicId: string): Promise<IMusic> {
    if (!Types.ObjectId.isValid(musicId)) throw errors.notFound("errors.musicNotFound");
    const existing = await Reaction.findOne({ user: user._id, music: musicId });
    if (!existing) {
      const music = await Music.findById(musicId).lean<IMusic>().exec();
      if (!music) throw errors.notFound("errors.musicNotFound");
      return music;
    }
    await existing.deleteOne();
    return recompute(new Types.ObjectId(musicId));
  },

  async myReaction(userId: Types.ObjectId, musicId: Types.ObjectId): Promise<ReactionType | null> {
    const r = await Reaction.findOne({ user: userId, music: musicId }).select("type").lean().exec();
    return (r?.type as ReactionType) ?? null;
  },
};
