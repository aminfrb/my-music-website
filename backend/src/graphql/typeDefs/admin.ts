export const adminTypeDefs = /* GraphQL */ `
  type AdminOverview {
    totalUsers: Int!
    blockedUsers: Int!
    totalMusic: Int!
    pendingMusic: Int!
    publishedMusic: Int!
    openReports: Int!
    totalPlays: Int!
    activeUsers24h: Int!
  }

  extend type Query {
    adminOverview: AdminOverview!
    adminUsers(query: String, first: Int, after: String): UserConnection!
    "Moderation queue (defaults to pending tracks)."
    adminMusicQueue(status: MusicStatus, first: Int, after: String): MusicConnection!
    adminReports(status: ReportStatus, first: Int, after: String): ReportConnection!
    adminBannedTags: [Tag!]!
  }

  extend type Mutation {
    adminSetUserBlocked(userId: ID!, blocked: Boolean!): User!
    adminSetUserFlags(userId: ID!, isTrusted: Boolean, isVerifiedArtist: Boolean, role: Role): User!
    adminReviewMusic(musicId: ID!, action: ReviewAction!, note: String): Music!
    adminResolveReport(reportId: ID!, status: ReportStatus!): Report!
    adminCreateGenre(slug: String!, nameEn: String!, nameFa: String!): Genre!
    adminSetGenreActive(slug: String!, isActive: Boolean!): Genre!
    adminSetTagBanned(name: String!, isBanned: Boolean!): Tag!
  }
`;
