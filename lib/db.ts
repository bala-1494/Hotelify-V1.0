import 'server-only'
import { supabaseAdmin } from './supabase/server'
import { DEFAULT_THEME_ID } from './themes'
import type { Hotel, RoomType, Photo, Review, RoomAvailability, PriceOption } from './types'
import { visiblePhotos } from './photo'

// ---------------------------------------------------------------------------
// Row <-> app-type mapping. DB is snake_case; app types are camelCase and nest
// room types + photos onto the hotel.
// ---------------------------------------------------------------------------

interface HotelRow {
  id: string
  name: string
  address: string
  phone: string | null
  website: string | null
  description: string | null
  price_level: number | null
  rating: number | null
  total_ratings: number | null
  lat: number | null
  lng: number | null
  maps_url: string | null
  types: string[] | null
  reviews: Review[] | null
  subdomain: string
  theme_id: string | null
  published: boolean
  view_options: PriceOption[] | null
  meal_options: PriceOption[] | null
  created_at: string
}

function mapRoomType(r: any): RoomType {
  return {
    id: r.id,
    name: r.name,
    basePrice: Number(r.base_price),
    totalInventory: Number(r.total_inventory),
    amenities: r.amenities ?? [],
    viewOptionIds: r.view_option_ids ?? [],
    mealOptionIds: r.meal_option_ids ?? [],
    available: r.available ?? true,
  }
}

function mapPhoto(p: any): Photo {
  return {
    id: p.id,
    reference: p.reference ?? undefined,
    url: p.url ?? undefined,
    source: p.source === 'upload' ? 'upload' : 'google',
    order: Number(p.sort_order),
    hidden: !!p.hidden,
    isCover: !!p.is_cover,
  }
}

function assembleHotel(row: HotelRow, roomTypeRows: any[], photoRows: any[]): Hotel {
  const photos = photoRows.map(mapPhoto)
  const photoReferences = visiblePhotos(photos)
    .map(p => p.url ?? p.reference)
    .filter((s): s is string => !!s)

  return {
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    description: row.description ?? undefined,
    priceLevel: row.price_level ?? undefined,
    rating: row.rating != null ? Number(row.rating) : 0,
    totalRatings: row.total_ratings ?? 0,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    mapsUrl: row.maps_url ?? '',
    types: row.types ?? [],
    reviews: row.reviews ?? [],
    subdomain: row.subdomain,
    addedAt: row.created_at,
    themeId: row.theme_id ?? DEFAULT_THEME_ID,
    published: row.published,
    viewOptions: row.view_options ?? [],
    mealOptions: row.meal_options ?? [],
    roomTypes: roomTypeRows.sort((a, b) => a.sort_order - b.sort_order).map(mapRoomType),
    photos,
    photoReferences,
  }
}

async function loadChildren(hotelId: string) {
  const db = supabaseAdmin()
  const [rt, ph] = await Promise.all([
    db.from('room_types').select('*').eq('hotel_id', hotelId),
    db.from('photos').select('*').eq('hotel_id', hotelId),
  ])
  if (rt.error) throw rt.error
  if (ph.error) throw ph.error
  return { roomTypeRows: rt.data ?? [], photoRows: ph.data ?? [] }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getHotelById(id: string): Promise<Hotel | null> {
  const db = supabaseAdmin()
  const { data, error } = await db.from('hotels').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { roomTypeRows, photoRows } = await loadChildren(id)
  return assembleHotel(data as HotelRow, roomTypeRows, photoRows)
}

export async function getHotelBySubdomain(subdomain: string): Promise<Hotel | null> {
  const db = supabaseAdmin()
  const { data, error } = await db.from('hotels').select('*').eq('subdomain', subdomain).maybeSingle()
  if (error) throw error
  if (!data) return null
  const { roomTypeRows, photoRows } = await loadChildren(data.id)
  return assembleHotel(data as HotelRow, roomTypeRows, photoRows)
}

export interface Membership {
  hotelId: string
  role: 'owner' | 'manager' | 'front_desk' | 'housekeeping'
}

export async function getMembership(email: string): Promise<Membership | null> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('memberships')
    .select('hotel_id, role')
    .eq('user_email', email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { hotelId: data.hotel_id, role: data.role }
}

// The single hotel an owner has (1-per-owner). Returns null if none yet.
export async function getHotelForOwner(email: string): Promise<Hotel | null> {
  const membership = await getMembership(email)
  if (!membership) return null
  return getHotelById(membership.hotelId)
}

// ---------------------------------------------------------------------------
// Writes (content half only: hotels, room_types, themes, photos, pending bookings)
// ---------------------------------------------------------------------------

// Create a hotel from the imported Hotel object and make `ownerEmail` its owner.
// Enforces one-hotel-per-owner. Seeds photos from photoReferences and a default
// theme. Returns the assembled hotel, or throws { code: 'OWNER_HAS_HOTEL' }.
export async function createHotelForOwner(input: Hotel, ownerEmail: string): Promise<Hotel> {
  const db = supabaseAdmin()

  const existing = await getMembership(ownerEmail)
  if (existing && existing.role === 'owner') {
    const err: any = new Error('Owner already has a hotel')
    err.code = 'OWNER_HAS_HOTEL'
    err.hotelId = existing.hotelId
    throw err
  }

  // Ensure subdomain uniqueness against existing rows.
  const subdomain = await ensureUniqueSubdomain(input.subdomain || input.name)

  const { error: hErr } = await db.from('hotels').upsert({
    id: input.id,
    name: input.name,
    address: input.address ?? '',
    phone: input.phone ?? null,
    website: input.website ?? null,
    description: input.description ?? null,
    price_level: input.priceLevel ?? null,
    rating: input.rating ?? null,
    total_ratings: input.totalRatings ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    maps_url: input.mapsUrl ?? null,
    types: input.types ?? [],
    reviews: input.reviews ?? [],
    subdomain,
    theme_id: DEFAULT_THEME_ID,
    published: false,
    view_options: input.viewOptions ?? [],
    meal_options: input.mealOptions ?? [],
  })
  if (hErr) throw hErr

  // Owner membership.
  const { error: mErr } = await db.from('memberships').insert({
    hotel_id: input.id,
    user_email: ownerEmail,
    role: 'owner',
  })
  if (mErr) throw mErr

  // Seed photos from imported references (first = cover).
  const refs = input.photoReferences ?? []
  if (refs.length > 0) {
    const rows = refs.map((ref, i) => ({
      hotel_id: input.id,
      reference: /^(https?:|data:)/.test(ref) ? null : ref,
      url: /^(https?:|data:)/.test(ref) ? ref : null,
      source: /^(https?:|data:)/.test(ref) ? 'upload' : 'google',
      sort_order: i,
      hidden: false,
      is_cover: i === 0,
    }))
    const { error: pErr } = await db.from('photos').insert(rows)
    if (pErr) throw pErr
  }

  // Seed any imported room types.
  if (input.roomTypes && input.roomTypes.length > 0) {
    await replaceRoomTypes(input.id, input.roomTypes)
  }

  const created = await getHotelById(input.id)
  if (!created) throw new Error('Hotel creation failed')
  return created
}

async function ensureUniqueSubdomain(seed: string): Promise<string> {
  const db = supabaseAdmin()
  const base = seed.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'hotel'
  let candidate = base
  let i = 2
  // Loop until no row uses the candidate.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db.from('hotels').select('id').eq('subdomain', candidate).maybeSingle()
    if (error) throw error
    if (!data) return candidate
    candidate = `${base}-${i++}`
  }
}

// Editable hotel fields (S1.3 theme/publish, S1.4 profile fields).
export interface HotelPatch {
  name?: string
  address?: string
  phone?: string | null
  website?: string | null
  description?: string | null
  priceLevel?: number | null
  themeId?: string
  published?: boolean
  viewOptions?: PriceOption[]
  mealOptions?: PriceOption[]
}

export async function updateHotel(id: string, patch: HotelPatch): Promise<Hotel> {
  const db = supabaseAdmin()
  const row: Record<string, any> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.address !== undefined) row.address = patch.address
  if (patch.phone !== undefined) row.phone = patch.phone
  if (patch.website !== undefined) row.website = patch.website
  if (patch.description !== undefined) row.description = patch.description
  if (patch.priceLevel !== undefined) row.price_level = patch.priceLevel
  if (patch.themeId !== undefined) row.theme_id = patch.themeId
  if (patch.published !== undefined) row.published = patch.published
  if (patch.viewOptions !== undefined) row.view_options = patch.viewOptions
  if (patch.mealOptions !== undefined) row.meal_options = patch.mealOptions

  if (Object.keys(row).length > 0) {
    const { error } = await db.from('hotels').update(row).eq('id', id)
    if (error) throw error
  }
  const updated = await getHotelById(id)
  if (!updated) throw new Error('Hotel not found')
  return updated
}

// Replace the full room-type set for a hotel (matches the editor's
// onChange(roomTypes) contract). The editor mints valid UUIDs for new rows via
// crypto.randomUUID(), so we treat the client-provided id as the stable key:
// existing rows are UPDATEd in place, new rows INSERTed, and dropped rows deleted.
//
// NOTE: this deliberately does NOT use a single multi-row `.upsert()`. PostgREST's
// bulk upsert was silently persisting only the first row's array/jsonb columns
// (`amenities`, `view_option_ids`, `meal_option_ids`) and dropping them for every
// subsequent row — so a second room type's amenities/add-ons never saved. Writing
// each row on its own request (the same targeted `.update().eq('id', …)` pattern
// updateHotel uses) sidesteps that and makes every row's columns persist.
export async function replaceRoomTypes(hotelId: string, roomTypes: RoomType[]): Promise<Hotel> {
  const db = supabaseAdmin()

  // Which room types already exist for this hotel? A client-minted UUID isn't
  // proof of existence (new rows carry UUIDs too), so ask the DB.
  const { data: existingRows, error: exErr } = await db
    .from('room_types')
    .select('id')
    .eq('hotel_id', hotelId)
  if (exErr) throw exErr
  const existingIds = new Set((existingRows ?? []).map(r => r.id as string))

  // Delete removed room types (existing rows no longer in the incoming set).
  const keep = new Set(roomTypes.map(r => r.id).filter(isUuid))
  const toDelete = Array.from(existingIds).filter(id => !keep.has(id))
  if (toDelete.length > 0) {
    const { error } = await db.from('room_types').delete().eq('hotel_id', hotelId).in('id', toDelete)
    if (error) throw error
  }

  // Update existing rows / insert new ones — one request each so a row's full
  // column set (including the array/jsonb columns) is written deterministically.
  for (let i = 0; i < roomTypes.length; i++) {
    const r = roomTypes[i]
    const fields = {
      name: r.name,
      base_price: r.basePrice,
      total_inventory: r.totalInventory,
      amenities: r.amenities ?? [],
      view_option_ids: r.viewOptionIds ?? [],
      meal_option_ids: r.mealOptionIds ?? [],
      available: r.available ?? true,
      sort_order: i,
    }
    if (isUuid(r.id) && existingIds.has(r.id)) {
      const { error } = await db
        .from('room_types')
        .update(fields)
        .eq('id', r.id)
        .eq('hotel_id', hotelId)
      if (error) throw error
    } else {
      const { error } = await db
        .from('room_types')
        // Keep the client UUID as the primary key when valid; fall back to the
        // DB default otherwise (older/non-uuid ids).
        .insert({ ...(isUuid(r.id) ? { id: r.id } : {}), hotel_id: hotelId, ...fields })
      if (error) throw error
    }
  }

  const hotel = await getHotelById(hotelId)
  if (!hotel) throw new Error('Hotel not found')
  return hotel
}

// Replace the ordering/hidden/cover metadata for a hotel's photos.
export async function replacePhotoMeta(
  hotelId: string,
  photos: { id: string; order: number; hidden: boolean; isCover: boolean }[]
): Promise<Hotel> {
  const db = supabaseAdmin()

  // Clear cover first so the partial unique index never trips mid-update.
  const { error: cErr } = await db.from('photos').update({ is_cover: false }).eq('hotel_id', hotelId)
  if (cErr) throw cErr

  for (const p of photos) {
    const { error } = await db
      .from('photos')
      .update({ sort_order: p.order, hidden: p.hidden, is_cover: p.isCover })
      .eq('id', p.id)
      .eq('hotel_id', hotelId)
    if (error) throw error
  }
  const hotel = await getHotelById(hotelId)
  if (!hotel) throw new Error('Hotel not found')
  return hotel
}

export async function addUploadedPhoto(hotelId: string, url: string): Promise<Photo> {
  const db = supabaseAdmin()
  const { data: maxRow } = await db
    .from('photos')
    .select('sort_order')
    .eq('hotel_id', hotelId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextOrder = maxRow ? Number(maxRow.sort_order) + 1 : 0
  const { data, error } = await db
    .from('photos')
    .insert({ hotel_id: hotelId, url, source: 'upload', sort_order: nextOrder, hidden: false, is_cover: false })
    .select('*')
    .single()
  if (error) throw error
  return mapPhoto(data)
}

export async function deletePhoto(hotelId: string, photoId: string): Promise<void> {
  const db = supabaseAdmin()
  const { error } = await db.from('photos').delete().eq('id', photoId).eq('hotel_id', hotelId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Bookings + availability
// ---------------------------------------------------------------------------

export interface NewBooking {
  hotelId: string
  roomTypeId: string
  guestName: string
  guestEmail: string
  checkIn: string
  checkOut: string
  viewOptionId?: string | null
  mealOptionId?: string | null
  nights: number
  totalPrice: number
}

// Create a guest booking request. ALWAYS status='pending', source='guest'.
// The content half never sets any other status — transitions belong to ops.
export async function createGuestBooking(b: NewBooking): Promise<{ id: string }> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('bookings')
    .insert({
      hotel_id: b.hotelId,
      room_type_id: b.roomTypeId,
      status: 'pending',
      source: 'guest',
      guest_name: b.guestName,
      guest_email: b.guestEmail,
      check_in: b.checkIn,
      check_out: b.checkOut,
      view_option_id: b.viewOptionId ?? null,
      meal_option_id: b.mealOptionId ?? null,
      nights: b.nights,
      total_price: b.totalPrice,
    })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id }
}

// Availability for every room type in a hotel over [checkIn, checkOut).
// Counts ONLY confirmed+ bookings (statuses that hold a real room). Pending
// requests do NOT hold inventory. This is a READ of ops-owned state.
const HOLDING_STATUSES = ['confirmed', 'id_submitted', 'checked_in', 'completed']

export async function getAvailability(
  hotelId: string,
  checkIn: string,
  checkOut: string
): Promise<RoomAvailability[]> {
  const db = supabaseAdmin()
  const { roomTypeRows } = await loadChildren(hotelId)

  // Bookings that overlap [checkIn, checkOut): existing.check_in < checkOut AND
  // existing.check_out > checkIn.
  const { data: bookingRows, error } = await db
    .from('bookings')
    .select('room_type_id, status, check_in, check_out')
    .eq('hotel_id', hotelId)
    .in('status', HOLDING_STATUSES)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn)
  if (error) throw error

  const bookedByRoom = new Map<string, number>()
  for (const b of bookingRows ?? []) {
    bookedByRoom.set(b.room_type_id, (bookedByRoom.get(b.room_type_id) ?? 0) + 1)
  }

  return roomTypeRows.map(r => {
    const total = Number(r.total_inventory)
    const booked = bookedByRoom.get(r.id) ?? 0
    const available = Math.max(0, total - booked)
    return {
      roomTypeId: r.id,
      totalInventory: total,
      bookedUnits: booked,
      available,
      isAvailable: (r.available ?? true) && available > 0,
    }
  })
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
