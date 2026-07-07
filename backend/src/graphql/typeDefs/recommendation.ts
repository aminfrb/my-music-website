export const recommendationTypeDefs = /* GraphQL */ `
  type RecommendationProfile {
    favoriteGenres: [Genre!]!
    favoriteTags: [String!]!
    favoriteArtists: [String!]!
    averageListenDuration: Int!
    preferredMood: Mood
    updatedAt: DateTime
  }

  "All recommendation rows for the 'For You' page."
  type RecommendationSections {
    forYou: [Music!]!
    similarToSaved: [Music!]!
    basedOnGenres: [Music!]!
    popularAmongSimilar: [Music!]!
    newReleases: [Music!]!
    newDiscovery: [Music!]!
  }

  extend type Query {
    "Main personalized recommendations (the 'For You' row)."
    recommendations(limit: Int): [Music!]!
    "Every recommendation section in one call."
    recommendationSections(limit: Int): RecommendationSections!
    recommendationProfile: RecommendationProfile
  }
`;
