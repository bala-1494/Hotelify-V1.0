// Permission gate shared across the app. can(user, action, resource) is the
// single source of truth for role-based access; import it, never reimplement.
//
// Roles (see member_role enum) and their limits:
//   owner        — everything (billing, delete, invite/remove anyone).
//   manager      — edit page/rooms, accept/reject, manual bookings, invite
//                  Front-desk & Housekeeping. No billing/delete; can't touch
//                  Owners/Managers.
//   front_desk   — view/accept/reject, manual bookings, run check-in. No
//                  editing/inviting.
//   housekeeping — room-status board only.

export type Role = 'owner' | 'manager' | 'front_desk' | 'housekeeping'

export interface AuthUser {
  email: string
  name?: string
}

export type Action =
  // content editing (storefront half)
  | 'hotel:edit'
  | 'hotel:publish'
  | 'roomType:edit'
  | 'photo:manage'
  | 'theme:edit'
  // booking lifecycle (operations half)
  | 'booking:read'
  | 'booking:create'      // legacy alias for manual create
  | 'booking:accept'
  | 'booking:reject'
  | 'booking:checkin'
  | 'booking:manual'
  | 'inventory:manage'
  // rooms / housekeeping
  | 'room:view'
  | 'room:status'         // advance dirty→cleaning→ready
  | 'room:manage'         // create/seed physical rooms
  // team / account
  | 'team:view'
  | 'team:invite'
  | 'team:changeRole'
  | 'team:remove'
  | 'billing'
  | 'hotel:delete'

export interface Resource {
  hotelId: string
  // The role the actor holds *for this hotel* (from memberships). Undefined =>
  // no membership => no access.
  role?: Role | null
  // For team actions, the role of the member being invited/changed/removed.
  targetRole?: Role | null
}

const CONTENT_ROLES: Role[] = ['owner', 'manager']
const DESK_ROLES: Role[] = ['owner', 'manager', 'front_desk']
const ALL_ROLES: Role[] = ['owner', 'manager', 'front_desk', 'housekeeping']

// Roles a Manager is allowed to invite / change / remove.
const MANAGER_TEAM_TARGETS: Role[] = ['front_desk', 'housekeeping']

export function can(user: AuthUser | null, action: Action, resource: Resource): boolean {
  if (!user) return false
  const role = resource.role
  if (!role) return false
  const target = resource.targetRole ?? null

  switch (action) {
    // ---- content editing (owner/manager) --------------------------------
    case 'hotel:edit':
    case 'hotel:publish':
    case 'roomType:edit':
    case 'photo:manage':
    case 'theme:edit':
      return CONTENT_ROLES.includes(role)

    // ---- bookings --------------------------------------------------------
    case 'booking:read':
      // Housekeeping sees only the room board, not the bookings inbox.
      return DESK_ROLES.includes(role)

    case 'booking:create':
    case 'booking:manual':
    case 'booking:accept':
    case 'booking:reject':
    case 'booking:checkin':
    case 'inventory:manage':
      return DESK_ROLES.includes(role)

    // ---- rooms / housekeeping -------------------------------------------
    case 'room:view':
      return ALL_ROLES.includes(role)

    case 'room:status':
      // Housekeeping's core action; owners/managers can also drive the board.
      return role === 'owner' || role === 'manager' || role === 'housekeeping'

    case 'room:manage':
      return CONTENT_ROLES.includes(role)

    // ---- team / account --------------------------------------------------
    case 'team:view':
      return CONTENT_ROLES.includes(role)

    case 'team:invite':
    case 'team:changeRole':
    case 'team:remove':
      if (role === 'owner') return true
      if (role === 'manager') {
        // Managers act only on Front-desk & Housekeeping.
        return !!target && MANAGER_TEAM_TARGETS.includes(target)
      }
      return false

    case 'billing':
    case 'hotel:delete':
      return role === 'owner'

    default:
      return false
  }
}

// Where each role should land after login (S2.6).
export function landingPath(role: Role | null | undefined): string {
  switch (role) {
    case 'front_desk':
      return '/bookings'
    case 'housekeeping':
      return '/rooms'
    case 'owner':
    case 'manager':
    default:
      return '/dashboard'
  }
}
