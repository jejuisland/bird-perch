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
pnpm --filter @perch/api db:migrate
pnpm --filter @perch/api db:seed      # seeds 5 BGC parking spots
```

### Mobile (apps/mobile)
```bash
pnpm --filter @perch/mobile start     # Expo Go QR code
pnpm --filter @perch/mobile android
pnpm --filter @perch/mobile ios
```

## Architecture

### API Modules
- **auth** — JWT register/login. Tokens: `accessToken` (15m) + `refreshToken` (7d).
- **users** — Profile CRUD. `GET /users/me`, `PUT /users/me`.
- **parking-spots** — `GET /parking-spots?latitude=&longitude=&radiusMeters=` returns spots within radius using Haversine SQL (no PostGIS required). Defaults to 5000m.
- **reviews** — Nested under parking spots (`/parking-spots/:spotId/reviews`). Auto-recomputes `averageRating` on create.
- **heatmap** — `POST /heatmap/collect` stores anonymized GPS points (no user ID). `GET /heatmap` returns grid-aggregated `{latitude, longitude, weight}` points. Weight is normalized 0–1.
- **analytics** — Fire-and-forget event tracking (`POST /analytics/events`). Never blocks the client.

### Mobile Screens
- `app/(auth)/login.tsx` + `register.tsx` — Auth flow with vehicle type selector
- `app/(tabs)/index.tsx` — Main map screen (OSM tiles via `react-native-maps` UrlTile)
- `app/(tabs)/profile.tsx` — User profile + sign out

### Key Components
- `ParkingMap.tsx` — `react-native-maps` with `mapType="none"` + `UrlTile` pointing to OSM. Uses `forwardRef` for recenter animation.
- `HeatmapLayer.tsx` — Renders heatmap as `Circle` overlays (blue→red gradient based on weight). Used instead of the `Heatmap` component which requires Google Maps provider.
- `ParkingBottomSheet.tsx` — `@gorhom/bottom-sheet` with two snap points (40% / 85%). Loads reviews on spot select, submits new ratings inline.

### State
- `authStore` (Zustand) — `isAuthenticated`, `login`, `register`, `logout`, `hydrate`
- `mapStore` (Zustand) — `selectedSpot`, `heatmapEnabled`, `parkingSpots`, `heatmapPoints`, `searchQuery`
- API calls via `@tanstack/react-query` in `hooks/useParkingSpots.ts`

### Environment
Copy `apps/api/.env.example` to `apps/api/.env`. Requires PostgreSQL (any version). PostGIS not required for MVP — proximity queries use Haversine formula via raw SQL.

### Privacy
GPS data (heatmap collection) is stored with `sessionId` only — never linked to `userId`. The `sessionId` is a client-generated UUID persisted locally.
