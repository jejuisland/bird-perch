# Perch

Community-driven parking discovery app — map-first, heatmap-powered, built with React Native (Expo) + NestJS.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo Router, OpenStreetMap (`react-native-maps` + UrlTile) |
| Backend | NestJS 11, TypeORM, PostgreSQL |
| Shared | TypeScript types (`packages/shared`) |
| Monorepo | Turborepo + pnpm workspaces |

---

## Prerequisites

Make sure these are installed before you start:

- **Node.js** >= 20 — [nodejs.org](https://nodejs.org)
- **pnpm** >= 9 — `npm install -g pnpm`
- **PostgreSQL** >= 14 — [postgresql.org](https://www.postgresql.org/download/) or via Docker
- **Expo Go** app on your phone (iOS or Android) — for running the mobile app without a simulator

---

## 1. Clone & Install

```bash
git clone https://github.com/jejuisland/bird-perch.git
cd bird-perch
pnpm install
```

---

## 2. Set Up the Database

### Option A — Docker (quickest)
```bash
docker run --name perch-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=perch \
  -p 5432:5432 \
  -d postgres:16
```

### Option B — Local PostgreSQL
Create a database named `perch` with your existing PostgreSQL instance.

---

## 3. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in your database credentials:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=perch

JWT_SECRET=replace_with_a_strong_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=replace_with_another_strong_secret
JWT_REFRESH_EXPIRES_IN=7d
```

---

## 4. Run Database Migrations & Seed

```bash
# Auto-sync schema (runs on first start when NODE_ENV != production)
# Or run the seed to populate sample parking spots:
pnpm db:seed
```

The seed inserts 5 parking spots around BGC, Manila so the map isn't empty on first load.

---

## 5. Set the Mobile API URL

Create `apps/mobile/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-local-ip>:3000/api/v1
```

> Use your machine's **local network IP** (e.g. `192.168.1.10`), not `localhost` — the phone needs to reach your machine over the network.  
> Find it with `ipconfig` (Windows) or `ifconfig` (Mac/Linux).

---

## 6. Start Development

### Run everything at once (recommended)
```bash
pnpm dev
```
This starts both the API and the Expo dev server via Turbo.

### Run individually
```bash
# Backend only
pnpm --filter @perch/api start:dev

# Mobile only
pnpm --filter @perch/mobile start
```

Once Expo starts, scan the QR code with the **Expo Go** app on your phone.

---

## 7. API Documentation

Swagger UI is available at:

```
http://localhost:3000/docs
```

All endpoints require a Bearer token except `POST /auth/register` and `POST /auth/login`.

---

## Project Structure

```
perch/
├── apps/
│   ├── api/              NestJS backend (port 3000)
│   │   └── src/
│   │       ├── auth/         JWT register + login
│   │       ├── users/        User profile CRUD
│   │       ├── parking-spots/ Nearby query (5km Haversine)
│   │       ├── reviews/      Ratings + comments
│   │       ├── heatmap/      Anonymized GPS aggregation
│   │       └── analytics/    Event tracking
│   └── mobile/           Expo React Native app
│       ├── app/
│       │   ├── (auth)/       Login + Register screens
│       │   └── (tabs)/       Map screen + Profile
│       ├── components/
│       │   ├── map/          ParkingMap, HeatmapLayer
│       │   ├── sheets/       ParkingBottomSheet
│       │   └── ui/           SearchBar, RecenterButton, HeatmapToggle, AdBanner
│       ├── hooks/            useLocation, useParkingSpots
│       ├── services/         API client, location collection
│       └── store/            Zustand stores (auth, map)
└── packages/
    └── shared/           Shared TypeScript types
```

---

## Common Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start all services |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm db:seed` | Seed sample parking spots |
| `pnpm --filter @perch/api start:dev` | API with hot-reload |
| `pnpm --filter @perch/mobile android` | Open on Android emulator |
| `pnpm --filter @perch/mobile ios` | Open on iOS simulator |

---

## Notes for Developers

- **OSM tiles** — The map uses `react-native-maps` with `mapType="none"` and an OSM `UrlTile`. No Google Maps API key is required. Works out of the box in Expo Go.
- **Heatmap** — Rendered as `Circle` overlays instead of the native `Heatmap` component (which requires Google Maps provider on Android). Intensity is normalized 0–1 and colors interpolate blue → red.
- **Privacy** — Heatmap GPS points are stored with a client-generated `sessionId` only. They are never linked to a `userId`.
- **Database migrations** — `synchronize: true` is enabled when `NODE_ENV !== production`. For production, use `pnpm db:migrate` with the TypeORM CLI.
- **Proximity queries** — The 5km nearby lookup uses Haversine formula via raw SQL. PostGIS is not required for MVP.
