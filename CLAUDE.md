# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Perch is a community-driven parking discovery mobile app. Monorepo using Turborepo + pnpm workspaces.

```
apps/api/        NestJS backend (port 3000)
apps/mobile/     Expo React Native app (port 8081)
packages/shared/ Shared TypeScript types
```

## Commands

### Root (run all services)
```bash
pnpm install
pnpm dev          # starts api + mobile concurrently via turbo
pnpm build
pnpm test
pnpm lint
```

### Backend (apps/api)
```bash
pnpm --filter @perch/api start:dev
pnpm --filter @perch/api test
pnpm --filter @perch/api test -- path/to/file.spec.ts   # single test file
pnpm --filter @perch/api test -- -t "test name"         # single test by name
pnpm --filter @perch/api db:generate  # generate migration from entity changes
pnpm --filter @perch/api db:migrate
pnpm --filter @perch/api db:seed      # seeds 5 BGC parking spots
```
Jest runs with `--runInBand` (serial) because tests share a DB connection. Test files are `*.spec.ts` under `src/`.

### Mobile (apps/mobile)
```bash
pnpm --filter @perch/mobile start     # Expo Go QR code
pnpm --filter @perch/mobile android
pnpm --filter @perch/mobile ios
```

## Architecture

All routes are prefixed `api/v1` (`setGlobalPrefix` in `main.ts`). Swagger UI at `/docs`. A global `ThrottlerGuard` rate-limits every route (60 req/60s per IP in prod; raised to 10,000 in development so local testing isn't blocked).

### API Modules
- **auth** — Email-OTP based. `send-otp` → `verify-otp` → register/login issues `accessToken` (15m) + `refreshToken` (7d). `MailService` sends OTP codes via Resend (falls back to nodemailer); `OtpVerificationEntity` stores pending codes. `JwtAuthGuard` (`common/guards`) protects routes; `AdminGuard` gates admin-only ones; `@CurrentUser()` decorator injects the authenticated user.
- **users** — Profile CRUD. `GET /users/me`, `PUT /users/me`.
- **parking-spots** — `GET /parking-spots?latitude=&longitude=&radiusMeters=` returns spots within radius using Haversine SQL (no PostGIS required). Defaults to 5000m.
- **reviews** — Nested under parking spots (`/parking-spots/:spotId/reviews`). Auto-recomputes `averageRating` on create.
- **heatmap** — `POST /heatmap/collect` stores anonymized GPS points (no user ID). `GET /heatmap` returns grid-aggregated `{latitude, longitude, weight}` points. Weight is normalized 0–1.
- **analytics** — Fire-and-forget event tracking (`POST /analytics/events`). Never blocks the client.
- **community** — User-contributed spots + peer moderation (the largest module). See "Community & Moderation" below. Includes submissions, moderation queue/voting, reports, favorites, contributor stats, and a 15-min `AcceptanceScheduler` cron.
- **uploads** — `POST /uploads/parking-photo` returns a presigned Supabase Storage PUT URL (`{ uploadUrl, storagePath, publicUrl }`, 10-min expiry). Photo paths are scoped to `parking-photos/{userId}/`; the backend validates this prefix on submission.

### Community & Moderation
Authenticated users submit spots (`POST /parking-spots/community`) which enter a `pending` moderation queue (`communityVerification: 'unverified'`). Any user can vote (`POST /moderation/items/:id/vote`); tier-weighted votes resolve items — `approvalScore ≥ 3` verifies the spot, rejection hard-deletes it and its photos. The `AcceptanceScheduler` auto-approves photos/reviews older than 72h with no rejection and awards contribution points.

Contributor tiers gate the pin-placement radius and vote weight: **Pigeon** (0 pts, weight 1, ≤200m), **Hawk** (50 pts, weight 2, ≤500m), **Eagle** (200 pts, weight 3, unlimited). Detailed architecture, point awards, and known gaps are documented in `docs/community-submissions.md` — read it before touching this module.

### Mobile Screens
- `app/(auth)/login.tsx`, `register.tsx`, `verify-otp.tsx` — Auth flow with email OTP verification and vehicle type selector
- `app/(tabs)/index.tsx` — Main map screen (OSM tiles via `react-native-maps` UrlTile)
- `app/(tabs)/contribute.tsx` — Spot submission wizard (pin → details → Rate Builder → photos → submit)
- `app/(tabs)/profile.tsx` — User profile + sign out

### Key Components
- `ParkingMap.tsx` — `react-native-maps` with `mapType="none"` + `UrlTile` pointing to OSM. Uses `forwardRef` for recenter animation.
- `HeatmapLayer.tsx` — Renders heatmap as `Circle` overlays (blue→red gradient based on weight). Used instead of the `Heatmap` component which requires Google Maps provider.
- `ParkingBottomSheet.tsx` — `@gorhom/bottom-sheet` with two snap points (40% / 85%). Loads reviews on spot select, submits new ratings inline.

### State
- `authStore` (Zustand) — `isAuthenticated`, `login`, `register`, `logout`, `hydrate`
- `mapStore` (Zustand) — `selectedSpot`, `heatmapEnabled`, `parkingSpots`, `heatmapPoints`, `searchQuery`
- API calls via `@tanstack/react-query` in `hooks/useParkingSpots.ts`; axios client + token refresh interceptor in `services/api.ts`

### Shared Package (`packages/shared`)
TypeScript types consumed by both apps (`user`, `parking`, `review`, `heatmap`, `analytics`, `community`). Also hosts `utils/pricing-engine.ts` — the canonical logic that turns a `DetailedRates` object into a human-readable rate string; it has unit tests (`pricing-engine.spec.ts`). Keep the API's `RateSummaryService` and this engine in sync.

### Environment
Copy `apps/api/.env.example` to `apps/api/.env`. Requires PostgreSQL (any version). PostGIS not required for MVP — proximity queries use Haversine formula via raw SQL. Community photo uploads need `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET`. Mobile reads `EXPO_PUBLIC_API_URL` (must be the machine's LAN IP, e.g. `http://192.168.x.x:3000/api/v1` — not `localhost` — so a phone on Expo Go can reach it).

TypeORM runs with `synchronize: true` whenever `NODE_ENV !== production`, so schema changes auto-apply locally and migrations are usually unnecessary in dev. For production, generate + run migrations via the `db:generate` / `db:migrate` CLI scripts.

### Privacy
GPS data (heatmap collection) is stored with `sessionId` only — never linked to `userId`. The `sessionId` is a client-generated UUID persisted locally.
