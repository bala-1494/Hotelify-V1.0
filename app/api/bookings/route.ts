import { NextResponse } from 'next/server'
import { getHotelBySubdomain, getAvailability, createGuestBooking } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/bookings — guest request-to-book (S1.5). Creates a real bookings row
// with status='pending', source='guest'. Works cross-device (Supabase). This is
// the ONLY booking write the content half performs; it never transitions status.
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      subdomain,
      roomTypeId,
      guestName,
      guestEmail,
      checkIn,
      checkOut,
      viewOptionId,
      mealOptionId,
      nights,
      totalPrice,
    } = body ?? {}

    if (!subdomain || !roomTypeId || !guestName || !guestEmail || !checkIn || !checkOut) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!(new Date(checkOut) > new Date(checkIn))) {
      return NextResponse.json({ error: 'Check-out must be after check-in' }, { status: 400 })
    }

    const hotel = await getHotelBySubdomain(subdomain)
    if (!hotel) return NextResponse.json({ error: 'Hotel not found' }, { status: 404 })
    if (!hotel.published) {
      return NextResponse.json({ error: 'This booking page is not published yet' }, { status: 403 })
    }

    const room = hotel.roomTypes.find(r => r.id === roomTypeId)
    if (!room) return NextResponse.json({ error: 'Room type not found' }, { status: 404 })

    // Guard: don't accept requests for a room with no ACCEPTED-booking headroom
    // or an owner availability toggle that's off. Pending requests are unbounded
    // otherwise, but we still block the obviously-unavailable case.
    const availability = await getAvailability(hotel.id, checkIn, checkOut)
    const avail = availability.find(a => a.roomTypeId === roomTypeId)
    if (avail && !avail.isAvailable) {
      return NextResponse.json({ error: 'Room is not available for those dates' }, { status: 409 })
    }

    const { id } = await createGuestBooking({
      hotelId: hotel.id,
      roomTypeId,
      guestName: String(guestName).trim(),
      guestEmail: String(guestEmail).trim(),
      checkIn,
      checkOut,
      viewOptionId: viewOptionId ?? null,
      mealOptionId: mealOptionId ?? null,
      nights: Number(nights) || 1,
      totalPrice: Number(totalPrice) || 0,
    })

    return NextResponse.json({ bookingId: id, status: 'pending' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
