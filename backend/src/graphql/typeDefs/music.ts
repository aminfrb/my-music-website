export const musicTypeDefs = /* GraphQL */ `
  type Genre {
    id: ID!
    slug: String!
    nameEn: String!
    nameFa: String!
    name: String! # localized
    isActive: Boolean!
    trackCount: Int!
  }

  type Tag {
    id: ID!
    name: String!
    usageCount: Int!
    isBanned: Boolean!
  }

  type ReactionCount {
    type: ReactionType!
    count: Int!
  }

  type Music {
    id: ID!
    title: String!
    artistName: String!
    caption: String
    description: String
    duration: Int!
    fileSize: Int!
    mimeType: String!
    tags: [String!]!
    status: MusicStatus!
    visibility: Visibility!

    playCount: Int!
    saveCount: Int!
    reactionCount: Int!
    reactionBreakdown: [ReactionCount!]!

    "Short-lived presigned cover URL (null if no cover)."
    coverUrl: String
    "Short-lived presigned, range-seekable audio URL."
    streamUrl: String!

    uploader: User!
    genre: Genre!

    "The authenticated user's reaction to this track, if any."
    myReaction: ReactionType
    moderationNote: String
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    similar(limit: Int): [Music!]!
  }

  type MusicEdge { cursor: String!, node: Music! }
  type MusicConnection {
    edges: [MusicEdge!]!
    nodes: [Music!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input UpdateMusicInput {
    title: String
    artistName: String
    caption: String
    description: String
    genreId: ID
    tags: [String!]
    visibility: Visibility
  }

  extend type Query {
    music(id: ID!): Music
    "Latest published music (cursor paginated, for infinite scroll)."
    latestMusic(first: Int, after: String): MusicConnection!
    trendingMusic(limit: Int): [Music!]!
    todayPopularMusic(limit: Int): [Music!]!
    weekMostReactedMusic(limit: Int): [Music!]!
    lessDiscoveredMusic(limit: Int): [Music!]!

    genres: [Genre!]!
    genre(slug: String!): Genre
    tags(query: String, limit: Int): [Tag!]!
  }

  extend type Mutation {
    updateMusic(id: ID!, input: UpdateMusicInput!): Music!
    deleteMusic(id: ID!): Boolean!
    "Record a playback event (seconds listened); increments play count for meaningful listens."
    recordPlay(musicId: ID!, seconds: Int): Music!
    "Record a non-play interaction (skip/share) for recommendation tuning."
    recordInteraction(musicId: ID!, kind: InteractionKind!, seconds: Int): Boolean!
    "Set/replace your reaction (same emoji again toggles it off)."
    reactToMusic(musicId: ID!, type: ReactionType!): Music!
    unreactToMusic(musicId: ID!): Music!
    reportMusic(input: ReportInput!): Report!
  }
`;
