import { NextResponse } from 'next/server'
import { seedRoomsFromTypes } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// POST /api/ops/rooms/seed — scaffold physical rooms from room-type inventory (S2.7).
export async function POST(req: Request) {
  const auth = await authorizeOps(req, 'room:manage')
  if ('error' in auth) return auth.error
  try {
    const created = await seedRoomsFromTypes(auth.ctx.hotelId)
    return NextResponse.json({ created })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
