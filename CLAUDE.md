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
`member_role` enums. RLS is on with no public policies; the app reads/writes only
through the service-role client (`lib/supabase/server.ts`). All DB helpers live in
`lib/db.ts`. Custom photo uploads go to the `hotel-photos` Storage bucket.

**Write boundary (content half):** this codebase writes `hotels`, `room_types`,
`themes`, `photos`, and NEW `bookings` rows with `status='pending'` only. It never
transitions a booking's status and never decrements inventory — those belong to the
operations half. Availability is computed by *reading* confirmed bookings.

### Owner onboarding flow (S1.1)
1. Root router (`app/page.tsx`) sends owners with no hotel to `/onboarding`, others to
   `/dashboard` (one hotel per owner, enforced by a partial unique index + `createHotelForOwner`).
2. `/onboarding` imports via `AddHotelModal` → confirm step → `POST /api/hotels` creates
   the hotel, owner membership, seeds photos + default theme, generates the page.
3. `/dashboard` shows the hotel + a first-run checklist (`OnboardingChecklist`).

### Guest booking flow (S1.5 / S1.6)
`app/book/[subdomain]` reads `GET /api/book/[subdomain]?checkIn=&checkOut=` (hotel +
per-room availability). The terminal step `POST /api/bookings` creates a real
`status='pending'`, `source='guest'` row (cross-device). A room shows as unavailable
only when confirmed bookings exhaust its inventory for the dates, or the owner's
availability toggle is off — pending requests never hold inventory.

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

### Key Files
```
app/
  page.tsx                — onboarding-vs-dashboard router
  onboarding/page.tsx     — import → confirm → generate
  dashboard/page.tsx      — hotel card + first-run checklist
  hotel/[id]/page.tsx     — owner console (edit fields/photos/theme/rooms)
  book/[subdomain]/page.tsx — guest booking + availability
  api/…                   — see table above
components/
  AuthProvider.tsx        — auth context {user, role, hotelId}
  OnboardingChecklist.tsx — first-run checklist (S1.1)
  PhotoManager.tsx        — reorder/hide/cover/upload (S1.2)
  ThemePicker.tsx         — theme picker + live preview + publish (S1.3)
  EditableField.tsx       — inline field editing (S1.4)
  RoomTypesEditor.tsx     — room types + availability toggle (S1.6)
lib/
  supabase/server.ts      — service-role client + bucket name
  db.ts                   — all DB helpers (row<->type mapping)
  permissions.ts          — can(user, action, resource)
  apiClient.ts / apiAuth.ts — client fetch + server auth helpers
  themes.ts               — theme presets (mirror themes table)
hooks/
  useHotels.ts            — Supabase-backed owner hotel
supabase/
  migrations/0001_foundation.sql — schema + seed themes
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
# Run supabase/migrations/0001_foundation.sql in the Supabase SQL editor
# Create a public Storage bucket named `hotel-photos`
npm run dev
```

## Roadmap

- [ ] Real Google OAuth (NextAuth.js)
- [x] Database persistence (Supabase)
- [ ] AI-generated room/property descriptions
- [ ] Booking engine integration
- [ ] Multi-property analytics dashboard
- [ ] White-label hotel page export
