'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import AddHotelModal from '@/components/AddHotelModal'
import { Hotel } from '@/lib/types'
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
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const { hotels, addHotel } = useHotels()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const handleAddHotel = (hotel: Hotel) => {
    addHotel(hotel)
    router.push(`/hotel/${hotel.id}`)
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <div className="w-24 h-24 bg-primary-pale rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">Add your first hotel</h1>
              <p className="text-gray-400 mb-8 leading-relaxed">
                Import any hotel from Google Maps. We'll verify the property and generate a complete marketing page with photos, reviews, and location details.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-xl font-semibold hover:bg-primary-dark transition-colors shadow-lg shadow-red-100"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Hotel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Your Hotels</h1>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-primary-dark transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Hotel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotels.map(hotel => (
                <div
                  key={hotel.id}
                  onClick={() => router.push(`/hotel/${hotel.id}`)}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                >
                  {hotel.photoReferences[0] ? (
                    <div className="h-48 bg-gray-100 overflow-hidden">
                      <img
                        src={photoUrl(hotel.photoReferences[0], 600)}
                        alt={hotel.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-48 bg-primary-pale flex items-center justify-center">
                      <svg className="w-16 h-16 text-primary opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 text-lg mb-1 truncate">{hotel.name}</h3>
                    <p className="text-gray-400 text-sm mb-3 truncate">{hotel.address}</p>
                    <div className="flex items-center gap-1.5">
                      <StarIcon />
                      <span className="text-gray-900 font-semibold text-sm">{hotel.rating}</span>
                      <span className="text-gray-400 text-sm">({hotel.totalRatings?.toLocaleString()})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showModal && (
        <AddHotelModal onClose={() => setShowModal(false)} onAdd={handleAddHotel} />
      )}
    </div>
  )
}
