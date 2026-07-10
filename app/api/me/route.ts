import { NextResponse } from 'next/server'
import { getMembership } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Returns the signed-in user's membership (hotelId + role) so the client auth
// context can route owners to onboarding vs dashboard and gate edit UI.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email') || req.headers.get('x-user-email')
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  try {
    const membership = await getMembership(email)
    return NextResponse.json({
      hotelId: membership?.hotelId ?? null,
      role: membership?.role ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
