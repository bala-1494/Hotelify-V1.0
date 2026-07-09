'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'

export default function RootPage() {
  const { user, hotelId, loading, membershipLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    // Wait until we know whether this owner has a hotel yet.
    if (membershipLoading) return
    router.replace(hotelId ? '/dashboard' : '/onboarding')
  }, [user, hotelId, loading, membershipLoading, router])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
