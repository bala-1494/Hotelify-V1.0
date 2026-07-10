import { NextResponse } from 'next/server'
import { getMemberById, changeMemberRole, removeMember } from '@/lib/ops'
import { authorizeOps } from '@/lib/apiAuth'
import type { MemberRole } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ROLES: MemberRole[] = ['owner', 'manager', 'front_desk', 'housekeeping']

// PATCH /api/ops/team/[id] { role } — change a member's role (S2.6).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const role: MemberRole = body?.role
  if (!ROLES.includes(role)) return NextResponse.json({ error: 'valid role required' }, { status: 400 })

  // We must be allowed to act on both the member's CURRENT role and the NEW role
  // (a Manager can't promote someone into Manager/Owner, nor touch one).
  const authCurrent = await authorizeOps(req, 'team:changeRole', { targetRole: role })
  if ('error' in authCurrent) return authCurrent.error
  try {
    const existing = await getMemberById(authCurrent.ctx.hotelId, params.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const authExisting = await authorizeOps(req, 'team:changeRole', { targetRole: existing.role })
    if ('error' in authExisting) return authExisting.error

    await changeMemberRole(authCurrent.ctx.hotelId, params.id, role)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}

// DELETE /api/ops/team/[id] — remove a member (S2.6).
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  // Resolve the target's role first so the gate can enforce Manager limits.
  const probe = await authorizeOps(req, 'team:view')
  if ('error' in probe) return probe.error
  try {
    const existing = await getMemberById(probe.ctx.hotelId, params.id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const auth = await authorizeOps(req, 'team:remove', { targetRole: existing.role })
    if ('error' in auth) return auth.error

    const result = await removeMember(auth.ctx.hotelId, params.id)
    if (!result.ok) {
      const status = result.reason === 'last_owner' ? 409 : 400
      return NextResponse.json({ error: result.reason }, { status })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'error' }, { status: 500 })
  }
}
