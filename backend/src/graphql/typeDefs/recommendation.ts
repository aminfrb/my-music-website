export const recommendationTypeDefs = /* GraphQL */ `
  type RecommendationProfile {
    favoriteGenres: [Genre!]!
    favoriteTags: [String!]!
    favoriteArtists: [String!]!
    averageListenDuration: Int!
    preferredMood: Mood
    updatedAt: DateTime
  }

  """
  A recommended track together with why it was chosen. The reason is what the
  UI shows under the card ("Because you follow Sara"), and doubles as the
  ranker's own explanation of which signal won.
  """
  type RecommendedTrack {
    music: Music!
    "Stable identifier for the winning signal, e.g. followedUploader."
    reasonKey: String!
    "The same reason, localized for the request."
    reason: String!
    score: Float!
  }

  "A person worth following, and what makes them a good match."
  type SuggestedUser {
    user: User!
    reasonKey: String!
    reason: String!
    "How many of the people you follow also follow them."
    mutualCount: Int!
    "Genres you both listen to."
    sharedGenres: [Genre!]!
  }

  "All recommendation rows for the 'For You' page."
  type RecommendationSections {
    forYou: [Music!]!
    similarToSaved: [Music!]!
    basedOnGenres: [Music!]!
    popularAmongSimilar: [Music!]!
    newReleases: [Music!]!
    newDiscovery: [Music!]!
    "Tracks the people you follow have reacted to or saved."
    becauseYouFollow: [Music!]!
    "Music in the genres your network listens to."
    genresFromYourNetwork: [Music!]!
    "More from artists you keep returning to."
    fromArtistsYouLike: [Music!]!
    "People worth following, ranked by shared taste."
    suggestedUsers: [SuggestedUser!]!
  }

  extend type Query {
    "Main personalized recommendations (the 'For You' row)."
    recommendations(limit: Int): [Music!]!
    "The same ranking, but each track carries the reason it was picked."
    recommendationFeed(limit: Int): [RecommendedTrack!]!
    "Every recommendation section in one call."
    recommendationSections(limit: Int): RecommendationSections!
    recommendationProfile: RecommendationProfile
    "People to follow, based on shared taste and your network."
    suggestedUsers(limit: Int): [SuggestedUser!]!
  }
`;
