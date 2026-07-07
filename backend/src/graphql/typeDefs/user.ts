export const userTypeDefs = /* GraphQL */ `
  type User {
    id: ID!
    displayName: String!
    "Only returned for the user themselves or to admins."
    email: String
    mobileNumber: String
    bio: String
    locale: Locale!
    role: Role!
    status: UserStatus!
    isVerifiedArtist: Boolean!
    isTrusted: Boolean!
    avatarUrl: String
    joinDate: DateTime!

    followerCount: Int!
    followingCount: Int!
    trackCount: Int!
    totalPlayCount: Int!
    totalReactions: Int!
    isFollowedByMe: Boolean!

    music(first: Int, after: String): MusicConnection!
    playlists(first: Int, after: String): PlaylistConnection!
    followers(first: Int, after: String): UserConnection!
    following(first: Int, after: String): UserConnection!
  }

  type UserEdge { cursor: String!, node: User! }
  type UserConnection {
    edges: [UserEdge!]!
    nodes: [User!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input UpdateProfileInput {
    displayName: String
    bio: String
    locale: Locale
    mobileNumber: String
  }

  extend type Query {
    me: User
    user(id: ID, username: String): User
    users(query: String, first: Int, after: String): UserConnection!
    "Personalized feed: tracks from users you follow."
    followingFeed(first: Int, after: String): MusicConnection!
  }

  extend type Mutation {
    updateProfile(input: UpdateProfileInput!, profileImage: Upload): User!
    followUser(userId: ID!): User!
    unfollowUser(userId: ID!): User!
  }
`;
