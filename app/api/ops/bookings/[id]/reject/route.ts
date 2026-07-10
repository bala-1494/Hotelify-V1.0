import { NextResponse } from 'next/server'
import { rejectBooking } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// POST /api/ops/bookings/[id]/reject { reason }  (S2.3)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeOps(req, 'booking:reject')
  if ('error' in auth) return auth.error
  const body = await req.json().catch(() => ({}))
  try {
    const result = await rejectBooking(auth.ctx.hotelId, params.id, auth.ctx.user.email, body?.reason ?? '')
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
