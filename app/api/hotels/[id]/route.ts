import { NextResponse } from 'next/server'
import { getHotelById, updateHotel, HotelPatch } from '@/lib/db'
import { authorizeContent } from '@/lib/apiAuth'

export const dynamic = 'force-dynamic'

// GET /api/hotels/[id] — full hotel for the owner editor.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizeContent(req, params.id, 'hotel:edit')
  if ('error' in auth) return auth.error
  try {
    const hotel = await getHotelById(params.id)
    if (!hotel) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ hotel })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}

// PATCH /api/hotels/[id] — edit profile fields (S1.4), theme + publish (S1.3).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json()) as HotelPatch
  // Publishing is gated separately from generic editing.
  const action = 'published' in body || 'themeId' in body ? 'hotel:publish' : 'hotel:edit'
  const auth = await authorizeContent(req, params.id, action)
  if ('error' in auth) return auth.error
  try {
    const hotel = await updateHotel(params.id, body)
    return NextResponse.json({ hotel })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
