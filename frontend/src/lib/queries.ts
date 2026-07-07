// Central store of GraphQL operation documents, composed from shared fragments.

export const USER_FIELDS = /* GraphQL */ `
  fragment UserFields on User {
    id
    displayName
    email
    bio
    locale
    role
    status
    isVerifiedArtist
    isTrusted
    avatarUrl
    joinDate
    followerCount
    followingCount
    trackCount
    totalPlayCount
    totalReactions
    isFollowedByMe
    allowMessages
  }
`;

export const MUSIC_FIELDS = /* GraphQL */ `
  fragment MusicFields on Music {
    id
    title
    artistName
    description
    duration
    tags
    status
    playCount
    saveCount
    reactionCount
    coverUrl
    streamUrl
    myReaction
    createdAt
    publishedAt
    reactionBreakdown {
      type
      count
    }
    genre {
      id
      slug
      name
    }
    uploader {
      id
      displayName
      avatarUrl
      isVerifiedArtist
    }
  }
`;

export const PLAYLIST_CARD_FIELDS = /* GraphQL */ `
  fragment PlaylistCardFields on Playlist {
    id
    name
    description
    coverUrl
    visibility
    mood
    followersCount
    trackCount
    isFollowedByMe
    owner {
      id
      displayName
      avatarUrl
    }
  }
`;

/* ----------------------------------- Auth ----------------------------------- */

export const LOGIN = /* GraphQL */ `
  ${USER_FIELDS}
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
`;

export const REGISTER = /* GraphQL */ `
  ${USER_FIELDS}
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user { ...UserFields }
    }
  }
`;

export const ME = /* GraphQL */ `
  ${USER_FIELDS}
  query Me {
    me { ...UserFields }
  }
`;

export const LOGOUT = /* GraphQL */ `
  mutation Logout($refreshToken: String) {
    logout(refreshToken: $refreshToken)
  }
`;

/* --------------------------------- Discovery -------------------------------- */

export const HOME_SECTIONS = /* GraphQL */ `
  ${MUSIC_FIELDS}
  ${PLAYLIST_CARD_FIELDS}
  query HomeSections {
    trendingMusic(limit: 12) { ...MusicFields }
    todayPopularMusic(limit: 12) { ...MusicFields }
    weekMostReactedMusic(limit: 12) { ...MusicFields }
    lessDiscoveredMusic(limit: 12) { ...MusicFields }
    popularPlaylists(limit: 10) { ...PlaylistCardFields }
    genres { id slug name trackCount }
  }
`;

export const LATEST_MUSIC = /* GraphQL */ `
  ${MUSIC_FIELDS}
  query LatestMusic($first: Int, $after: String) {
    latestMusic(first: $first, after: $after) {
      nodes { ...MusicFields }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const MUSIC_DETAIL = /* GraphQL */ `
  ${MUSIC_FIELDS}
  query MusicDetail($id: ID!) {
    music(id: $id) {
      ...MusicFields
      fileSize
      mimeType
      visibility
      similar(limit: 8) { ...MusicFields }
    }
  }
`;

export const GENRE_DETAIL = /* GraphQL */ `
  ${MUSIC_FIELDS}
  query GenreDetail($slug: String!) {
    genre(slug: $slug) {
      id
      slug
      name
      trackCount
    }
  }
`;

export const RECOMMENDATION_SECTIONS = /* GraphQL */ `
  ${MUSIC_FIELDS}
  query RecommendationSections {
    recommendationSections {
      forYou { ...MusicFields }
      similarToSaved { ...MusicFields }
      basedOnGenres { ...MusicFields }
      popularAmongSimilar { ...MusicFields }
      newReleases { ...MusicFields }
      newDiscovery { ...MusicFields }
    }
  }
`;

export const FOLLOWING_FEED = /* GraphQL */ `
  ${MUSIC_FIELDS}
  query FollowingFeed($first: Int, $after: String) {
    followingFeed(first: $first, after: $after) {
      nodes { ...MusicFields }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

/* ---------------------------------- Search ---------------------------------- */

export const SEARCH = /* GraphQL */ `
  ${MUSIC_FIELDS}
  ${PLAYLIST_CARD_FIELDS}
  ${USER_FIELDS}
  query Search($query: String!, $perCategory: Int) {
    search(query: $query, perCategory: $perCategory) {
      music { ...MusicFields }
      playlists { ...PlaylistCardFields }
      users { ...UserFields }
      genres { id slug name trackCount }
      tags { id name usageCount }
    }
  }
`;

/* -------------------------------- Interactions ------------------------------ */

export const RECORD_PLAY = /* GraphQL */ `
  mutation RecordPlay($musicId: ID!, $seconds: Int) {
    recordPlay(musicId: $musicId, seconds: $seconds) { id playCount }
  }
`;

export const REACT = /* GraphQL */ `
  mutation React($musicId: ID!, $type: ReactionType!) {
    reactToMusic(musicId: $musicId, type: $type) {
      id
      reactionCount
      myReaction
      reactionBreakdown { type count }
    }
  }
`;

export const REPORT_MUSIC = /* GraphQL */ `
  mutation ReportMusic($input: ReportInput!) {
    reportMusic(input: $input) { id status }
  }
`;

/* --------------------------------- Playlists -------------------------------- */

export const MY_PLAYLISTS = /* GraphQL */ `
  ${PLAYLIST_CARD_FIELDS}
  query MyPlaylists($first: Int, $after: String) {
    myPlaylists(first: $first, after: $after) {
      nodes { ...PlaylistCardFields }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
  }
`;

export const PLAYLIST_DETAIL = /* GraphQL */ `
  ${MUSIC_FIELDS}
  ${PLAYLIST_CARD_FIELDS}
  query PlaylistDetail($id: ID!) {
    playlist(id: $id) {
      ...PlaylistCardFields
      shareToken
      createdAt
      collaborators { id displayName avatarUrl }
      items {
        id
        position
        music { ...MusicFields }
      }
    }
  }
`;

export const CREATE_PLAYLIST = /* GraphQL */ `
  ${PLAYLIST_CARD_FIELDS}
  mutation CreatePlaylist($input: CreatePlaylistInput!) {
    createPlaylist(input: $input) { ...PlaylistCardFields }
  }
`;

export const ADD_TO_PLAYLIST = /* GraphQL */ `
  mutation AddToPlaylist($playlistId: ID!, $musicId: ID!) {
    addMusicToPlaylist(playlistId: $playlistId, musicId: $musicId) {
      id
      trackCount
    }
  }
`;

export const REMOVE_FROM_PLAYLIST = /* GraphQL */ `
  mutation RemoveFromPlaylist($playlistId: ID!, $musicId: ID!) {
    removeMusicFromPlaylist(playlistId: $playlistId, musicId: $musicId) {
      id
      trackCount
    }
  }
`;

export const FOLLOW_PLAYLIST = /* GraphQL */ `
  mutation FollowPlaylist($playlistId: ID!) {
    followPlaylist(playlistId: $playlistId) { id isFollowedByMe followersCount }
  }
`;

export const UNFOLLOW_PLAYLIST = /* GraphQL */ `
  mutation UnfollowPlaylist($playlistId: ID!) {
    unfollowPlaylist(playlistId: $playlistId) { id isFollowedByMe followersCount }
  }
`;

/* ---------------------------------- Profile --------------------------------- */

export const USER_PROFILE = /* GraphQL */ `
  ${USER_FIELDS}
  ${MUSIC_FIELDS}
  query UserProfile($id: ID!) {
    user(id: $id) {
      ...UserFields
      music(first: 24) {
        nodes { ...MusicFields }
        totalCount
      }
    }
  }
`;

export const UPDATE_PROFILE = /* GraphQL */ `
  ${USER_FIELDS}
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) { ...UserFields }
  }
`;

export const FOLLOW_USER = /* GraphQL */ `
  mutation FollowUser($userId: ID!) {
    followUser(userId: $userId) { id isFollowedByMe followerCount }
  }
`;

export const UNFOLLOW_USER = /* GraphQL */ `
  mutation UnfollowUser($userId: ID!) {
    unfollowUser(userId: $userId) { id isFollowedByMe followerCount }
  }
`;

/* ------------------------------- Notifications ------------------------------ */

export const NOTIFICATIONS = /* GraphQL */ `
  query Notifications($first: Int, $after: String) {
    notifications(first: $first, after: $after) {
      nodes {
        id
        type
        title
        message
        relatedKind
        relatedId
        isRead
        createdAt
      }
      pageInfo { hasNextPage endCursor }
      totalCount
    }
    unreadNotificationCount
  }
`;

export const UNREAD_COUNT = /* GraphQL */ `
  query UnreadCount {
    unreadNotificationCount
  }
`;

export const MARK_ALL_READ = /* GraphQL */ `
  mutation MarkAllRead {
    markAllNotificationsRead
  }
`;

/* ---------------------------------- Upload ---------------------------------- */

export const UPLOAD_GENRES = /* GraphQL */ `
  query UploadGenres {
    genres { id slug name }
  }
`;

export const CREATE_UPLOAD_SESSION = /* GraphQL */ `
  mutation CreateUploadSession {
    createUploadSession { id step status }
  }
`;

export const REQUEST_AUDIO_UPLOAD = /* GraphQL */ `
  mutation RequestAudioUpload($sessionId: ID!, $contentType: String) {
    requestAudioUpload(sessionId: $sessionId, contentType: $contentType) {
      key
      url
      session { id step }
    }
  }
`;

export const FINALIZE_AUDIO_UPLOAD = /* GraphQL */ `
  mutation FinalizeAudioUpload($sessionId: ID!) {
    finalizeAudioUpload(sessionId: $sessionId) {
      id
      step
      audio { mimeType size duration finalized }
    }
  }
`;

export const REQUEST_COVER_UPLOAD = /* GraphQL */ `
  mutation RequestCoverUpload($sessionId: ID!, $contentType: String) {
    requestCoverUpload(sessionId: $sessionId, contentType: $contentType) {
      key
      url
      session { id }
    }
  }
`;

export const FINALIZE_COVER_UPLOAD = /* GraphQL */ `
  mutation FinalizeCoverUpload($sessionId: ID!) {
    finalizeCoverUpload(sessionId: $sessionId) {
      id
      cover { finalized mimeType }
    }
  }
`;

export const SET_UPLOAD_METADATA = /* GraphQL */ `
  mutation SetUploadMetadata($sessionId: ID!, $input: UploadMetadataInput!) {
    setUploadMetadata(sessionId: $sessionId, input: $input) {
      id
      step
      metadata { title artistName tags visibility genre { id name } }
    }
  }
`;

export const PUBLISH_UPLOAD = /* GraphQL */ `
  mutation PublishUpload($sessionId: ID!) {
    publishUpload(sessionId: $sessionId) { id title status }
  }
`;

/* ----------------------------------- Admin ---------------------------------- */

export const ADMIN_OVERVIEW = /* GraphQL */ `
  query AdminOverview {
    adminOverview {
      totalUsers
      blockedUsers
      totalMusic
      pendingMusic
      publishedMusic
      openReports
      totalPlays
      activeUsers24h
    }
  }
`;

export const ADMIN_QUEUE = /* GraphQL */ `
  ${MUSIC_FIELDS}
  query AdminQueue($status: MusicStatus) {
    adminMusicQueue(status: $status, first: 30) {
      nodes { ...MusicFields status }
      totalCount
    }
  }
`;

export const ADMIN_REVIEW_MUSIC = /* GraphQL */ `
  mutation AdminReviewMusic($musicId: ID!, $action: ReviewAction!, $note: String) {
    adminReviewMusic(musicId: $musicId, action: $action, note: $note) {
      id
      status
    }
  }
`;

/* ── Direct messages ─────────────────────────────────────────────── */

export const CONVERSATIONS = /* GraphQL */ `
  query Conversations {
    conversations {
      id
      lastMessage
      lastMessageAt
      unreadCount
      otherUser {
        id
        displayName
        avatarUrl
        isVerifiedArtist
      }
    }
  }
`;

export const UNREAD_MESSAGES = /* GraphQL */ `
  query UnreadMessages {
    unreadMessageCount
  }
`;

export const MESSAGES_WITH = /* GraphQL */ `
  query MessagesWith($userId: ID!, $first: Int, $after: String) {
    messagesWith(userId: $userId, first: $first, after: $after) {
      nodes {
        id
        body
        mine
        isRead
        createdAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const MESSAGE_PEER = /* GraphQL */ `
  query MessagePeer($id: ID!) {
    user(id: $id) {
      id
      displayName
      avatarUrl
      isVerifiedArtist
      allowMessages
    }
  }
`;

export const SEND_MESSAGE = /* GraphQL */ `
  mutation SendMessage($toUserId: ID!, $body: String!) {
    sendMessage(toUserId: $toUserId, body: $body) {
      id
      body
      mine
      isRead
      createdAt
    }
  }
`;

export const MARK_CONVERSATION_READ = /* GraphQL */ `
  mutation MarkConversationRead($userId: ID!) {
    markConversationRead(userId: $userId)
  }
`;

export const CAN_MESSAGE = /* GraphQL */ `
  query CanMessage($userId: ID!) {
    canMessage(userId: $userId)
  }
`;

export const SET_ALLOW_MESSAGES = /* GraphQL */ `
  mutation SetAllowMessages($allow: Boolean!) {
    setAllowMessages(allow: $allow) {
      id
      allowMessages
    }
  }
`;
