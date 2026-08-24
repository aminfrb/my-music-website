import { Types } from "mongoose";
import type { RecContext } from "../../src/services/recommendation.service";
import type { IMusic } from "../../src/models";

/** An empty context — a brand-new listener with no history and no network. */
export function emptyContext(overrides: Partial<RecContext> = {}): RecContext {
  return {
    userId: new Types.ObjectId(),
    genres: new Map(),
    tags: new Map(),
    uploaders: new Map(),
    artists: new Map(),
    skippedGenres: new Set(),
    following: new Set(),
    network: new Set(),
    networkGenres: new Set(),
    peers: new Map(),
    peerTracks: new Map(),
    excluded: new Set(),
    played: new Set(),
    hasTaste: false,
    ...overrides,
  };
}

/** A plain track document, only the fields the scorer reads. */
export function fakeTrack(overrides: Partial<IMusic> = {}): IMusic {
  return {
    _id: new Types.ObjectId(),
    title: "Song",
    artistName: "Some Artist",
    genre: new Types.ObjectId(),
    tags: [],
    uploadedBy: new Types.ObjectId(),
    playCount: 0,
    reactionCount: 0,
    publishedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as IMusic;
}
