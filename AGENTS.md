<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## NIFTY FII/DII terminal

Single-page Next.js 16 app (App Router, React 19, TS strict): multi-pane NIFTY 50
chart (lightweight-charts v5) with FII/DII/FII+DII institutional-flow panes.

### Auth (Google OAuth via NextAuth v5)
- `/` is the login page (redirects to `/home` when signed in); `/home` is the
  protected terminal (redirects to `/` when signed out). Google sign-in is
  client-side only (`signIn("google")` from `next-auth/react`) — the NextAuth v5
  server-action `signIn` is broken on Next.js 16.
- NextAuth config lives in `src/lib/auth.ts` (exports `handlers/auth/signIn/signOut`),
  handler at `src/app/api/auth/[...nextauth]/route.ts`.
- Users are upserted into the MongoDB `users` collection by `src/lib/user.ts`.
- A custom HS256 JWT (1-day expiry, `src/lib/jwt.ts`, `jose`) is minted by
  `GET /api/auth/jwt` and stored by the client in `localStorage["niftyfd_token"]`
  (`src/components/signed-in-bar.tsx`). Verify with `verifyUserToken` for any
  new authenticated API.
- Env: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, optional `JWT_SECRET`
  (falls back to `AUTH_SECRET`). See `.env.example`.

### Commands
- `npm run dev` — dev server (works without MongoDB)
- `npm run lint` — ESLint (flat config `eslint.config.mjs`)
- `npm run build` — build + typecheck; there is NO `typecheck` script and no test framework

### Architecture & data flow
- `src/app/api/series/route.ts` is the only market API: `{ records }` on success,
  `{ error }` + 502 on failure; serves the last good in-memory series when a fresh
  fetch fails.
- `src/lib/nifty-data.ts` — server-only. Fetches 2y of `^NSEI` daily OHLCV from Yahoo
  Finance (retries across `query1`/`query2` hosts), FII/DII from MR Chartist
  (best-effort, errors swallowed), 1h cache. Today's bar is excluded until after 16:00 IST.
- `src/lib/mongodb.ts` + `src/lib/fii-dii.ts` — Mongoose archive, collection `fii_dii`,
  unique `date`. MongoDB is an optional cache: empty/unreachable DB degrades to live
  Chartist data and backfills asynchronously. Connection starts in `src/instrumentation.ts`.
- Client-only (`"use client"`): `nifty-terminal.tsx`, `use-nifty-series.ts`,
  `query-provider.tsx`, `sign-in-button.tsx`, `signed-in-bar.tsx`. Keep
  Mongoose/Yahoo/axios imports on the server side.

### Conventions
- Import alias `@/*` → `./src/*`; dates are `YYYY-MM-DD` strings end to end.
- Colors/formatting centralized in `src/lib/nifty-format.ts` (en-IN locale, ₹ Cr units).
- Tailwind v4: no config file — extend via `@theme` in `src/app/globals.css`.
- Commit style: short lowercase one-liners (e.g. "added db connection").
