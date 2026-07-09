import { NextResponse } from 'next/server'
import { checkInBooking } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// POST /api/ops/bookings/[id]/checkin — confirmed/id_submitted -> checked_in.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeOps(req, 'booking:checkin')
  if ('error' in auth) return auth.error
  try {
    const result = await checkInBooking(auth.ctx.hotelId, params.id)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
