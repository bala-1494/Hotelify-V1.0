import { NextResponse } from 'next/server'
import { getBookingByToken } from '@/lib/ops'

export const dynamic = 'force-dynamic'

// GET /api/checkin/[token] — public lookup for the check-in stub (S2.7). The
// token itself is the capability, so no session auth. This is a schema-ready
// stub, not the full ID-upload loop.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const booking = await getBookingByToken(params.token)
    if (!booking) return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
    // Only surface the fields the check-in screen needs.
    return NextResponse.json({
      booking: {
        guestName: booking.guestName,
        hotelName: booking.hotelName,
        roomTypeName: booking.roomTypeName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        status: booking.status,
        nights: booking.nights,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
