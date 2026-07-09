import { NextResponse } from 'next/server'
import { listMembers, inviteMember } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'
import type { MemberRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ROLES: MemberRole[] = ['owner', 'manager', 'front_desk', 'housekeeping']

// GET /api/ops/team — team roster (S2.5).
export async function GET(req: Request) {
  const auth = await authorizeOps(req, 'team:view')
  if ('error' in auth) return auth.error
  try {
    const members = await listMembers(auth.ctx.hotelId, auth.ctx.user.email)
    return NextResponse.json({ members })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}

// POST /api/ops/team { email, role } — invite by email + role (S2.5).
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email: string = body?.email ?? ''
  const role: MemberRole = body?.role
  if (!email || !ROLES.includes(role)) {
    return NextResponse.json({ error: 'email and valid role required' }, { status: 400 })
  }
  // Authorize with the TARGET role so Manager-can't-invite-Owner/Manager is enforced.
  const auth = await authorizeOps(req, 'team:invite', { targetRole: role })
  if ('error' in auth) return auth.error
  try {
    const member = await inviteMember(auth.ctx.hotelId, email, role)
    return NextResponse.json({ member })
  } catch (e: any) {
    if (e.code === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
