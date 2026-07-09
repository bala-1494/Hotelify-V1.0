import { NextResponse } from 'next/server'
import { replaceRoomTypes } from '@/lib/db'
import { authorizeContent } from '@/lib/apiAuth'
import type { RoomType } from '@/lib/types'

export const dynamic = 'force-dynamic'

// PUT /api/hotels/[id]/room-types — replace the full room-type set (matches the
// editor's onChange(roomTypes) contract). Includes the S1.6 `available` toggle.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContent(req, params.id, 'roomType:edit')
  if ('error' in auth) return auth.error
  try {
    const body = (await req.json()) as { roomTypes: RoomType[] }
    const hotel = await replaceRoomTypes(params.id, body.roomTypes ?? [])
    return NextResponse.json({ hotel })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
