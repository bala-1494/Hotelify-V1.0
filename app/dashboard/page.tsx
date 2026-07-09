'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import OnboardingChecklist from '@/components/OnboardingChecklist'
import { useHotels } from '@/hooks/useHotels'
import { photoUrl } from '@/lib/photo'

function StarIcon() {
  return (
    <svg className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  )
}

export default function DashboardPage() {
  const { user, hotelId, loading, membershipLoading } = useAuth()
  const router = useRouter()
  const [isWelcome, setIsWelcome] = useState(false)
  const { hotels, loaded } = useHotels()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsWelcome(new URLSearchParams(window.location.search).get('welcome') === '1')
    }
  }, [])

  // Routing guards (S1.1): signed in, and has a hotel (else onboarding).
  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (!membershipLoading && !hotelId) router.replace('/onboarding')
  }, [user, hotelId, loading, membershipLoading, router])

  if (loading || !user || membershipLoading || !loaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hotel = hotels[0]
  if (!hotel) return null // guard effect is redirecting to onboarding

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isWelcome && (
          <div className="mb-8 p-4 rounded-2xl bg-primary-pale border border-red-100">
            <p className="text-primary font-semibold">🎉 Your booking page is ready!</p>
            <p className="text-sm text-primary/80 mt-0.5">
              Finish the checklist below, then publish to go live.
            </p>
          </div>
        )}

        <OnboardingChecklist hotel={hotel} />

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your hotel</h1>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${
              hotel.published ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {hotel.published ? '● Published' : '○ Draft'}
          </span>
        </div>

        <div
          onClick={() => router.push(`/hotel/${hotel.id}`)}
          className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer md:flex"
        >
          {hotel.photoReferences[0] ? (
            <div className="md:w-72 h-48 md:h-auto bg-gray-100 overflow-hidden flex-shrink-0">
              <img
                src={photoUrl(hotel.photoReferences[0], 600)}
                alt={hotel.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="md:w-72 h-48 bg-primary-pale flex items-center justify-center flex-shrink-0">
              <svg className="w-16 h-16 text-primary opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          <div className="p-6 flex-1">
            <h3 className="font-bold text-gray-900 text-xl mb-1">{hotel.name}</h3>
            <p className="text-gray-400 text-sm mb-3">{hotel.address}</p>
            <div className="flex items-center gap-1.5 mb-4">
              <StarIcon />
              <span className="text-gray-900 font-semibold text-sm">{hotel.rating}</span>
              <span className="text-gray-400 text-sm">({hotel.totalRatings?.toLocaleString()})</span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <span>{hotel.roomTypes.length} room type{hotel.roomTypes.length === 1 ? '' : 's'}</span>
              <span>{hotel.photos.filter(p => !p.hidden).length} photos</span>
            </div>
            <span className="inline-block mt-4 text-primary font-medium text-sm">Manage hotel →</span>
          </div>
        </div>
      </main>
    </div>
  )
}
