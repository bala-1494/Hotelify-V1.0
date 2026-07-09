import 'server-only'
import { supabaseAdmin } from './supabase/server'
import type {
  Booking, BookingStatus, Member, MemberRole, Room, RoomStatusValue,
  RoomTypeLite, AcceptResult,
} from './types'

export type { RoomTypeLite, AcceptResult } from './types'

// Operations data layer. Owns booking status TRANSITIONS, all inventory
// effects (via the atomic SQL functions), memberships, the physical-rooms
// layer, and the notification queue. Reads storefront-owned tables (hotels,
// room_types) but never writes them.

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------
function mapBooking(r: any): Booking {
  return {
    id: r.id,
    hotelId: r.hotel_id,
    roomTypeId: r.room_type_id,
    roomTypeName: r.room_types?.name ?? '—',
    status: r.status,
    source: r.source,
    guestName: r.guest_name,
    guestEmail: r.guest_email,
    checkIn: r.check_in,
    checkOut: r.check_out,
    viewOptionId: r.view_option_id,
    mealOptionId: r.meal_option_id,
    nights: r.nights,
    totalPrice: Number(r.total_price),
    note: r.note,
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    checkinToken: r.checkin_token,
  }
}

// ---------------------------------------------------------------------------
// Bookings inbox (S2.1)
// ---------------------------------------------------------------------------
export interface BookingFilters {
  status?: BookingStatus
  roomTypeId?: string
  from?: string   // stays overlapping [from, to]
  to?: string
}

export async function listBookings(hotelId: string, filters: BookingFilters = {}): Promise<Booking[]> {
  const db = supabaseAdmin()
  let q = db
    .from('bookings')
    .select('*, room_types(name)')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })

  if (filters.status) q = q.eq('status', filters.status)
  if (filters.roomTypeId) q = q.eq('room_type_id', filters.roomTypeId)
  // Overlap of the stay with the [from, to] window.
  if (filters.from) q = q.gte('check_out', filters.from)
  if (filters.to) q = q.lte('check_in', filters.to)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(mapBooking)
}

async function queueNotification(
  hotelId: string, bookingId: string | null, type: string, toEmail: string, payload: Record<string, any>
) {
  const db = supabaseAdmin()
  await db.from('notifications').insert({
    hotel_id: hotelId, booking_id: bookingId, type, to_email: toEmail, payload,
  })
}

// ---------------------------------------------------------------------------
// Accept (S2.2) — atomic inventory check + confirm
// ---------------------------------------------------------------------------
export async function acceptBooking(
  hotelId: string, bookingId: string, actor: string, reassignRoomTypeId?: string | null
): Promise<AcceptResult> {
  const db = supabaseAdmin()

  // Fetch the booking (scoped to the actor's hotel) for the notification email.
  const { data: bk } = await db
    .from('bookings')
    .select('guest_email, hotel_id')
    .eq('id', bookingId)
    .eq('hotel_id', hotelId)
    .maybeSingle()
  if (!bk) return { ok: false, reason: 'not_found' }

  // Optional reassign to a different room type before the inventory check
  // (only meaningful while still pending). The atomic accept then runs against
  // the new room type.
  if (reassignRoomTypeId) {
    const { error: reErr } = await db
      .from('bookings')
      .update({ room_type_id: reassignRoomTypeId })
      .eq('id', bookingId)
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
    if (reErr) throw reErr
  }

  const { data, error } = await db.rpc('accept_booking', { p_booking_id: bookingId, p_actor: actor })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  const result: AcceptResult = { ok: !!row?.ok, reason: row?.reason ?? null, token: row?.token ?? null }

  if (result.ok) {
    await queueNotification(hotelId, bookingId, 'booking_confirmed', bk.guest_email, { checkinToken: result.token })
  }
  return result
}

// ---------------------------------------------------------------------------
// Reject (S2.3) — no inventory change
// ---------------------------------------------------------------------------
export async function rejectBooking(
  hotelId: string, bookingId: string, actor: string, reason: string
): Promise<{ ok: boolean; reason?: string }> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'rejected', reject_reason: reason || null, decided_at: new Date().toISOString(), decided_by: actor })
    .eq('id', bookingId)
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')
    .select('guest_email')
  if (error) throw error
  if (!data || data.length === 0) return { ok: false, reason: 'not_pending' }

  await queueNotification(hotelId, bookingId, 'booking_rejected', data[0].guest_email, { reason })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Check-in (S2.7 partial) — confirmed/id_submitted -> checked_in
// ---------------------------------------------------------------------------
export async function checkInBooking(
  hotelId: string, bookingId: string
): Promise<{ ok: boolean; reason?: string }> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('bookings')
    .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
    .eq('id', bookingId)
    .eq('hotel_id', hotelId)
    .in('status', ['confirmed', 'id_submitted'])
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) return { ok: false, reason: 'not_checkinable' }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Manual booking (S2.4) — inserts a CONFIRMED row, holds inventory
// ---------------------------------------------------------------------------
export interface ManualBookingInput {
  roomTypeId: string
  guestName: string
  guestEmail: string
  checkIn: string
  checkOut: string
  viewOptionId?: string | null
  mealOptionId?: string | null
  nights: number
  totalPrice: number
  note?: string | null
}

export async function createManualBooking(
  hotelId: string, input: ManualBookingInput, actor: string
): Promise<{ ok: boolean; reason: string | null; bookingId?: string }> {
  const db = supabaseAdmin()
  const { data, error } = await db.rpc('create_manual_booking', {
    p_hotel_id: hotelId,
    p_room_type_id: input.roomTypeId,
    p_guest_name: input.guestName,
    p_guest_email: input.guestEmail,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_view_option: input.viewOptionId ?? null,
    p_meal_option: input.mealOptionId ?? null,
    p_nights: input.nights,
    p_total: input.totalPrice,
    p_note: input.note ?? null,
    p_actor: actor,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  const result = { ok: !!row?.ok, reason: row?.reason ?? null, bookingId: row?.booking_id ?? undefined }
  if (result.ok && input.guestEmail) {
    await queueNotification(hotelId, result.bookingId ?? null, 'booking_manual', input.guestEmail, {})
  }
  return result
}

// ---------------------------------------------------------------------------
// Room types (READ storefront-owned table for filters / manual form)
// ---------------------------------------------------------------------------
export async function getRoomTypesForHotel(hotelId: string): Promise<RoomTypeLite[]> {
  const db = supabaseAdmin()
  const { data, error } = await db.from('room_types').select('*').eq('hotel_id', hotelId).order('sort_order')
  if (error) throw error
  return (data ?? []).map(r => ({
    id: r.id,
    name: r.name,
    basePrice: Number(r.base_price),
    totalInventory: Number(r.total_inventory),
    available: r.available ?? true,
    viewOptions: r.view_options ?? [],
    mealOptions: r.meal_options ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Team / memberships (S2.5 / S2.6)
// ---------------------------------------------------------------------------
export async function listMembers(hotelId: string, selfEmail: string): Promise<Member[]> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('memberships')
    .select('id, user_email, role, created_at')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(m => ({
    id: m.id,
    email: m.user_email,
    role: m.role,
    createdAt: m.created_at,
    isSelf: m.user_email === selfEmail,
  }))
}

export async function getMemberById(hotelId: string, membershipId: string): Promise<Member | null> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('memberships')
    .select('id, user_email, role, created_at')
    .eq('id', membershipId)
    .eq('hotel_id', hotelId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, email: data.user_email, role: data.role, createdAt: data.created_at }
}

export async function inviteMember(hotelId: string, email: string, role: MemberRole): Promise<Member> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('memberships')
    .insert({ hotel_id: hotelId, user_email: email.toLowerCase().trim(), role })
    .select('id, user_email, role, created_at')
    .single()
  if (error) {
    if ((error as any).code === '23505') {
      const e: any = new Error('That email is already on your team')
      e.code = 'ALREADY_MEMBER'
      throw e
    }
    throw error
  }
  return { id: data.id, email: data.user_email, role: data.role, createdAt: data.created_at }
}

export async function changeMemberRole(hotelId: string, membershipId: string, role: MemberRole): Promise<void> {
  const db = supabaseAdmin()
  const { error } = await db.from('memberships').update({ role }).eq('id', membershipId).eq('hotel_id', hotelId)
  if (error) throw error
}

export async function removeMember(hotelId: string, membershipId: string): Promise<{ ok: boolean; reason?: string }> {
  const db = supabaseAdmin()
  // Guard: never remove the last owner.
  const target = await getMemberById(hotelId, membershipId)
  if (!target) return { ok: false, reason: 'not_found' }
  if (target.role === 'owner') {
    const { count } = await db
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', hotelId)
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) return { ok: false, reason: 'last_owner' }
  }
  const { error } = await db.from('memberships').delete().eq('id', membershipId).eq('hotel_id', hotelId)
  if (error) throw error
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Physical rooms + housekeeping board (S2.7)
// ---------------------------------------------------------------------------
export async function listRooms(hotelId: string): Promise<Room[]> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('rooms')
    .select('id, room_type_id, label, status, room_types(name)')
    .eq('hotel_id', hotelId)
    .order('label', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    roomTypeId: r.room_type_id,
    roomTypeName: r.room_types?.name ?? '—',
    label: r.label,
    status: r.status as RoomStatusValue,
  }))
}

export async function setRoomStatus(hotelId: string, roomId: string, status: RoomStatusValue): Promise<void> {
  const db = supabaseAdmin()
  const { error } = await db.from('rooms').update({ status }).eq('id', roomId).eq('hotel_id', hotelId)
  if (error) throw error
}

// Scaffold: top up physical rooms so each room type has `total_inventory` units.
export async function seedRoomsFromTypes(hotelId: string): Promise<number> {
  const db = supabaseAdmin()
  const types = await getRoomTypesForHotel(hotelId)
  const { data: existing, error } = await db.from('rooms').select('room_type_id, label').eq('hotel_id', hotelId)
  if (error) throw error

  const countByType = new Map<string, number>()
  for (const r of existing ?? []) countByType.set(r.room_type_id, (countByType.get(r.room_type_id) ?? 0) + 1)

  const toInsert: { hotel_id: string; room_type_id: string; label: string; status: RoomStatusValue }[] = []
  for (const t of types) {
    const have = countByType.get(t.id) ?? 0
    for (let n = have; n < t.totalInventory; n++) {
      toInsert.push({ hotel_id: hotelId, room_type_id: t.id, label: `${t.name} ${n + 1}`, status: 'ready' })
    }
  }
  if (toInsert.length > 0) {
    const { error: insErr } = await db.from('rooms').insert(toInsert)
    if (insErr) throw insErr
  }
  return toInsert.length
}

// ---------------------------------------------------------------------------
// Check-in token lookup (S2.7 stub)
// ---------------------------------------------------------------------------
export async function getBookingByToken(token: string): Promise<(Booking & { hotelName: string }) | null> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('bookings')
    .select('*, room_types(name), hotels(name)')
    .eq('checkin_token', token)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { ...mapBooking(data), hotelName: (data as any).hotels?.name ?? '' }
}
