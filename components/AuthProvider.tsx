'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { Role } from '@/lib/permissions'

interface User {
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  // The hotel this user is a member of (owns/manages), if any, and their role
  // for it. Populated from the memberships table via /api/me. null until the
  // owner has completed onboarding (created their hotel).
  hotelId: string | null
  role: Role | null
  signIn: () => void
  signOut: () => void
  // Re-fetch membership after onboarding creates the hotel.
  refreshMembership: () => Promise<void>
  loading: boolean
  membershipLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  hotelId: null,
  role: null,
  signIn: () => {},
  signOut: () => {},
  refreshMembership: async () => {},
  loading: true,
  membershipLoading: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)
  const [membershipLoading, setMembershipLoading] = useState(false)

  const loadMembership = useCallback(async (email: string) => {
    setMembershipLoading(true)
    try {
      const res = await fetch(`/api/me?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        setHotelId(data.hotelId ?? null)
        setRole(data.role ?? null)
      } else {
        setHotelId(null)
        setRole(null)
      }
    } catch {
      setHotelId(null)
      setRole(null)
    } finally {
      setMembershipLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('hotelify_user')
    if (stored) {
      const u: User = JSON.parse(stored)
      setUser(u)
      loadMembership(u.email)
    }
    setLoading(false)
  }, [loadMembership])

  const signIn = () => {
    const mockUser: User = { email: 'admin@hotelify.com', name: 'Admin' }
    setUser(mockUser)
    localStorage.setItem('hotelify_user', JSON.stringify(mockUser))
    loadMembership(mockUser.email)
  }

  const signOut = () => {
    setUser(null)
    setHotelId(null)
    setRole(null)
    localStorage.removeItem('hotelify_user')
  }

  const refreshMembership = useCallback(async () => {
    if (user) await loadMembership(user.email)
  }, [user, loadMembership])

  return (
    <AuthContext.Provider
      value={{ user, hotelId, role, signIn, signOut, refreshMembership, loading, membershipLoading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
