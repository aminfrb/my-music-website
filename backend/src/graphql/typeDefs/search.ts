export const searchTypeDefs = /* GraphQL */ `
  "Categorized cross-entity search results."
  type SearchResult {
    music: [Music!]!
    users: [User!]!
    playlists: [Playlist!]!
    genres: [Genre!]!
    tags: [Tag!]!
  }

  extend type Query {
    "Search music, users, playlists, genres and tags (Persian-normalized)."
    search(query: String!, perCategory: Int): SearchResult!
  }
`;
