# Spidermelody — Frontend

Bilingual (English / Persian, RTL-aware) web client for the **Spidermelody** social music
platform. Built with **Next.js (App Router) + React + TypeScript + Tailwind CSS**, talking to
the Spidermelody GraphQL backend.

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
- 💬 **Realtime direct messages** — chat with other users over a native
  WebSocket (typing indicators, unread badges, live delivery). Each profile can
  turn messaging on/off in **Edit profile**; the Message button and sending are
  blocked when a user opts out.
- 🔐 Email + password auth with silent access-token refresh.

## Prerequisites

- Node.js ≥ 20
- The Spidermelody **backend** running (default `http://localhost:4000/graphql`).

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

| Script               | Purpose                          |
| -------------------- | -------------------------------- |
| `npm run dev`        | Dev server with hot reload       |
| `npm run build`      | Production build                 |
| `npm start`          | Serve the production build       |
| `npm run typecheck`  | Strict TypeScript check, no emit |
| `npm test`           | Run every test once              |
| `npm run test:watch` | Re-run affected tests on change  |

## Tests

Vitest + React Testing Library, in jsdom. No server or database needed —
`npm test` runs standalone in a couple of seconds.

```
tests/
  unit/         formatting, the client-side name check, dictionary integrity,
                and the GraphQL client (token refresh, error details)
  components/   ProfileView, PlaylistPage, DuplicateNotice, SuggestedUserRail,
                MusicCard, InlineError, LocaleProvider
  helpers/      provider-aware render, fixtures
```

Worth knowing when adding cases:

- Components read copy through `useLocale`, so render them with
  `renderWithProviders(ui, { locale })` rather than asserting around missing
  context. Persian assertions are part of the suite, not an afterthought —
  RTL and Persian digits are easy to regress.
- `tsconfig.json` sets `jsx: "preserve"` because Next owns the transform in the
  app build. Nothing does that under Vitest, so `vitest.config.ts` sets
  `esbuild.jsx: "automatic"`.
- `next/link` is stubbed to a plain anchor in `tests/setup.tsx`; the real one
  needs App Router context, and every assertion here is about the `href`.
- Page-level specs stub `useAuth` and `usePlayer` per file, so a test can say
  who is signed in (owner / other user / signed out) without building a session.
- A playlist page renders one "Play" button per row plus the header's, all with
  the same accessible name — scope those queries to a section rather than
  reaching for `getAllBy…[0]`.
- Stub the network with `mockApi()` (`tests/helpers/api.ts`) rather than mocking
  the `gql` module. Mocking `gql` means a failure case has to hand back a
  rejected promise, which the runner reports as an unhandled error even though
  the component handled it. Stubbing `fetch` avoids that and is more faithful:
  the real client runs, so `GraphQLError` construction and the
  `extensions.details` channel are exercised rather than assumed.

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
