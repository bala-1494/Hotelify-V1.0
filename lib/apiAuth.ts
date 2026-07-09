import 'server-only'
import { NextResponse } from 'next/server'
import { getMembership } from './db'
import { can, Action, Role, AuthUser } from './permissions'

// MVP identity: the mock auth layer sends the signed-in owner's email in the
// `x-user-email` header. When real session auth lands (NextAuth), swap this for
// a verified session lookup — every route already funnels through here.
export function userFromRequest(req: Request): AuthUser | null {
  const email = req.headers.get('x-user-email')
  if (!email) return null
  return { email }
}

export interface ContentContext {
  user: AuthUser
  role: Role
}

// Authorize a content-editing action against a specific hotel. Returns either a
// ready-to-return error response, or the authorized context.
export async function authorizeContent(
  req: Request,
  hotelId: string,
  action: Action
): Promise<{ error: NextResponse } | { ctx: ContentContext }> {
  const user = userFromRequest(req)
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  const membership = await getMembership(user.email)
  const role = membership?.hotelId === hotelId ? membership.role : null

  if (!can(user, action, { hotelId, role })) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ctx: { user, role: role as Role } }
}

export interface ActorContext {
  user: AuthUser
  role: Role
  hotelId: string
}

// Authorize an operations action. Unlike content actions (scoped to a hotel id
// in the URL), ops actions run against the actor's OWN hotel, resolved from
// their membership. `targetRole` is required for team actions so the gate can
// enforce Manager-can't-touch-Owner/Manager rules.
export async function authorizeOps(
  req: Request,
  action: Action,
  opts: { targetRole?: Role | null } = {}
): Promise<{ error: NextResponse } | { ctx: ActorContext }> {
  const user = userFromRequest(req)
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  const membership = await getMembership(user.email)
  if (!membership) return { error: NextResponse.json({ error: 'No hotel membership' }, { status: 403 }) }

  const { hotelId, role } = membership
  if (!can(user, action, { hotelId, role, targetRole: opts.targetRole ?? null })) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ctx: { user, role, hotelId } }
}
