# Harmony — Backend

Backend for **Harmony**, a bilingual (English / Persian) social music platform: upload, discover,
play, save, react, and get personalized recommendations — with first-class **upload security** and
**content moderation**.

**Stack:** Node.js + TypeScript · GraphQL (Apollo Server 4) · **MongoDB + Mongoose** ·
**S3-compatible storage** (MinIO locally) · JWT (email + password) auth.

> Auth is **email + password only** (no OTP / mobile verification).

## Features

- **Auth** — register / login with email + password, JWT access + rotating refresh tokens, roles (user / admin).
- **Profiles** — display name, bio, avatar, mobile number, language, verified-artist & trusted flags; follower/following/play/reaction totals.
- **Step-by-step upload (Divar-style)** via `UploadSession` using **presigned S3 URLs**:
  request URL → client uploads directly → server **finalizes** by streaming the object to
  **sniff the real mime-type** (magic numbers, not the client's claim), enforce size limits, and
  compute a **SHA-256 hash for duplicate detection** → set metadata → publish.
- **Upload limits & security** — per-user **daily upload caps** (stricter for new accounts, higher for trusted), file-size & format limits (mp3/wav/m4a), **banned-tag/banned-content checks**, duplicate prevention.
- **Content moderation** — `pending → published / rejected / blocked`, admin review queue, user **reports**.
- **Discovery / homepage** — latest (infinite scroll), trending, today's popular, week's most-reacted, less-discovered, popular playlists.
- **Reactions** — 8 emoji types (like, fire, headphone, star, energy, calm, sad, repeat); one active per user; toggle/replace.
- **Playlists** — public / private / unlisted, share links, collaborators, follow playlists, reorder.
- **Social** — follow users, personalized following-feed.
- **Recommendations** — rule-based engine driven by a per-user `RecommendationProfile` built from `MusicInteraction` history (plays, completes, skips, saves, reactions, follows). Sections: For You, Similar to saved, Based on your genres, Popular among similar users, New releases for you, New discovery.
- **Search** — categorized cross-entity (music / users / playlists / genres / tags) with **Persian normalization** (ي→ی، ك→ک, digit folding).
- **Uploader stats** — per-track plays/saves/reactions, most-received reaction, completion rate, daily-play chart.
- **Notifications** — published/rejected, saved, reaction, new follower, playlist followed (rendered in the recipient's locale).
- **Admin** — users (block / trust / verify / role), moderation queue & review, reports, genres, banned tags, platform overview stats.
- **Bilingual** — localized error/notification messages + genre names; locale via `x-locale` / `Accept-Language`.

## Prerequisites

- Node.js ≥ 20
- Docker (for MongoDB + MinIO) — or your own MongoDB + S3-compatible storage.

## Setup

```bash
cp .env.example .env
docker compose up -d        # MongoDB + MinIO (+ auto-creates the media bucket)

npm install
npm run db:seed             # sample users, genres, tracks, playlists, interactions
npm run dev                 # http://localhost:4000/graphql
```

MinIO console: <http://localhost:9001> (user `harmony`, password `harmony-secret`).

### Seeded accounts (password `password123`)

| Email               | Role  |
| ------------------- | ----- |
| `admin@harmony.dev` | admin |
| `sara@harmony.dev`  | user  |
| `nima@harmony.dev`  | user (verified artist) |
| `leo@harmony.dev`   | user  |

## Using the API

Open <http://localhost:4000/graphql> in a browser — it serves a **built-in offline GraphQL
console** (no internet/CDN required, unlike Apollo Sandbox). Paste an access token and pick a
locale in the top bar, write a query, and press Run (Ctrl/⌘+Enter). `POST /graphql` is the API
itself; you can also use curl / Postman / the frontend client.

Authenticate with headers:

```
Authorization: Bearer <accessToken from login/register>
x-locale: fa            # optional — switches error/content language
```

### Log in

```graphql
mutation {
  login(input: { email: "sara@harmony.dev", password: "password123" }) {
    accessToken
    user { id displayName }
  }
}
```

### Upload a track (step-by-step with presigned URLs)

```graphql
mutation { createUploadSession { id } }                       # 1) start
mutation { requestAudioUpload(sessionId: "<id>") { url key } } # 2) get presigned PUT URL
# 2b) PUT the file bytes to that URL:  curl -X PUT --data-binary @song.mp3 "<url>"
mutation { finalizeAudioUpload(sessionId: "<id>") { audio { mimeType size finalized } } } # 3) validate
mutation {                                                     # 4) metadata
  setUploadMetadata(sessionId: "<id>", input: {
    title: "My Song", artistName: "Me", genreId: "<genreId>", tags: ["demo"]
  }) { step }
}
mutation { publishUpload(sessionId: "<id>") { id status } }    # 5) publish (-> pending)
```

The track lands in `pending`; an admin publishes it with `adminReviewMusic(musicId, action: approve)`.

**Security check:** `finalizeAudioUpload` rejects a non-audio file (e.g. a renamed `.txt`) with
`BAD_USER_INPUT`, because the bytes aren't real audio — the client's filename/content-type is never trusted.

## Project layout

```
src/
  config/        typed env loader
  constants/     shared enums / literal unions
  db/            mongoose connection
  models/        Mongoose schemas (User, Music, Playlist, Reaction, Follow, Report,
                 Genre, Tag, MusicInteraction, RecommendationProfile, Notification, UploadSession, …)
  auth/          password hashing + JWT
  upload/        magic-number validation, S3 storage (presign + hash/sniff), multipart processing
  i18n/          locale resolution + en/fa catalogs
  middleware/    rate limiting
  services/      business logic (auth, user, upload, music, reaction, follow, playlist,
                 report, interaction, recommendation, notification, search, stats, catalog, admin)
  graphql/       typeDefs (SDL) + resolvers + assembled schema
  context.ts     per-request context (auth user, locale, guards)
  index.ts       Express + Apollo bootstrap
  seed.ts        sample data
scripts/         one-off maintenance jobs (data backfills)
tests/
  unit/          pure logic — no database (naming rules, audio probing, text
                 normalization, rate limiting, recommendation scoring)
  integration/   real MongoDB (upload flow, duplicate detection, play counting,
                 the recommendation engine)
  helpers/       db lifecycle, document factories, synthetic audio, fake contexts
```

## Scripts

| Script                     | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `npm run dev`              | Start with hot reload (tsx)                 |
| `npm run build`            | Compile to `dist/`                          |
| `npm start`                | Run compiled server                         |
| `npm run typecheck`        | Strict type-check of `src/`, no emit        |
| `npm run typecheck:test`   | Strict type-check of the test suite         |
| `npm test`                 | Run every test once                         |
| `npm run test:watch`       | Re-run affected tests on change             |
| `npm run test:unit`        | Unit tests only — never touches a database  |
| `npm run test:integration` | Integration tests only                      |
| `npm run db:seed`          | Seed sample data                            |

## Tests

```bash
docker compose up -d mongo   # integration tests need a real MongoDB
npm test
```

`npm test` always works. Unit tests have no dependencies; the integration
tests probe for MongoDB and **skip cleanly** when there isn't one, so a
missing database never shows up as a failure:

```
Test Files  5 passed | 4 skipped (9)
     Tests  124 passed | 74 skipped (198)
```

They run against `TEST_MONGODB_URI` (default `mongodb://localhost:27017/harmony_test`)
and clear every collection between cases, so they never touch the dev database.

There is deliberately no in-memory Mongo package: those download a `mongod`
binary from a foreign CDN during install, which isn't dependable on every
network this project is developed on. The compose service is already there.

A few things worth knowing when adding cases:

- Mongoose marks `createdAt` **immutable** under `timestamps`, so an ordinary
  `updateOne` on it is silently ignored (`modifiedCount: 0`). Use the
  `backdate()` helper, which goes through the native driver — anything testing
  a time window needs it.
- The rate limiters and the play cooldown are process-global. Clear them in
  `beforeEach` or state leaks between cases.
- Synthetic audio (`tests/helpers/audio.ts`) is built byte by byte, so a test
  can ask for an exact duration and keep binaries out of the repo.

## Environment

See `.env.example`. Key vars: `MONGODB_URI`, `JWT_*`, the `DAILY_UPLOAD_LIMIT*` caps,
`AUTO_PUBLISH`, the `S3_*` storage settings, and `DEFAULT_LOCALE` / `SUPPORTED_LOCALES`.

## Notes for the frontend phase (Vue + Pinia)

- The schema is introspectable at `/graphql`; generate a typed client against it.
- Media is served via short-lived **presigned URLs** (`PRESIGN_GET_TTL`) that support HTTP Range,
  so the global `<audio>` player can seek directly against storage.
- All user-facing strings come from the i18n catalogs / GraphQL `name`/`bio`/error fields — the UI
  should drive RTL/LTR from the active locale.
- Direct file uploads (avatar, playlist cover) also accept multipart via the `Upload` scalar
  (needs the `apollo-require-preflight: true` header).
- Swap the in-memory rate limiter (`src/middleware/rateLimit.ts`) for Redis when scaling out.

## Roadmap (post-MVP)

Advanced/ML recommendations, trending decay scoring, collaborative-playlist real-time editing,
richer notifications (push/email), audio transcoding + server-side duration extraction (ffprobe),
full-text Atlas Search, and analytics dashboards.
