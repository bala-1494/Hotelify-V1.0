# Hotelify — Flows & Database Schema

> AI-powered hotel management software. Import any hotel from Google Maps and
> generate a full marketing page with photos, reviews, and location data, then
> run the property's bookings, team, and housekeeping.

This document is a single-page reference for **every built flow** and the
**complete database schema**. It is generated from the code in this repo:
`app/`, `lib/`, and `supabase/migrations/`.

---

## Table of contents

1. [Architecture at a glance](#architecture-at-a-glance)
2. [Roles & permissions](#roles--permissions)
3. [Built flows](#built-flows)
   - [F0 · Auth & routing](#f0--auth--routing)
   - [F1 · Owner onboarding (S1.1)](#f1--owner-onboarding-s11)
   - [F2 · Owner console — content editing (S1.2–S1.7)](#f2--owner-console--content-editing-s12s17)
   - [F3 · Guest booking (S1.5 / S1.6)](#f3--guest-booking-s15--s16)
   - [F4 · Bookings inbox — accept / reject / check-in / manual (S2.1–S2.4)](#f4--bookings-inbox--accept--reject--check-in--manual-s21s24)
   - [F5 · Team & roles (S2.5 / S2.6)](#f5--team--roles-s25--s26)
   - [F6 · Housekeeping room board (S2.7)](#f6--housekeeping-room-board-s27)
   - [F7 · Check-in stub (S2.7)](#f7--check-in-stub-s27)
4. [Write boundaries](#write-boundaries)
5. [API routes](#api-routes)
6. [Database schema](#database-schema)
   - [Enums](#enums)
   - [Tables](#tables)
   - [Indexes & constraints](#indexes--constraints)
   - [Stored functions (atomic inventory)](#stored-functions-atomic-inventory)
   - [Migration order](#migration-order)
7. [Roadmap](#roadmap)

---

## Architecture at a glance

- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS — red (`#C41E3A`) and white theme
- **APIs**: Google Places API (Place Details, Find Place, Photo proxy)
- **Storage**: Supabase (Postgres + Storage). All DB access is **server-side**
  through the service-role key via API routes — the client never touches
  Supabase directly. RLS is enabled with **no public policies**, so the anon
  key can reach nothing directly.

The app is split into two halves that share one schema:

| Half | Owns | Key files |
|---|---|---|
| **Content / storefront** | marketing page, photos, theme, room types, add-on pools, and NEW `pending` guest bookings | `lib/db.ts`, `app/onboarding`, `app/hotel/[id]`, `app/book/[subdomain]` |
| **Operations** | booking status transitions, all inventory effects, memberships, physical rooms, notifications, and NEW `confirmed` manual bookings | `lib/ops.ts`, `lib/apiAuth.ts`, `app/bookings`, `app/team`, `app/rooms` |

---

## Roles & permissions

Four roles live in the `member_role` enum. `can(user, action, resource)` in
`lib/permissions.ts` is the **single source of truth** — import it, never
reimplement.

| Role | What they can do |
|---|---|
| **owner** | Everything — billing, delete, invite/remove/change anyone. |
| **manager** | Edit page/rooms/theme/photos, accept/reject/check-in, manual bookings, seed rooms, room-status board, invite/change/remove **Front-desk & Housekeeping only**. No billing/delete; can't touch Owners/Managers. |
| **front_desk** | View bookings, accept/reject, manual bookings, run check-in, view room board. No content editing, no inviting. |
| **housekeeping** | Room-status board only (advance dirty→cleaning→ready). |

Action → allowed roles (from `can()`):

| Action | owner | manager | front_desk | housekeeping |
|---|:-:|:-:|:-:|:-:|
| `hotel:edit` / `hotel:publish` / `roomType:edit` / `photo:manage` / `theme:edit` | ✅ | ✅ | — | — |
| `booking:read` | ✅ | ✅ | ✅ | — |
| `booking:accept` / `reject` / `checkin` / `manual` / `create` / `inventory:manage` | ✅ | ✅ | ✅ | — |
| `room:view` | ✅ | ✅ | ✅ | ✅ |
| `room:status` | ✅ | ✅ | — | ✅ |
| `room:manage` (seed physical rooms) | ✅ | ✅ | — | — |
| `team:view` | ✅ | ✅ | — | — |
| `team:invite` / `changeRole` / `remove` | ✅ | FD & HK only | — | — |
| `billing` / `hotel:delete` | ✅ | — | — | — |

**Landing after login** (`landingPath(role)`): Owner/Manager → `/dashboard`,
Front-desk → `/bookings`, Housekeeping → `/rooms`.

---

## Built flows

### F0 · Auth & routing

- **Mock OAuth** via `AuthProvider` (`components/AuthProvider.tsx`). Demo
  account: `admin@hotelify.com`. Sign-in page: `app/login/page.tsx`.
- The context exposes `{ user, role, hotelId }` — `role`/`hotelId` come from the
  `memberships` table via `GET /api/me`.
- The signed-in email is forwarded to API routes as the `x-user-email` header
  (`lib/apiClient.ts`). `authorizeOps()` in `lib/apiAuth.ts` resolves the
  actor's hotel + role and gates every ops route through `can()`.
- **Root router** (`app/page.tsx`): owners with **no hotel** → `/onboarding`;
  everyone else → their role's landing path.

> Real Google OAuth (NextAuth.js) is still a roadmap item; the mock context is
> the swap-in point.

### F1 · Owner onboarding (S1.1)

Self-contained multi-step wizard at `app/onboarding/page.tsx` matching the
"Hotelify Onboarding" design. One hotel per owner (enforced by a partial unique
index + `createHotelForOwner`).

1. **Import** — search `/api/autocomplete` + `/api/places` (Maps URL / place ID
   → hotel data), with a mock fallback.
2. **Preview** — live `WizardPreview` of the draft marketing page.
3. **Customize wizard** — Theme → Photos → Story → Room types → Publish, with a
   sticky live preview. Per-room fields include **Max guests** (`max_occupancy`)
   and **Bed & size** (`bed_note`).
4. **Published** — celebration screen (`PublishedCelebration`).

Everything is edited in **local state** and persisted **once at Publish**:
`POST /api/hotels` (create — honors chosen `themeId`, room types incl.
occupancy/bed, add-on pools, summary → `description`, cover-first visible
photos) then `PATCH /api/hotels/[id] { published: true }`.

> The wizard's ✦ story helpers and no-OTP sign-in are front-end only (AI
> descriptions / real auth remain roadmap items).

### F2 · Owner console — content editing (S1.2–S1.7)

`app/dashboard/page.tsx` shows the hotel card + first-run checklist
(`OnboardingChecklist`). Post-onboarding edits live in `app/hotel/[id]/page.tsx`:

| Sub-flow | Component | Persists via |
|---|---|---|
| Inline field edits (name, address, description, …) | `EditableField` | `PATCH /api/hotels/[id]` |
| Photos: reorder / hide / set cover | `PhotoManager` | `PUT /api/hotels/[id]/photos` |
| Photos: custom upload (needs the hotel to exist) | `PhotoManager` | `POST /api/hotels/[id]/photos/upload` → `hotel-photos` bucket |
| Photos: delete | `PhotoManager` | `DELETE /api/hotels/[id]/photos/[photoId]` |
| Theme pick + live preview + publish | `ThemePicker` | `PATCH /api/hotels/[id]` |
| Room types + availability toggle | `RoomTypesEditor` | `PUT /api/hotels/[id]/room-types` |

**Add-on pools (S1.7):** View + Meal-plan options are defined **once per hotel**
(`hotels.view_options` / `hotels.meal_options`, one price each) and each room
type opts in to a subset by id (`room_types.view_option_ids` /
`meal_option_ids`).

### F3 · Guest booking (S1.5 / S1.6)

Public page `app/book/[subdomain]/page.tsx` reads
`GET /api/book/[subdomain]?checkIn=&checkOut=` (hotel + per-room availability).

- A room shows **unavailable** only when confirmed bookings exhaust its
  inventory for the dates, **or** the owner's availability toggle is off.
  **Pending requests never hold inventory.**
- Terminal step `POST /api/bookings` creates a real
  `status='pending'`, `source='guest'` row (cross-device).

### F4 · Bookings inbox — accept / reject / check-in / manual (S2.1–S2.4)

Ops inbox `app/bookings/page.tsx` (cards: `components/ops/BookingCard.tsx`),
backed by `lib/ops.ts`. `GET /api/ops/bookings` with filters (status / room /
date).

- **Accept (S2.2)** — `accept_booking()` SQL fn locks the `room_types` row,
  counts holding bookings (`confirmed` / `id_submitted` / `checked_in`)
  overlapping the span, and confirms **iff a unit is free** (else returns
  `full` → UI offers reassign/reject). Issues a `checkin_token`.
- **Reject (S2.3)** — `pending → rejected` with a reason; queues a
  notification.
- **Check-in** — `confirmed → checked_in` (`POST /api/ops/bookings/[id]/checkin`).
- **Manual (S2.4)** — `create_manual_booking()` inserts a `confirmed` /
  `source='manual'` row after the same atomic capacity check
  (`components/ops/ManualBookingModal.tsx`).

All inventory-decrement logic lives in the SQL functions — never in app code.

### F5 · Team & roles (S2.5 / S2.6)

`app/team/page.tsx`, `GET/POST /api/ops/team`, `PATCH/DELETE /api/ops/team/[id]`.

- **Invite** = insert a `memberships` row keyed by email; the invitee joins on
  next login.
- `can()` enforces **Manager-can't-touch-Owner/Manager**.
- Change role / remove member gated the same way.

### F6 · Housekeeping room board (S2.7)

`app/rooms/page.tsx`, `GET /api/ops/rooms`, `PATCH /api/ops/rooms/[id]`.
Physical `rooms.status` board: **dirty → cleaning → ready**. Owners/managers can
**seed** rooms from inventory via `POST /api/ops/rooms/seed`
(`seedRoomsFromTypes()`).

### F7 · Check-in stub (S2.7)

`app/checkin/[token]/page.tsx` + `GET /api/checkin/[token]` — public
token-lookup stub. No full ID-upload loop yet.

---

## Write boundaries

**Content half** writes `hotels`, `room_types`, `themes`, `photos`, and NEW
`bookings` rows with `status='pending'` **only**. It never transitions a
booking's status and never decrements inventory. Availability is computed by
*reading* confirmed bookings.

**Operations half** writes booking status **transitions**, all inventory
effects, `memberships`, `rooms`, `notifications`, and NEW `bookings` with
`status='confirmed'` (manual only). It never writes `hotels`, `room_types`,
`themes`, `photos` — reads them only.

---

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/autocomplete` | GET | Google Places autocomplete for the import search |
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

---

## Database schema

Schema lives in `supabase/migrations/`. Run **in order**; RLS is on with no
public policies (app uses the service-role client only).

### Enums

| Enum | Values | Notes |
|---|---|---|
| `booking_status` | `pending`, `confirmed`, `id_submitted`, `checked_in`, `completed`, `rejected`, `cancelled` | Content half only ever inserts `pending`; every transition beyond that is owned by ops. |
| `member_role` | `owner`, `manager`, `front_desk`, `housekeeping` | See [Roles & permissions](#roles--permissions). |
| `room_status` | `dirty`, `cleaning`, `ready` | Housekeeping board (0002). |

### Tables

#### `themes` — seeded theme presets (mirror `lib/themes.ts`)

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | stable key, e.g. `classic-red` |
| `name` | `text` | |
| `"primary"` | `text` | hex; reserved word — must be quoted |
| `primary_dark` | `text` | |
| `accent` | `text` | |
| `surface` | `text` default `#ffffff` | |
| `created_at` | `timestamptz` default `now()` | |

Seeded presets: `classic-red`, `midnight-blue`, `forest-green`, `sunset-amber`,
`slate-mono`.

#### `hotels`

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | Google Place ID (or `mock-*` id) |
| `name` | `text` not null | |
| `address` | `text` default `''` | |
| `phone` | `text` | |
| `website` | `text` | |
| `description` | `text` | |
| `price_level` | `int` | |
| `rating` | `numeric` | |
| `total_ratings` | `int` | |
| `lat` / `lng` | `double precision` | |
| `maps_url` | `text` | |
| `types` | `text[]` default `{}` | |
| `reviews` | `jsonb` default `[]` | |
| `subdomain` | `text` **unique** not null | booking page slug |
| `theme_id` | `text` → `themes(id)` | |
| `published` | `boolean` default `false` | |
| `view_options` | `jsonb` default `[]` | hotel-level View add-on pool (0003) |
| `meal_options` | `jsonb` default `[]` | hotel-level Meal-plan add-on pool (0003) |
| `created_at` | `timestamptz` default `now()` | |

#### `memberships` — who can operate which hotel, in what role

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `hotel_id` | `text` → `hotels(id)` on delete cascade | |
| `user_email` | `text` not null | |
| `role` | `member_role` not null | |
| `created_at` | `timestamptz` default `now()` | |
| — | unique `(hotel_id, user_email)` | one membership per email per hotel |
| — | partial unique index on `user_email` where `role='owner'` | **one hotel per owner** |

#### `room_types` — a bookable category (`total_inventory` units)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `hotel_id` | `text` → `hotels(id)` on delete cascade | |
| `name` | `text` not null | |
| `base_price` | `numeric` default `0` | |
| `total_inventory` | `int` default `1` | |
| `amenities` | `text[]` default `{}` | |
| `available` | `boolean` default `true` | owner availability toggle |
| `sort_order` | `int` default `0` | |
| `view_option_ids` | `jsonb` default `[]` | opt-in ids into `hotels.view_options` (0003) |
| `meal_option_ids` | `jsonb` default `[]` | opt-in ids into `hotels.meal_options` (0003) |
| `max_occupancy` | `int` default `2` | guests per room (0004) |
| `bed_note` | `text` default `''` | e.g. `1 king bed · 300 sq ft` (0004) |
| `created_at` | `timestamptz` default `now()` | |

> **Note:** the original per-room `view_options` / `meal_options` JSON columns
> (0001) were migrated into the hotel-level pools and **dropped** in 0003.

#### `rooms` — individual physical units (operations half)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `hotel_id` | `text` → `hotels(id)` on delete cascade | |
| `room_type_id` | `uuid` → `room_types(id)` on delete cascade | |
| `label` | `text` not null | |
| `status` | `room_status` default `ready` | housekeeping board (0002) |
| `created_at` | `timestamptz` default `now()` | |

#### `photos` — gallery for marketing + booking pages

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `hotel_id` | `text` → `hotels(id)` on delete cascade | |
| `reference` | `text` | Google `photo_reference` (`source='google'`) |
| `url` | `text` | storage URL (`source='upload'`) |
| `source` | `text` default `google` | `google` \| `upload` |
| `sort_order` | `int` default `0` | |
| `hidden` | `boolean` default `false` | |
| `is_cover` | `boolean` default `false` | |
| `created_at` | `timestamptz` default `now()` | |
| — | partial unique index on `hotel_id` where `is_cover` | at most one cover per hotel |

#### `bookings`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `hotel_id` | `text` → `hotels(id)` on delete cascade | |
| `room_type_id` | `uuid` → `room_types(id)` on delete **restrict** | |
| `status` | `booking_status` default `pending` | |
| `source` | `text` default `guest` | `guest` \| `staff` \| `manual` |
| `guest_name` / `guest_email` | `text` not null | |
| `check_in` / `check_out` | `date` not null | `check (check_out > check_in)` |
| `view_option_id` / `meal_option_id` | `text` | chosen add-on ids |
| `nights` | `int` not null | |
| `total_price` | `numeric` not null | |
| `note` | `text` | transition note (0002) |
| `decided_at` | `timestamptz` | (0002) |
| `decided_by` | `text` | staff email (0002) |
| `reject_reason` | `text` | (0002) |
| `checkin_token` | `uuid` | issued on accept (0002) |
| `checked_in_at` | `timestamptz` | (0002) |
| `created_at` | `timestamptz` default `now()` | |

#### `notifications` — guest notification queue (0002)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `hotel_id` | `text` → `hotels(id)` on delete cascade | |
| `booking_id` | `uuid` → `bookings(id)` on delete cascade | |
| `type` | `text` not null | `booking_confirmed` \| `booking_rejected` \| `booking_manual` |
| `to_email` | `text` not null | |
| `payload` | `jsonb` default `{}` | |
| `status` | `text` default `queued` | `queued` \| `sent` \| `failed` |
| `created_at` | `timestamptz` default `now()` | |

### Indexes & constraints

| Object | Purpose |
|---|---|
| `memberships_one_owner_per_user` (partial unique, `role='owner'`) | one hotel per owner |
| `photos_one_cover_per_hotel` (partial unique, `is_cover`) | one cover per hotel |
| `bookings_availability_idx` `(room_type_id, status, check_in, check_out)` | availability queries |
| `bookings_checkin_token_idx` (partial unique, token not null) | check-in token lookup |
| `hotels.subdomain` unique | booking page slug |
| `bookings` check `check_out > check_in` | valid date span |

### Stored functions (atomic inventory)

Both live in `0002_operations.sql` and own **all** inventory-decrement logic.
**Inventory-holding statuses** are `confirmed`, `id_submitted`, `checked_in`
(pending does not hold; `completed` is in the past and never overlaps future
spans).

- **`accept_booking(p_booking_id uuid, p_actor text)` → `(ok, reason, token)`**
  Locks the booking row `for update`, verifies it's `pending`, locks the
  `room_types` row to serialize concurrent accepts, counts overlapping holding
  bookings, and confirms **iff** `held < total_inventory` (else `reason='full'`).
  Sets `status='confirmed'`, `decided_at/by`, and issues a `checkin_token`.
  Reasons: `not_found`, `not_pending`, `no_room_type`, `full`.

- **`create_manual_booking(p_hotel_id, p_room_type_id, p_guest_name,
  p_guest_email, p_check_in, p_check_out, p_view_option, p_meal_option,
  p_nights, p_total, p_note, p_actor)` → `(ok, reason, booking_id)`**
  Validates dates, locks the `room_types` row, runs the same capacity check,
  then inserts a `confirmed` / `source='manual'` row with a fresh
  `checkin_token`. Reasons: `bad_dates`, `no_room_type`, `full`.

### Migration order

| # | File | Adds |
|---|---|---|
| 0001 | `0001_foundation.sql` | enums, `themes` (seeded), `hotels`, `memberships`, `room_types`, `rooms`, `photos`, `bookings`, RLS, indexes |
| 0002 | `0002_operations.sql` | booking transition fields, `room_status` + `rooms.status`, `notifications`, `accept_booking()` / `create_manual_booking()` |
| 0003 | `0003_shared_price_options.sql` | **REQUIRED** — hotel-level `view_options`/`meal_options` pools + per-room `*_option_ids`; drops old per-room option columns |
| 0004 | `0004_room_occupancy_bed.sql` | **REQUIRED for onboarding** — `room_types.max_occupancy` + `bed_note` |

Also: create a **public Storage bucket** named `hotel-photos`; optionally run
`supabase/seed_dev.sql` for mock staff + bookings.

---

## Roadmap

- [ ] Real Google OAuth (NextAuth.js)
- [x] Database persistence (Supabase)
- [x] Booking inbox + accept/reject + manual bookings + team roles
- [ ] AI-generated room/property descriptions
- [ ] Booking engine integration
- [ ] Multi-property analytics dashboard
- [ ] White-label hotel page export
