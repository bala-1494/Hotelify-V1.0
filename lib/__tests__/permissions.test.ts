import { describe, it, expect } from 'vitest'
import { can, landingPath, type Role } from '@/lib/permissions'

const user = { email: 'a@b.com' }
const hotelId = 'h1'
const res = (role: Role | null, targetRole?: Role) => ({ hotelId, role, targetRole })

describe('can() — content editing (roomType:edit and friends)', () => {
  it('lets owners and managers edit room types', () => {
    expect(can(user, 'roomType:edit', res('owner'))).toBe(true)
    expect(can(user, 'roomType:edit', res('manager'))).toBe(true)
  })

  it('blocks front-desk and housekeeping from editing room types', () => {
    expect(can(user, 'roomType:edit', res('front_desk'))).toBe(false)
    expect(can(user, 'roomType:edit', res('housekeeping'))).toBe(false)
  })

  it('denies everyone when there is no user or no membership role', () => {
    expect(can(null, 'roomType:edit', res('owner'))).toBe(false)
    expect(can(user, 'roomType:edit', res(null))).toBe(false)
  })
})

describe('can() — bookings and rooms', () => {
  it('gives desk roles booking access but not housekeeping', () => {
    expect(can(user, 'booking:accept', res('front_desk'))).toBe(true)
    expect(can(user, 'booking:read', res('housekeeping'))).toBe(false)
  })

  it('lets housekeeping drive the room-status board but not manage rooms', () => {
    expect(can(user, 'room:status', res('housekeeping'))).toBe(true)
    expect(can(user, 'room:manage', res('housekeeping'))).toBe(false)
  })
})

describe('can() — team management guardrails', () => {
  it('lets owners act on any target role', () => {
    expect(can(user, 'team:remove', res('owner', 'manager'))).toBe(true)
    expect(can(user, 'team:changeRole', res('owner', 'owner'))).toBe(true)
  })

  it('lets managers act only on front-desk and housekeeping', () => {
    expect(can(user, 'team:invite', res('manager', 'front_desk'))).toBe(true)
    expect(can(user, 'team:invite', res('manager', 'housekeeping'))).toBe(true)
    expect(can(user, 'team:invite', res('manager', 'manager'))).toBe(false)
    expect(can(user, 'team:remove', res('manager', 'owner'))).toBe(false)
  })

  it('restricts billing and hotel deletion to owners', () => {
    expect(can(user, 'billing', res('owner'))).toBe(true)
    expect(can(user, 'hotel:delete', res('manager'))).toBe(false)
  })
})

describe('landingPath()', () => {
  it('routes each role to its home surface', () => {
    expect(landingPath('front_desk')).toBe('/bookings')
    expect(landingPath('housekeeping')).toBe('/rooms')
    expect(landingPath('owner')).toBe('/dashboard')
    expect(landingPath('manager')).toBe('/dashboard')
    expect(landingPath(null)).toBe('/dashboard')
  })
})
