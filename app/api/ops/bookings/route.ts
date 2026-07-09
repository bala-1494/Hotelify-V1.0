import { NextResponse } from 'next/server'
import { listBookings, BookingFilters } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'
import type { BookingStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/ops/bookings?status=&roomTypeId=&from=&to= — bookings inbox (S2.1).
export async function GET(req: Request) {
  const auth = await authorizeOps(req, 'booking:read')
  if ('error' in auth) return auth.error
  const { searchParams } = new URL(req.url)
  const filters: BookingFilters = {
    status: (searchParams.get('status') as BookingStatus) || undefined,
    roomTypeId: searchParams.get('roomTypeId') || undefined,
    from: searchParams.get('from') || undefined,
    to: searchParams.get('to') || undefined,
  }
  try {
    const bookings = await listBookings(auth.ctx.hotelId, filters)
    return NextResponse.json({ bookings })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
