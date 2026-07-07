/**
 * Centralized enums / literal unions shared across models, services, and the
 * GraphQL layer. Keeping them here (rather than per-model) avoids drift between
 * Mongoose schema `enum` arrays and TypeScript types.
 */

export const ROLES = ["user", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const LOCALES = ["en", "fa"] as const;
export type Locale = (typeof LOCALES)[number];

export const USER_STATUSES = ["active", "blocked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// Music moderation lifecycle (content management).
export const MUSIC_STATUSES = ["pending", "published", "rejected", "blocked"] as const;
export type MusicStatus = (typeof MUSIC_STATUSES)[number];

export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const PLAYLIST_VISIBILITIES = ["public", "private", "unlisted"] as const;
export type PlaylistVisibility = (typeof PLAYLIST_VISIBILITIES)[number];

export const REACTION_TYPES = [
  "like",
  "fire",
  "headphone",
  "star",
  "energy",
  "calm",
  "sad",
  "repeat",
] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REPORT_REASONS = [
  "inappropriate_content",
  "copyright",
  "inappropriate_title_or_cover",
  "broken_file",
  "spam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["pending", "reviewed", "resolved", "rejected"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const INTERACTION_TYPES = [
  "play",
  "complete_play",
  "skip",
  "add_to_playlist",
  "remove_from_playlist",
  "reaction",
  "share",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "music_published",
  "music_rejected",
  "music_saved",
  "music_reaction",
  "new_follower",
  "playlist_followed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const MOODS = ["focus", "energy", "night", "road", "study", "calm"] as const;
export type Mood = (typeof MOODS)[number];

// Built-in genres (slugs). Genre documents are seeded with bilingual names; tags
// remain free-form. Admins can extend genres at runtime.
export const GENRE_SLUGS = [
  "pop",
  "rap",
  "traditional",
  "rock",
  "electronic",
  "instrumental",
  "podcast",
  "religious",
  "local",
  "classic",
  "other",
] as const;
export type GenreSlug = (typeof GENRE_SLUGS)[number];

export const UPLOAD_SESSION_STATUSES = ["draft", "completed", "published", "cancelled"] as const;
export type UploadSessionStatus = (typeof UPLOAD_SESSION_STATUSES)[number];

// Allowed audio formats (extension → canonical mime). Cover images handled in upload/validation.
export const ALLOWED_AUDIO = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
} as const;
