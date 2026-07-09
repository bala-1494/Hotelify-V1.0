// Permission gate shared across the app. can(user, action, resource) is the
// single source of truth for role-based access; import it, never reimplement.
//
// Roles (see member_role enum): owner, manager, front_desk, housekeeping.
// The guest/owner half only needs the owner/manager content-editing actions;
// the operations half layers booking-lifecycle actions on top of the same gate.

export type Role = 'owner' | 'manager' | 'front_desk' | 'housekeeping'

export interface AuthUser {
  email: string
  name?: string
}

export type Action =
  // content editing (guest/owner half)
  | 'hotel:edit'
  | 'hotel:publish'
  | 'roomType:edit'
  | 'photo:manage'
  | 'theme:edit'
  // booking lifecycle (operations half owns transitions; listed for completeness)
  | 'booking:read'
  | 'booking:create'
  | 'booking:transition'
  | 'inventory:manage'

export interface Resource {
  hotelId: string
  // The role the user holds *for this hotel* (from memberships). Undefined =>
  // no membership => no access.
  role?: Role | null
}

const CONTENT_ROLES: Role[] = ['owner', 'manager']

export function can(user: AuthUser | null, action: Action, resource: Resource): boolean {
  if (!user) return false
  const role = resource.role
  if (!role) return false

  switch (action) {
    case 'hotel:edit':
    case 'hotel:publish':
    case 'roomType:edit':
    case 'photo:manage':
    case 'theme:edit':
      return CONTENT_ROLES.includes(role)

    case 'booking:read':
      // any staff role can read bookings for their hotel
      return true

    case 'booking:create':
      // guests create bookings unauthenticated via the public endpoint; staff
      // may also create. Owners/managers/front-desk can.
      return role === 'owner' || role === 'manager' || role === 'front_desk'

    // Owned by the operations half — the content half must never do these.
    case 'booking:transition':
    case 'inventory:manage':
      return false

    default:
      return false
  }
}
