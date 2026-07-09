import { NextResponse } from 'next/server'
import { acceptBooking } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// POST /api/ops/bookings/[id]/accept  (S2.2)
// Optional body { roomTypeId } reassigns before the inventory check.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeOps(req, 'booking:accept')
  if ('error' in auth) return auth.error
  const body = await req.json().catch(() => ({}))
  try {
    const result = await acceptBooking(auth.ctx.hotelId, params.id, auth.ctx.user.email, body?.roomTypeId ?? null)
    // 'full' is a normal outcome the UI acts on (warn + reassign/reject).
    return NextResponse.json(result, { status: result.ok ? 200 : 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
