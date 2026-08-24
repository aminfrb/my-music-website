import type {
  Connection,
  DuplicateDetails,
  Genre,
  Music,
  Playlist,
  PlaylistItem,
  SuggestedUser,
  User,
} from "@/lib/types";

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u1",
    displayName: "Ali",
    email: null,
    bio: null,
    locale: "en",
    role: "user",
    status: "active",
    isVerifiedArtist: false,
    isTrusted: false,
    avatarUrl: null,
    joinDate: "2026-01-01T00:00:00.000Z",
    followerCount: 12,
    followingCount: 3,
    trackCount: 5,
    totalPlayCount: 100,
    totalReactions: 10,
    isFollowedByMe: false,
    allowMessages: true,
    ...overrides,
  } as User;
}

export function makeGenre(overrides: Partial<Genre> = {}): Genre {
  return { id: "g1", slug: "rap", name: "Rap", ...overrides } as Genre;
}

export function makeMusic(overrides: Partial<Music> = {}): Music {
  return {
    id: "m1",
    title: "Seyl",
    artistName: "Mehrad Hidden",
    caption: null,
    description: null,
    duration: 200,
    tags: [],
    status: "published",
    playCount: 100,
    saveCount: 2,
    reactionCount: 20,
    coverUrl: null,
    streamUrl: "https://storage.test/stream",
    myReaction: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    publishedAt: "2026-06-01T00:00:00.000Z",
    reactionBreakdown: [],
    genre: makeGenre(),
    uploader: makeUser(),
    ...overrides,
  } as Music;
}

export function makeSuggestedUser(overrides: Partial<SuggestedUser> = {}): SuggestedUser {
  return {
    user: makeUser(),
    reasonKey: "sharedTaste",
    reason: "You listen to the same music",
    mutualCount: 0,
    sharedGenres: [],
    ...overrides,
  };
}

export function makeDuplicate(overrides: Partial<DuplicateDetails> = {}): DuplicateDetails {
  return {
    kind: "song",
    musicId: "m1",
    title: "Seyl",
    artistName: "Mehrad Hidden",
    publishedAt: "2026-06-01T00:00:00.000Z",
    uploader: {
      id: "u9",
      displayName: "Ali",
      avatarUrl: null,
      isVerifiedArtist: false,
    },
    ...overrides,
  };
}

export function makePlaylistItem(overrides: Partial<PlaylistItem> = {}): PlaylistItem {
  return {
    id: "pi1",
    position: 0,
    music: makeMusic(),
    addedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  const items = overrides.items ?? [makePlaylistItem()];
  return {
    id: "p1",
    name: "Late Night",
    description: "For the drive home.",
    coverUrl: null,
    owner: makeUser({ id: "owner1", displayName: "Ali" }),
    collaborators: [],
    visibility: "public",
    mood: null,
    followersCount: 40,
    trackCount: items.length,
    shareToken: "tok",
    isFollowedByMe: false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
    items,
  } as Playlist;
}

/** A single-page Relay-style connection, as the profile query returns. */
export function makeConnection<T>(nodes: T[]): Connection<T> {
  return {
    nodes,
    pageInfo: { hasNextPage: false, endCursor: null },
    totalCount: nodes.length,
  } as Connection<T>;
}
