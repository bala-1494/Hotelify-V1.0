export interface Hotel {
  id: string
  name: string
  rating: number
  totalRatings: number
  address: string
  phone?: string
  website?: string
  description?: string
  photoReferences: string[]
  reviews: Review[]
  types: string[]
  lat: number
  lng: number
  addedAt: string
  mapsUrl: string
  priceLevel?: number
  subdomain: string
  roomTypes: RoomType[]
  // Owner-configurable presentation (S1.2 / S1.3)
  photos: Photo[]
  themeId: string
  published: boolean
}

export interface PriceOption {
  id: string
  label: string
  priceDelta: number
}

export interface RoomType {
  id: string
  name: string
  basePrice: number
  totalInventory: number
  amenities: string[]
  viewOptions: PriceOption[]
  mealOptions: PriceOption[]
  // S1.6 owner availability toggle — when false the room is hidden from guests
  // regardless of confirmed-booking inventory math.
  available: boolean
}

export interface Photo {
  id: string
  // Exactly one of reference (Google photo_reference) / url (uploaded) is set.
  reference?: string
  url?: string
  source: 'google' | 'upload'
  order: number
  hidden: boolean
  isCover: boolean
}

export interface Review {
  author: string
  authorPhoto?: string
  rating: number
  text: string
  relativeTime: string
}

// Per-room availability for a selected date range, computed server-side from
// CONFIRMED bookings only (pending requests never hold inventory).
export interface RoomAvailability {
  roomTypeId: string
  totalInventory: number
  bookedUnits: number   // confirmed bookings overlapping the range
  available: number     // totalInventory - bookedUnits (never negative)
  isAvailable: boolean  // available > 0 AND owner toggle on
}

// ---------------------------------------------------------------------------
// Operations-half types (bookings inbox, team, rooms)
// ---------------------------------------------------------------------------

export type BookingStatus =
  | 'pending' | 'confirmed' | 'id_submitted' | 'checked_in'
  | 'completed' | 'rejected' | 'cancelled'

export interface Booking {
  id: string
  hotelId: string
  roomTypeId: string
  roomTypeName: string
  status: BookingStatus
  source: string        // guest | manual | staff
  guestName: string
  guestEmail: string
  checkIn: string
  checkOut: string
  viewOptionId?: string | null
  mealOptionId?: string | null
  nights: number
  totalPrice: number
  note?: string | null
  rejectReason?: string | null
  createdAt: string
  decidedAt?: string | null
  checkinToken?: string | null
}

export type MemberRole = 'owner' | 'manager' | 'front_desk' | 'housekeeping'

export interface Member {
  id: string
  email: string
  role: MemberRole
  createdAt: string
  isSelf?: boolean
}

export type RoomStatusValue = 'dirty' | 'cleaning' | 'ready'

export interface Room {
  id: string
  roomTypeId: string
  roomTypeName: string
  label: string
  status: RoomStatusValue
}

// Lightweight room type used by ops (inbox filter + manual booking form).
export interface RoomTypeLite {
  id: string
  name: string
  basePrice: number
  totalInventory: number
  available: boolean
  viewOptions: { id: string; label: string; priceDelta: number }[]
  mealOptions: { id: string; label: string; priceDelta: number }[]
}

// Result of an accept attempt (S2.2). reason='full' means inventory exhausted.
export interface AcceptResult {
  ok: boolean
  reason: string | null
  token?: string | null
}
