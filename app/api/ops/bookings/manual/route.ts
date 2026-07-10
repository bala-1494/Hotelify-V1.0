import { NextResponse } from 'next/server'
import { createManualBooking, ManualBookingInput } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// POST /api/ops/bookings/manual — walk-in/phone booking, lands confirmed (S2.4).
export async function POST(req: Request) {
  const auth = await authorizeOps(req, 'booking:manual')
  if ('error' in auth) return auth.error
  try {
    const body = (await req.json()) as ManualBookingInput
    if (!body.roomTypeId || !body.guestName || !body.guestEmail || !body.checkIn || !body.checkOut) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const result = await createManualBooking(auth.ctx.hotelId, body, auth.ctx.user.email)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
