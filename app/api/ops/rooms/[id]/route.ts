import { NextResponse } from 'next/server'
import { setRoomStatus } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'
import type { RoomStatusValue } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUSES: RoomStatusValue[] = ['dirty', 'cleaning', 'ready']

// PATCH /api/ops/rooms/[id] { status } — advance dirty -> cleaning -> ready.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const status: RoomStatusValue = body?.status
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'valid status required' }, { status: 400 })

  const auth = await authorizeOps(req, 'room:status')
  if ('error' in auth) return auth.error
  try {
    await setRoomStatus(auth.ctx.hotelId, params.id, status)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
