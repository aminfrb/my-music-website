# Harmony — Frontend

Bilingual (English / Persian, RTL-aware) web client for the **Harmony** social music
platform. Built with **Next.js (App Router) + React + TypeScript + Tailwind CSS**, talking to
the Harmony GraphQL backend.

## Highlights

- 🎨 **Fully themeable palette** — every color is a CSS variable in `src/app/globals.css`
  (`:root`). Change a few lines there to re-skin the whole app; Tailwind classes
  (`bg-primary`, `text-accent`, `bg-play`, …) pick it up automatically.
- 🌍 **Bilingual & RTL** — instant English/Persian switching from the top bar. `dir`/`lang`
  flip on `<html>`, Persian uses the Vazirmatn font, and numbers/dates localize.
- ▶️ **Persistent global player** — one `<audio>` element lives above every page; playback,
  queue, seek and volume survive navigation. Plays audio directly from the backend's
  short-lived presigned, range-seekable URLs.
- 🔎 Discovery home (trending, fresh, popular, hidden gems, playlists, genres) with infinite
  scroll, personalized **For You**, categorized **search**, **library**/playlists,
  **Divar-style step-by-step upload**, notifications, profiles, and an **admin** dashboard.
- 🔐 Email + password auth with silent access-token refresh.

## Prerequisites

- Node.js ≥ 20
- The Harmony **backend** running (default `http://localhost:4000/graphql`).

## Setup

```bash
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_URL at your backend
npm install
npm run dev                        # http://localhost:3000
```

> The backend's `CORS_ORIGINS` already allows `http://localhost:3000`.

Seeded backend accounts (password `password123`): `admin@harmony.dev`, `sara@harmony.dev`,
`nima@harmony.dev`, `leo@harmony.dev`.

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server with hot reload       |
| `npm run build`     | Production build                 |
| `npm start`         | Serve the production build       |
| `npm run typecheck` | Strict TypeScript check, no emit |

## Re-theming

Open `src/app/globals.css` and edit the tokens under `:root`:

```css
--color-primary: #8b5cf6;   /* brand */
--color-accent:  #f472b6;   /* secondary */
--color-play:    #22c55e;   /* play / CTA */
--color-bg:      #08080f;   /* app background */
/* …surfaces, text, fonts, radius… */
```

Fonts are set via `--font-heading` / `--font-body` in the same block.

## Project layout

```
src/
  app/                 App Router pages (home, login, register, for-you, search,
                       library, upload, notifications, music/[id], playlist/[id],
                       u/[id], me, genre/[slug], admin) + globals.css
  components/
    layout/            AppShell, Sidebar, TopBar, PlayerBar, RequireAuth
    music/             MusicCard, MusicRow, MusicRail, PlaylistCard, ReactionBar, TrackActions
    profile/           ProfileView
    ui/                Button, Input, Avatar, Cover, Modal, States
  providers/           Providers (React Query) + Auth, Locale, Player contexts
  i18n/                en/fa dictionaries, reactions, moods
  lib/                 graphql client, queries, types, formatters, cn
```

## Notes

- Media (covers/avatars/audio) render with plain `<img>`/`<audio>` since they come from
  presigned URLs with query strings — no `next/image` remote config needed.
- Play counts are recorded automatically after ~15s of listening or on track completion.
- Profile-image and playlist-cover multipart uploads are intentionally out of scope here; the
  music upload flow uses the backend's presigned PUT URLs end-to-end.
