// Types mirroring the Spidermelody GraphQL schema (the subset the frontend consumes).

export type Locale = "en" | "fa";
export type Role = "user" | "admin";
export type UserStatus = "active" | "blocked";
export type MusicStatus = "pending" | "published" | "rejected" | "blocked";
export type Visibility = "public" | "private";
export type PlaylistVisibility = "public" | "private" | "unlisted";
export type ReactionType =
  | "like"
  | "fire"
  | "headphone"
  | "star"
  | "energy"
  | "calm"
  | "sad"
  | "repeat";
export type Mood = "focus" | "energy" | "night" | "road" | "study" | "calm";
export type NotificationType =
  | "music_published"
  | "music_rejected"
  | "music_saved"
  | "music_reaction"
  | "new_follower"
  | "playlist_followed";
export type ReportReason =
  | "inappropriate_content"
  | "copyright"
  | "inappropriate_title_or_cover"
  | "broken_file"
  | "spam"
  | "other";

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Genre {
  id: string;
  slug: string;
  nameEn: string;
  nameFa: string;
  name: string;
  isActive: boolean;
  trackCount: number;
}

export interface Tag {
  id: string;
  name: string;
  usageCount: number;
  isBanned: boolean;
}

export interface User {
  id: string;
  displayName: string;
  email?: string | null;
  mobileNumber?: string | null;
  bio?: string | null;
  locale: Locale;
  role: Role;
  status: UserStatus;
  isVerifiedArtist: boolean;
  isTrusted: boolean;
  avatarUrl?: string | null;
  joinDate: string;
  followerCount: number;
  followingCount: number;
  trackCount: number;
  totalPlayCount: number;
  totalReactions: number;
  isFollowedByMe: boolean;
}

export interface ReactionCount {
  type: ReactionType;
  count: number;
}

export interface Music {
  id: string;
  title: string;
  artistName: string;
  description?: string | null;
  duration: number;
  fileSize: number;
  mimeType: string;
  tags: string[];
  status: MusicStatus;
  visibility: Visibility;
  playCount: number;
  saveCount: number;
  reactionCount: number;
  reactionBreakdown: ReactionCount[];
  coverUrl?: string | null;
  streamUrl: string;
  uploader: User;
  genre: Genre;
  myReaction?: ReactionType | null;
  moderationNote?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistItem {
  id: string;
  position: number;
  music: Music;
  addedBy?: User | null;
  addedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  owner: User;
  collaborators: User[];
  visibility: PlaylistVisibility;
  mood?: Mood | null;
  followersCount: number;
  trackCount: number;
  items: PlaylistItem[];
  shareToken: string;
  isFollowedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedKind?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RecommendationSections {
  forYou: Music[];
  similarToSaved: Music[];
  basedOnGenres: Music[];
  popularAmongSimilar: Music[];
  newReleases: Music[];
  newDiscovery: Music[];
}

export interface SearchResult {
  music: Music[];
  users: User[];
  playlists: Playlist[];
  genres: Genre[];
  tags: Tag[];
}

export interface AdminOverview {
  totalUsers: number;
  blockedUsers: number;
  totalMusic: number;
  pendingMusic: number;
  publishedMusic: number;
  openReports: number;
  totalPlays: number;
  activeUsers24h: number;
}

// Upload session flow
export interface UploadAsset {
  key: string;
  mimeType?: string | null;
  size?: number | null;
  duration?: number | null;
  finalized: boolean;
}
export interface UploadMetadata {
  title?: string | null;
  artistName?: string | null;
  description?: string | null;
  genre?: Genre | null;
  tags: string[];
  visibility: Visibility;
}
export interface UploadSession {
  id: string;
  status: string;
  step: number;
  audio?: UploadAsset | null;
  cover?: UploadAsset | null;
  metadata: UploadMetadata;
  music?: Music | null;
  createdAt: string;
  updatedAt: string;
}
export interface PresignedUpload {
  session: UploadSession;
  key: string;
  url: string;
}
