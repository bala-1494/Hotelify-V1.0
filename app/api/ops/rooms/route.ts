import { NextResponse } from 'next/server'
import { listRooms } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// GET /api/ops/rooms — housekeeping room-status board (S2.7).
export async function GET(req: Request) {
  const auth = await authorizeOps(req, 'room:view')
  if ('error' in auth) return auth.error
  try {
    const rooms = await listRooms(auth.ctx.hotelId)
    return NextResponse.json({ rooms })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
