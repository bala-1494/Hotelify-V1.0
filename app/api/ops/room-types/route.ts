import { NextResponse } from 'next/server'
import { getRoomTypesForHotel } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// GET /api/ops/room-types — room types for the inbox filter + manual form.
export async function GET(req: Request) {
  const auth = await authorizeOps(req, 'booking:read')
  if ('error' in auth) return auth.error
  try {
    const roomTypes = await getRoomTypesForHotel(auth.ctx.hotelId)
    return NextResponse.json({ roomTypes })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
