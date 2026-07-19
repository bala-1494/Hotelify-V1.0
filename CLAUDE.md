# Hotelify

AI-powered hotel management software. Import any hotel from Google Maps and generate a full marketing page with photos, reviews, and location data.

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS — red (`#C41E3A`) and white theme
- **APIs**: Google Places API (Place Details, Find Place, Photo proxy)
- **Storage**: Supabase (Postgres + Storage). All DB access is server-side via the
  service-role key through API routes — the client never touches Supabase directly.

## Architecture

### Auth
Mock OAuth via `AuthProvider` context (`components/AuthProvider.tsx`). Demo account:
`admin@hotelify.com`. The context exposes `{ user, role, hotelId }` — `role`/`hotelId`
come from the `memberships` table via `GET /api/me`. The signed-in email is forwarded
to API routes as the `x-user-email` header (`lib/apiClient.ts`); swap this for a real
NextAuth session when ready. Permission checks go through `can()` in `lib/permissions.ts`
(roles: owner, manager, front_desk, housekeeping) — import it, never reimplement.

### Data model (Supabase)
Schema lives in `supabase/migrations/0001_foundation.sql`: `hotels`, `memberships`,
`room_types`, `rooms`, `bookings`, `themes`, `photos`, plus `booking_status` /
`member_role` enums. `0003_shared_price_options.sql` then moves the View/Meal add-on
pools onto the `hotels` row (`view_options` / `meal_options`) and gives each room type
opt-in id lists (`view_option_ids` / `meal_option_ids`) — the room editor writes to
these, so this migration is REQUIRED for room-type saves to persist.
`0004_room_occupancy_bed.sql` adds `max_occupancy` + `bed_note` to `room_types` (additive,
safe defaults) so the onboarding wizard's per-room "Max guests" and "Bed & size" fields
persist. RLS is on with no
public policies; the app reads/writes only through the service-role client
(`lib/supabase/server.ts`). All DB helpers live in `lib/db.ts`. Custom photo uploads go
to the `hotel-photos` Storage bucket.

**Write boundary (content half):** this codebase writes `hotels`, `room_types`,
`themes`, `photos`, and NEW `bookings` rows with `status='pending'` only. It never
transitions a booking's status and never decrements inventory — those belong to the
operations half. Availability is computed by *reading* confirmed bookings.

### Owner onboarding flow (S1.1)
1. Root router (`app/page.tsx`) sends owners with no hotel to `/onboarding`, others to
   `/dashboard` (one hotel per owner, enforced by a partial unique index + `createHotelForOwner`).
2. `/onboarding` (`app/onboarding/page.tsx`) is a self-contained multi-step flow matching the
   "Hotelify Onboarding" design: **Import** (search `/api/autocomplete` + `/api/places`, mock
   fallback) → **Preview** (live `WizardPreview` of the draft page) → **Customize** wizard
   (Theme / Photos / Story / Room types / Publish, with a sticky live preview) → **Published**.
   Everything is edited in local state and persisted once at Publish: `POST /api/hotels`
   (create — honors chosen `themeId`, room types incl. occupancy/bed, add-on pools, summary→
   `description`, and cover-first visible photos) then `PATCH /api/hotels/[id] { published: true }`.
   The wizard's ✦ story helpers and no-OTP sign-in are front-end only (AI descriptions / real
   auth remain roadmap items).
3. `/dashboard` shows the hotel + a first-run checklist (`OnboardingChecklist`). Post-onboarding
   edits (incl. custom photo upload, which needs the hotel to exist) live in `/hotel/[id]`.

### Guest booking flow (S1.5 / S1.6)
`app/book/[subdomain]` reads `GET /api/book/[subdomain]?checkIn=&checkOut=` (hotel +
per-room availability). The terminal step `POST /api/bookings` creates a real
`status='pending'`, `source='guest'` row (cross-device). A room shows as unavailable
only when confirmed bookings exhaust its inventory for the dates, or the owner's
availability toggle is off — pending requests never hold inventory.

### Operations half (S2.x)
Schema: `supabase/migrations/0002_operations.sql` adds booking-transition fields
(`note`, `decided_at/by`, `reject_reason`, `checkin_token`, `checked_in_at`), the
`room_status` enum + `rooms.status`, a `notifications` queue, and the atomic
`accept_booking` / `create_manual_booking` SQL functions that own all
inventory-decrement logic. `lib/ops.ts` is the ops data layer; `authorizeOps()` in
`lib/apiAuth.ts` resolves the actor's hotel+role and gates every ops route through
`can()`.

**Write boundary (ops half):** writes booking status TRANSITIONS, all inventory
effects, `memberships`, `rooms`, `notifications`, and NEW `bookings` with
`status='confirmed'` (manual only). Never writes `hotels`, `room_types`, `themes`,
`photos` — reads them only.

- **Accept (S2.2):** `accept_booking()` locks the room_type row, counts holding
  bookings (confirmed/id_submitted/checked_in) overlapping the span, confirms iff a
  unit is free (else returns `full` → UI offers reassign/reject).
- **Reject (S2.3):** pending→rejected with a reason, queues a notification.
- **Manual (S2.4):** `create_manual_booking()` inserts a `confirmed`/`manual` row
  after the same atomic capacity check.
- **Team (S2.5/S2.6):** invite = insert a `memberships` row keyed by email; the
  invitee joins on next login. `can()` enforces Manager-can't-touch-Owner/Manager.
- **Landing (S2.6):** `landingPath(role)` — Owner/Manager → dashboard, Front-desk →
  bookings, Housekeeping → rooms.
- **Phase-2 scaffold (S2.7):** `app/checkin/[token]` stub, `rooms.status` board
  (dirty→cleaning→ready), `seedRoomsFromTypes()`. No full ID-upload loop.

### API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/places` | POST | Accept Maps URL / place ID → return hotel data |
| `/api/photo` | GET | Proxy Google Places photos (keeps key server-side) |
| `/api/me` | GET | Membership (hotelId + role) for the signed-in email |
| `/api/hotels` | GET/POST | Owner's hotel / create hotel (1-per-owner) |
| `/api/hotels/[id]` | GET/PATCH | Full hotel / edit fields, theme, publish |
| `/api/hotels/[id]/room-types` | PUT | Replace room-type set (incl. availability) |
| `/api/hotels/[id]/photos` | PUT | Reorder / hide / set-cover metadata |
| `/api/hotels/[id]/photos/upload` | POST | Upload custom photo to Storage |
| `/api/hotels/[id]/photos/[photoId]` | DELETE | Remove a photo |
| `/api/book/[subdomain]` | GET | Public booking page + availability |
| `/api/bookings` | POST | Guest request-to-book (pending, guest source) |
| `/api/ops/bookings` | GET | Bookings inbox (filters: status/room/date) |
| `/api/ops/bookings/[id]/accept` | POST | Accept (atomic inventory check) |
| `/api/ops/bookings/[id]/reject` | POST | Reject with reason |
| `/api/ops/bookings/[id]/checkin` | POST | confirmed → checked_in |
| `/api/ops/bookings/manual` | POST | Manual booking → confirmed |
| `/api/ops/room-types` | GET | Room types for filters / manual form |
| `/api/ops/team` | GET/POST | Roster / invite by email + role |
| `/api/ops/team/[id]` | PATCH/DELETE | Change role / remove member |
| `/api/ops/rooms` | GET | Room-status board |
| `/api/ops/rooms/[id]` | PATCH | Set room status |
| `/api/ops/rooms/seed` | POST | Generate rooms from inventory |
| `/api/checkin/[token]` | GET | Public check-in stub lookup |

### Key Files
```
app/
  page.tsx                — onboarding-vs-dashboard router
  onboarding/page.tsx     — import → confirm → generate
  dashboard/page.tsx      — hotel card + first-run checklist
  hotel/[id]/page.tsx     — owner console (edit fields/photos/theme/rooms)
  book/[subdomain]/page.tsx — guest booking + availability
  bookings/page.tsx       — ops bookings inbox (S2.1-S2.4)
  team/page.tsx           — team + invite + roles (S2.5/S2.6)
  rooms/page.tsx          — housekeeping room board (S2.7)
  checkin/[token]/page.tsx — check-in stub (S2.7)
  api/…                   — see table above
components/
  AuthProvider.tsx        — auth context {user, role, hotelId}
  OnboardingChecklist.tsx — first-run checklist (S1.1)
  PhotoManager.tsx        — reorder/hide/cover/upload (S1.2)
  ThemePicker.tsx         — theme picker + live preview + publish (S1.3)
  EditableField.tsx       — inline field editing (S1.4)
  RoomTypesEditor.tsx     — room types + availability toggle (S1.6)
  ops/BookingCard.tsx     — inbox card + accept/reject/checkin (S2.1-S2.3)
  ops/ManualBookingModal.tsx — manual booking form (S2.4)
lib/
  supabase/server.ts      — service-role client + bucket name
  db.ts                   — storefront DB helpers (row<->type mapping)
  ops.ts                  — operations DB layer (transitions/team/rooms)
  permissions.ts          — can(user, action, resource) + landingPath()
  apiClient.ts / apiAuth.ts — client fetch + server auth helpers
  themes.ts               — theme presets (mirror themes table)
hooks/
  useHotels.ts            — Supabase-backed owner hotel
supabase/
  migrations/0001_foundation.sql  — storefront schema
  migrations/0002_operations.sql  — ops schema + inventory functions
  migrations/0003_shared_price_options.sql — hotel-level view/meal pools + per-room opt-in ids
  seed_dev.sql            — dev-only mock staff + bookings
```

## Environment Variables

```env
GOOGLE_MAPS_API_KEY=               # server-side — Places API + photo proxy
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # client-side — Maps Embed iframe
SUPABASE_URL=                      # server-side — Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=         # server-side ONLY — never expose to client
```

The two Maps keys can be the same. Restrict the server key to Places API; restrict the
public key to Maps Embed API.

## Setup

```bash
npm install
cp .env.example .env.local
# Add API keys + Supabase URL/service-role key to .env.local
# Run supabase/migrations 0001_foundation.sql → 0002_operations.sql → 0003_shared_price_options.sql → 0004_room_occupancy_bed.sql in the SQL editor
# (0003 is REQUIRED — without it, room-type / add-on edits fail to persist)
# (0004 is REQUIRED for the onboarding wizard's per-room Max guests + Bed & size fields to persist)
# Create a public Storage bucket named `hotel-photos`
# (optional) Run supabase/seed_dev.sql after onboarding for mock staff + bookings
npm run dev
```

## Testing

Vitest + React Testing Library (jsdom). Tests live in `__tests__/` folders next
to the code they cover.

```bash
npm test          # run the suite once
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit
npm run ci         # typecheck → test → next build (what CI runs)
```

`.github/workflows/ci.yml` runs `npm run ci` on every push and pull request, so a
type error, failing test, or broken build blocks the change. Config is in
`vitest.config.ts` (the `@/*` alias mirrors tsconfig); `vitest.setup.ts` wires up
jest-dom and per-test cleanup. Current coverage: `can()`/`landingPath()`
permissions, setup-wizard progress + persistence, the `RoomTypesEditor` amenity
chips, the rupee price-level rendering, and the wizard Rooms step's
buffer-then-save-once behavior (edits don't hit the API until "Confirm & continue").

## Roadmap

- [ ] Real Google OAuth (NextAuth.js)
- [x] Database persistence (Supabase)
- [x] Booking inbox + accept/reject + manual bookings + team roles
- [ ] AI-generated room/property descriptions
- [ ] Booking engine integration
- [ ] Multi-property analytics dashboard
- [ ] White-label hotel page export
