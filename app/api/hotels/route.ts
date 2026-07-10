import { NextResponse } from 'next/server'
import { getHotelForOwner, createHotelForOwner } from '@/lib/db'
import { userFromRequest } from '@/lib/apiAuth'
import type { Hotel } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/hotels — the signed-in owner's hotel (0 or 1), assembled with room
// types and photos. Drives onboarding-vs-dashboard routing and the editor.
export async function GET(req: Request) {
  const user = userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const hotel = await getHotelForOwner(user.email)
    return NextResponse.json({ hotel })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}

// POST /api/hotels — create the owner's hotel from an imported Hotel object.
// Enforces one-hotel-per-owner (409 with the existing hotelId).
export async function POST(req: Request) {
  const user = userFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const body = (await req.json()) as { hotel: Hotel }
    if (!body?.hotel?.id) return NextResponse.json({ error: 'hotel required' }, { status: 400 })
    const hotel = await createHotelForOwner(body.hotel, user.email)
    return NextResponse.json({ hotel })
  } catch (e: any) {
    if (e.code === 'OWNER_HAS_HOTEL') {
      return NextResponse.json(
        { error: 'You already have a hotel', hotelId: e.hotelId },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
