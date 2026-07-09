# Hotelify — Build Status

_AI-powered hotel management software. Import any hotel from Google Maps and generate a full marketing + booking page with photos, reviews, room types, and location data._

**Last updated:** 2026-07-09
**Stage:** MVP (localStorage-backed, mock-import fallback active)

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS — red (`#C41E3A`) & white theme |
| APIs | Google Places API (Place Details, Find Place, Autocomplete, Photo proxy) |
| Maps | Keyless Google Maps embed (`maps.google.com/maps?...&output=embed`) |
| Storage | `localStorage` (MVP — Supabase/Prisma planned) |
| Auth | Mock OAuth via React context (NextAuth.js planned) |

---

## 2. What's Been Built

### 2.1 Authentication (mock)
- `components/AuthProvider.tsx` — auth context + `useAuth` hook.
- Mock Google OAuth login at `app/login/page.tsx`; demo account `admin@hotelify.com`.
- `app/page.tsx` redirects to `/login` or `/dashboard` based on auth state.
- Route guarding on the hotel page (redirects unauthenticated users to `/login`).

### 2.2 Hotel Import Flow
Two ways to add a hotel, both surfaced in `components/AddHotelModal.tsx`:

**A. Search by hotel name (live Places API)**
- Debounced (300ms) autocomplete against `/api/autocomplete`, restricted to `lodging` types.
- Dropdown of predictions (main + secondary text); Enter/click imports the first/selected result by `placeId`.
- Inline feedback for loading, "no hotels found", and network/API errors.

**B. Paste a Google Maps URL (mock fallback — currently active)**
- The live Places import is intentionally bypassed here; pasting any URL generates a deterministic **mock hotel** via `lib/mockHotel.ts` (sample photos, reviews, rating, address).
- Mock IDs are prefixed `mock-`; the hotel page shows a "Preview mode" banner for them.

**URL parsing (`lib/places.ts`)** handles the messy reality of Maps links:
- Expands short links (`maps.app.goo.gl`, `goo.gl/maps`) server-side with a browser User-Agent.
- Extracts `ChIJ...` Place IDs, `@lat,lng` viewports, `/place/Name/` segments, `?cid=`, and hex Feature IDs (`!1s0x…:0x…` → decimal).
- Falls back to Find Place From Text (name + location bias) when only a name is available.

### 2.3 API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/places` | POST | Accept a Maps URL **or** `placeId` → resolve → validate `lodging`/`campground`/`rv_park` → return a structured `Hotel` |
| `/api/autocomplete` | GET | Hotel-name autocomplete (Places Autocomplete, `types=lodging`) |
| `/api/photo` | GET | Proxy Google Places photos server-side (keeps the API key off the client) |

All routes read the server-side `GOOGLE_MAPS_API_KEY` and fail gracefully if it's missing.

### 2.4 Dashboard
- `app/dashboard/page.tsx` — lists saved hotels with an empty-state CTA to add the first hotel.
- Hotels persist in `localStorage` via `hooks/useHotels.ts` (`addHotel`, `updateHotel`, `removeHotel`, `loaded` flag).
- `normalize()` backfills fields added later (`subdomain`, `roomTypes`) so older records keep working with no migration.

### 2.5 Generated Hotel Marketing Page — `app/hotel/[id]/page.tsx`
- Photo gallery, star ratings, review cards, description, address, phone, website, price level.
- **Location map** — embedded via the **keyless** Google Maps embed driven by the hotel's `lat`/`lng` (address fallback). See §3.
- "Preview mode" banner for mock hotels.
- Hosts the room-type editor and the shareable-link panel.

### 2.6 Room Type Management — `components/RoomTypesEditor.tsx`
- Add/edit/remove room types: name, price/night (₹), inventory count.
- Per-room **amenities** (suggested chips: AC, Geyser, WiFi, TV, Balcony… + custom tags).
- Per-room **price options**: View options (e.g. Sea View +₹) and Meal Plans (e.g. Breakfast +₹), each with a price delta.
- Inline editing with expand/collapse cards; changes persist through `updateHotel`.

### 2.7 Shareable Guest Booking Page
- `components/ShareBookingLink.tsx` — generates and copies a `/book/<subdomain>` link.
- Unique per-hotel subdomains via `lib/slug.ts` (`slugify` + collision-suffixing `uniqueSubdomain`).
- `app/book/[subdomain]/page.tsx` — public guest booking flow:
  - Date selection (check-in/out) with live nights calculation.
  - Room selection with view/meal option radio groups and live price total.
  - Lightweight guest "sign in" (name + email), then a `select → confirm → done` step flow.
  - "This is a preview" terminal state — real booking completion is not wired yet.
  - **Note:** booking pages are only visible in the same browser that created the hotel (localStorage-scoped).

---

## 3. Map Rendering (recently fixed)

**Problem:** the hotel page previously embedded the map through the **Maps Embed API** (`maps/embed/v1/place`), which must be separately enabled in Google Cloud and allowed by the API key's restrictions. When it wasn't, Google returned _"This API is not activated on your API project"_ and the map failed to render.

**Fix (commit `614593d`):** switched to Google's **classic keyless embed** (`https://maps.google.com/maps?q=<lat>,<lng>&output=embed`) — no API key, no separately-enabled API, so it can't hit the activation error. It's driven by the hotel's coordinates with a name+address fallback. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is no longer required for the map.

> Open item: the guest booking page (`/book/[subdomain]`) does not yet show a map — the same keyless embed can be dropped in if desired.

---

## 4. Project Structure

```
app/
  layout.tsx              — root layout with AuthProvider
  page.tsx                — redirect to /login or /dashboard
  login/page.tsx          — mock Google OAuth login
  dashboard/page.tsx      — hotel list + Add Hotel empty state
  hotel/[id]/page.tsx     — generated marketing page (photos, reviews, map, room editor)
  book/[subdomain]/page.tsx — public guest booking flow
  api/places/route.ts     — Places import (URL or placeId)
  api/autocomplete/route.ts — hotel-name autocomplete
  api/photo/route.ts      — photo proxy
components/
  AuthProvider.tsx        — auth context + useAuth hook
  Navbar.tsx
  AddHotelModal.tsx       — search + URL import flow
  RoomTypesEditor.tsx     — room type / amenity / price-option management
  ShareBookingLink.tsx    — copyable /book link
lib/
  types.ts                — Hotel, RoomType, PriceOption, Review interfaces
  places.ts               — Maps URL parser + short-link expander
  mockHotel.ts            — deterministic mock hotel generator
  photo.ts                — resolves photo refs (data URI / proxy)
  slug.ts                 — subdomain slug helpers
hooks/
  useHotels.ts            — localStorage hotel CRUD + normalization
```

---

## 5. Data Model (`lib/types.ts`)

- **`Hotel`** — `id, name, rating, totalRatings, address, phone?, website?, description?, photoReferences[], reviews[], types[], lat, lng, addedAt, mapsUrl, priceLevel?, subdomain, roomTypes[]`
- **`RoomType`** — `id, name, basePrice, totalInventory, amenities[], viewOptions[], mealOptions[]`
- **`PriceOption`** — `id, label, priceDelta`
- **`Review`** — `author, authorPhoto?, rating, text, relativeTime`

---

## 6. Environment Variables

```env
GOOGLE_MAPS_API_KEY=              # server-side — Places API + photo proxy
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # (no longer needed by the map since the keyless-embed switch)
```

Setup: `npm install` → `cp .env.example .env.local` → add key → `npm run dev`.

---

## 7. Commit History (feature commits)

| Commit | Summary |
|---|---|
| `9d9f080` | Initial Hotelify app — auth, dashboard, hotel import via Google Places API |
| `7707a27` | Resolve short Google Maps URLs before parsing |
| `8d262b9` | Handle hex Feature ID and dropped-name Maps links |
| `79c7a42` | Fix place ID resolution + add name/address autocomplete |
| `da6cfaa` | Split search/URL CTAs and surface autocomplete feedback |
| `cb47289` | Add mock hotel flow for the Add Hotel URL import |
| `dc6fd71` | Add room type management + shareable guest booking page |
| `614593d` | Fix map not rendering — use keyless Google Maps embed |

---

## 8. Known Limitations / Current State

- **Storage is localStorage only** — hotels and booking pages are per-browser; shared `/book` links don't work across devices yet.
- **Auth is mocked** — no real Google OAuth.
- **URL import is in mock mode** — pasted Maps URLs generate sample data; name-search import uses the live Places API.
- **Bookings are previews** — no real reservation, payment, or inventory decrement.
- No map on the guest booking page yet.

---

## 9. Roadmap (from CLAUDE.md)

- [ ] Real Google OAuth (NextAuth.js)
- [ ] Database persistence (Supabase)
- [ ] AI-generated room/property descriptions
- [ ] Booking engine integration
- [ ] Multi-property analytics dashboard
- [ ] White-label hotel page export
