export const scalarsTypeDefs = /* GraphQL */ `
  scalar DateTime
  scalar Upload

  enum Locale { en fa }
  enum Role { user admin }
  enum UserStatus { active blocked }
  enum MusicStatus { pending published rejected blocked }
  enum Visibility { public private }
  enum PlaylistVisibility { public private unlisted }
  enum ReactionType { like fire headphone star energy calm sad repeat }
  enum ReportReason {
    inappropriate_content
    copyright
    inappropriate_title_or_cover
    broken_file
    spam
    other
  }
  enum ReportStatus { pending reviewed resolved rejected }
  enum NotificationType {
    music_published
    music_rejected
    music_saved
    music_reaction
    new_follower
    playlist_followed
  }
  enum Mood { focus energy night road study calm }
  enum ReviewAction { approve reject block }
  enum InteractionKind { skip share }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type Query {
    health: String!
  }

  type Mutation {
    _empty: Boolean
  }
`;
