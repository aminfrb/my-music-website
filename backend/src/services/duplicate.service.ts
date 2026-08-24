import { Types } from "mongoose";
import { Music, User, type IMusic, type IUser } from "../models";
import { errors } from "../utils/errors";
import { dedupeKeyFor } from "../utils/text";
import { presignGetUrl } from "../upload/storage";

/** Statuses that still "own" a song identity. A rejected or blocked upload
 *  releases the name so someone else can post the track properly. */
const CLAIMING_STATUSES = ["pending", "published"] as const;

export interface DuplicateMatch {
  music: IMusic;
  uploader: IUser | null;
  /** How the collision was found — same audio file, or same song identity. */
  kind: "file" | "song";
}

/**
 * The shape handed to the client in `extensions.details.duplicate` so the
 * upload screen can show who posted the track first, link to their profile,
 * and offer a follow button instead of a dead end.
 */
export interface DuplicateDetails {
  kind: "file" | "song";
  musicId: string;
  title: string;
  artistName: string;
  publishedAt: string | null;
  uploader: {
    id: string;
    displayName: string;
    /** Presigned avatar URL, so the client can render the profile immediately. */
    avatarUrl: string | null;
    isVerifiedArtist: boolean;
  } | null;
}

export const duplicateService = {
  /**
   * Look for an existing upload of the same song. Two independent signals:
   *
   *  1. `fileHash` — byte-identical audio, whoever posted it.
   *  2. `dedupeKey` — same title + primary artist, even if the files differ
   *     (different bitrate, different rip). This is the case the product cares
   *     about: user A posts "Seyl" by Mehrad Hidden, user B must not post it again.
   *
   * `ignoreMusicId` lets an edit of an existing track skip matching itself.
   */
  async find(
    title: string | null | undefined,
    artistName: string | null | undefined,
    fileHash?: string | null,
    ignoreMusicId?: Types.ObjectId | null,
  ): Promise<DuplicateMatch | null> {
    const base: Record<string, unknown> = { status: { $in: CLAIMING_STATUSES } };
    if (ignoreMusicId) base._id = { $ne: ignoreMusicId };

    const key = dedupeKeyFor(title, artistName);
    const queries: { kind: DuplicateMatch["kind"]; filter: Record<string, unknown> }[] = [];
    if (fileHash) queries.push({ kind: "file", filter: { ...base, fileHash } });
    if (key) queries.push({ kind: "song", filter: { ...base, dedupeKey: key } });
    if (queries.length === 0) return null;

    for (const q of queries) {
      const match = await Music.findOne(q.filter)
        .sort({ createdAt: 1 }) // the earliest upload owns the song
        .lean<IMusic>()
        .exec();
      if (match) {
        const uploader = await User.findById(match.uploadedBy).lean<IUser>().exec();
        return { music: match, uploader, kind: q.kind };
      }
    }
    return null;
  },

  async details(match: DuplicateMatch): Promise<DuplicateDetails> {
    const avatarUrl = match.uploader?.profileImageKey
      ? await presignGetUrl(match.uploader.profileImageKey).catch(() => null)
      : null;
    return {
      kind: match.kind,
      musicId: match.music._id.toString(),
      title: match.music.title,
      artistName: match.music.artistName,
      publishedAt: (match.music.publishedAt ?? match.music.createdAt)?.toISOString() ?? null,
      uploader: match.uploader
        ? {
            id: match.uploader._id.toString(),
            displayName: match.uploader.displayName,
            avatarUrl,
            isVerifiedArtist: !!match.uploader.isVerifiedArtist,
          }
        : null,
    };
  },

  /**
   * Reject the upload when the song already exists. The error names the first
   * uploader and carries their profile so the client can render it; when the
   * *same* user is re-posting their own track the message says so instead.
   */
  async assertNotDuplicate(
    uploaderId: Types.ObjectId,
    title: string | null | undefined,
    artistName: string | null | undefined,
    fileHash?: string | null,
    ignoreMusicId?: Types.ObjectId | null,
  ): Promise<void> {
    const match = await this.find(title, artistName, fileHash, ignoreMusicId);
    if (!match) return;

    const details = await this.details(match);
    const mine = match.music.uploadedBy.equals(uploaderId);

    if (mine) {
      throw errors.conflict(
        match.kind === "file" ? "errors.duplicateFile" : "errors.duplicateTrackMine",
        { title: match.music.title },
        { duplicate: details },
      );
    }
    throw errors.conflict(
      "errors.duplicateTrack",
      {
        title: match.music.title,
        artist: match.music.artistName,
        name: match.uploader?.displayName ?? "",
      },
      { duplicate: details },
    );
  },
};
