import { NextResponse } from 'next/server'
import { getHotelBySubdomain, getAvailability } from '@/lib/db'

export const dynamic = 'force-dynamic'

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// GET /api/book/[subdomain]?checkIn=&checkOut=
// Public, cross-device read of the guest booking page: the hotel plus per-room
// availability for the requested date range (S1.6). Availability counts only
// CONFIRMED bookings — pending requests never hold inventory.
export async function GET(req: Request, { params }: { params: { subdomain: string } }) {
  const { searchParams } = new URL(req.url)
  try {
    const hotel = await getHotelBySubdomain(params.subdomain)
    if (!hotel) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const checkIn = searchParams.get('checkIn') || isoDate(today)
    const checkOut = searchParams.get('checkOut') || isoDate(tomorrow)

    const availability = await getAvailability(hotel.id, checkIn, checkOut)

    return NextResponse.json({ hotel, availability, published: hotel.published })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
