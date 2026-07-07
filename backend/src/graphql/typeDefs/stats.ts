export const statsTypeDefs = /* GraphQL */ `
  type DailyPoint {
    date: String!
    count: Int!
  }

  type MusicStats {
    music: Music!
    playCount: Int!
    saveCount: Int!
    reactionCount: Int!
    mostReaction: ReactionType
    "Fraction of plays listened to completion (0..1)."
    completeRate: Float!
    dailyPlays: [DailyPoint!]!
  }

  extend type Query {
    "Per-track stats for the uploader (owner or admin only)."
    musicStats(musicId: ID!): MusicStats!
    "The authenticated uploader's most popular tracks."
    myTopMusic(limit: Int): [Music!]!
  }
`;
