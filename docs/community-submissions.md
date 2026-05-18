# Community Parking Spot Submissions

## Overview

Allows authenticated users to contribute new parking spots directly from the mobile app. Submissions enter a peer-moderation queue before being fully verified, giving the community control over data quality.

---

## Architecture

### New Modules / Files

| Path | Purpose |
|------|---------|
| `apps/api/src/community/` | All community feature services, controllers, entities, scheduler |
| `apps/api/src/uploads/` | Supabase presigned URL generation for photo uploads |
| `apps/mobile/app/(tabs)/contribute.tsx` | Full submission wizard screen |
| `packages/shared/src/types/community.ts` | Shared types: DTOs, moderation queue, contributor stats |

---

## Submission Flow

### Mobile → API

1. **Pin placement** — user drops a pin on the map; distance from current GPS is validated against their contributor tier.
2. **Spot details** — name, parking type (mall / private / street / other), operating hours, rate string.
3. **Detailed rates** — optional structured rate entry via the Rate Builder sheet (see below).
4. **Photos** — one or more photos required; each is uploaded to Supabase Storage via a presigned PUT URL before the form is submitted. Failed uploads show a tap-to-retry overlay.
5. **Confirm + Submit** — `POST /parking-spots/community` creates the spot, a moderation item, and photo records in one transaction.

### API-side (`CommunitySubmissionsService.submitNewPlace`)

- Validates that all photo storage paths are scoped to the submitting user (`parking-photos/{userId}/`).
- Enforces tier-based pin radius: Pigeon ≤ 200 m, Hawk ≤ 500 m, Eagle ≤ ∞.
- Rejects if an existing spot sits within 50 m (Haversine query — no PostGIS required).
- If `detailedRates` is provided, `RateSummaryService` generates a human-readable `rates` string and infers `dataConfidence`.
- Creates `ParkingSpotEntity` (`communityVerification: 'unverified'`), `ModerationItemEntity` (`status: 'pending'`), and `ParkingSpotPhotoEntity` records.

---

## Rate Builder

### Mobile (`RateBuilderSheet`)

A `Modal` (pageSheet) with per-vehicle tabs: Car, Motorcycle, Van.

Each vehicle supports two modes:
- **Tiered** — free minutes, first N hours rate, succeeding hourly rate, overnight window + charge.
- **Flat** — single rate with optional time window.

Smart defaults apply on spot type change (mall → tiered + overnight on, private → flat).

A collapsible penalties section captures damaged card fee and free-text penalty notes.

### Backend (`RateSummaryService`)

Converts a `DetailedRates` object to a human-readable string, e.g.:

```
Car: Free 15min · ₱60 first 2h · ₱30/hr · Overnight ₱150 (10:00PM–6:00AM) / Moto: ₱30 flat
```

- Skips motorcycle line if it would be identical to the car line.
- `inferConfidence()` returns `'low'` when both `flatRate` and `firstRate` are populated (ambiguous data), otherwise `'medium'`.

### Shared Types (`DetailedRates`, `VehicleRate`)

Extended fields on `VehicleRate`:

| Field | Type | Description |
|-------|------|-------------|
| `validationMinutes` | `number` | Free parking with validation |
| `flatRateWindowStart` | `string` | HH:MM — start of flat rate window |
| `flatRateWindowEnd` | `string` | HH:MM — end of flat rate window |
| `overnightWindowStart` | `string` | HH:MM — overnight period start |
| `overnightWindowEnd` | `string` | HH:MM — overnight period end |
| `minimumCharge` | `number` | Minimum billable amount |

Added to `DetailedRates`: `truck`, `damagedCardFee`, `penaltyNotes`, `notes`, `rawText`, `dataConfidence`.

---

## Moderation Queue

### Voting (`ModerationService`)

Any authenticated user can fetch the queue (`GET /moderation/queue`) and cast a vote (`POST /moderation/items/:id/vote`).

Tier weights: Pigeon = 1, Hawk = 2, Eagle = 3.

Resolution thresholds:
- `approvalScore ≥ 3` → spot `communityVerification` set to `'verified'`
- `rejectionScore ≥ approvalScore` or `rejectionScore ≥ 3` → spot and all photos hard-deleted

Voter accuracy is tracked: after resolution, each voter's `isCorrect` field is updated based on whether their vote matched the outcome.

### Auto-acceptance Scheduler (`AcceptanceScheduler`)

Runs every 15 minutes. Two jobs:

1. **Photo / review auto-approval** — items older than 72 hours with no rejection get `communityApprovedAt` / `acceptedAt` set and contribution points awarded.
2. **Tier promotion** — after each point award, checks if the user's total `contributionPoints` crosses the Hawk (50 pts) or Eagle (200 pts) threshold and upgrades `tier` accordingly.

---

## Contributor Tiers

| Tier | Points required | Vote weight | Pin radius |
|------|----------------|-------------|------------|
| Pigeon | 0 (default) | 1 | 200 m |
| Hawk | 50 | 2 | 500 m |
| Eagle | 200 | 3 | Unlimited |

Point awards:

| Action | Points |
|--------|--------|
| Spot verified by community | +10 |
| Photo auto-approved (72 h) | +3 per photo |
| Review auto-approved (72 h) | +2 |

---

## Photo Upload

### Mobile

Each selected photo is uploaded independently and in parallel:

1. `POST /uploads/parking-photo` → returns `{ uploadUrl, storagePath, publicUrl }` (presigned Supabase PUT URL, expires 10 min).
2. `uploadAsync(uploadUrl, localUri, { httpMethod: 'PUT', uploadType: BINARY_CONTENT })` via `expo-file-system/legacy`.
3. On success, `storagePath` is stored in component state. On failure, a tap-to-retry overlay (`↺ Retry`) is shown on the photo thumbnail.

Photo paths are scoped to `parking-photos/{userId}/` — the backend validates this prefix on submission.

### Notable fix

`uuid` v10 requires `crypto.getRandomValues` which is not available in the Hermes JS engine without an explicit polyfill. The call to `uuidv4()` inside the photo map was silently throwing before `setPhotos()` was reached, causing photo state to never update. Replaced with an inline `genId()` using `Math.random().toString(36)` + `Date.now().toString(36)`.

---

## Bug Fixes (this feature branch)

### Tab bar icon crash

**Symptom:** `"true" is not a valid icon name for family "ionicons"`

**Cause:** In `_layout.tsx`, the `tabIcon` factory's outer parameter `focused` (the icon name string) was shadowed by the inner render-prop parameter `focused` (a boolean). The ternary `focused ? focused : unfocused` evaluated to the boolean `true` when the tab was active.

**Fix:** Renamed outer parameters to `focusedName` / `unfocusedName`.

---

## Throttling

Global: 60 requests / 60 s per IP.  
Community submission endpoint: 5 submissions / 10 min per IP (production).

Both limits are bypassed in `NODE_ENV=development` (set to 10,000 / 1,000 respectively) so local testing is not blocked.

---

## Known Gaps (logged for future work)

- Self-vote guard not yet enforced — submitter can vote on their own item.
- Tier promotion logic exists in the scheduler but `verifiedPlacesCount` and `acceptedUpdatesCount` columns on `ContributorStatsEntity` are not yet incremented.
- `metadata_update`, `pin_move`, `photo`, `report_escalation` moderation kinds are defined but `applyResolution()` only handles `new_place`.
- No push notification on approval or rejection.
- Rejected spots are hard-deleted with no archive or notification to the submitter.
- Unverified spots are immediately visible on the map to all users.
- Queue is ordered newest-first; old items can starve indefinitely.
