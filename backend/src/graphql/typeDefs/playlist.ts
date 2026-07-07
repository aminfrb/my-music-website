export const playlistTypeDefs = /* GraphQL */ `
  type PlaylistItem {
    id: ID!
    position: Int!
    music: Music!
    addedBy: User
    addedAt: DateTime!
  }

  type Playlist {
    id: ID!
    name: String!
    description: String
    coverUrl: String
    owner: User!
    collaborators: [User!]!
    visibility: PlaylistVisibility!
    mood: Mood
    followersCount: Int!
    trackCount: Int!
    items: [PlaylistItem!]!
    "Share link path (use with publicUrl on the frontend)."
    shareToken: String!
    isFollowedByMe: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PlaylistEdge { cursor: String!, node: Playlist! }
  type PlaylistConnection {
    edges: [PlaylistEdge!]!
    nodes: [Playlist!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreatePlaylistInput {
    name: String!
    description: String
    visibility: PlaylistVisibility
    mood: Mood
  }
  input UpdatePlaylistInput {
    name: String
    description: String
    visibility: PlaylistVisibility
    mood: Mood
  }

  extend type Query {
    playlist(id: ID!): Playlist
    playlistByShareToken(token: String!): Playlist
    userPlaylists(userId: ID!, first: Int, after: String): PlaylistConnection!
    myPlaylists(first: Int, after: String): PlaylistConnection!
    popularPlaylists(limit: Int): [Playlist!]!
  }

  extend type Mutation {
    createPlaylist(input: CreatePlaylistInput!): Playlist!
    updatePlaylist(id: ID!, input: UpdatePlaylistInput!): Playlist!
    deletePlaylist(id: ID!): Boolean!
    addMusicToPlaylist(playlistId: ID!, musicId: ID!): Playlist!
    removeMusicFromPlaylist(playlistId: ID!, musicId: ID!): Playlist!
    reorderPlaylist(playlistId: ID!, musicIds: [ID!]!): Playlist!
    addPlaylistCollaborator(playlistId: ID!, userId: ID!): Playlist!
    removePlaylistCollaborator(playlistId: ID!, userId: ID!): Playlist!
    followPlaylist(playlistId: ID!): Playlist!
    unfollowPlaylist(playlistId: ID!): Playlist!
  }
`;
