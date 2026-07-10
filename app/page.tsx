'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { landingPath } from '@/lib/permissions'

export default function RootPage() {
  const { user, role, hotelId, loading, membershipLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // Wait until we know the user's membership (hotel + role).
    if (membershipLoading) return
    // No hotel yet => this is an owner who hasn't onboarded.
    if (!hotelId) {
      router.replace('/onboarding')
      return
    }
    // Role-based landing (S2.6): Owner/Manager -> dashboard, Front-desk ->
    // bookings, Housekeeping -> rooms.
    router.replace(landingPath(role))
  }, [user, role, hotelId, loading, membershipLoading, router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
