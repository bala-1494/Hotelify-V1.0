'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import { Hotel, Review } from '@/lib/types'
import { useHotels } from '@/hooks/useHotels'
import { photoUrl } from '@/lib/photo'

function Stars({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={`w-${size} h-${size} ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

const PRICE = ['', '$', '$$', '$$$', '$$$$']

export default function HotelPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const { hotels } = useHotels()
  const [hotel, setHotel] = useState<Hotel | null>(null)

  useEffect(() => {
    if (!loading && !user) { router.push('/login'); return }
    if (hotels.length > 0) {
      const found = hotels.find(h => h.id === id)
      found ? setHotel(found) : router.push('/dashboard')
    }
  }, [user, loading, hotels, id, router])

  if (loading || !user || !hotel) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const photo = (ref: string, w = 1200) => photoUrl(ref, w)
  const mapsEmbedKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const isMock = hotel.id.startsWith('mock-')

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {isMock && (
        <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm text-center py-2 px-4">
          Preview mode — this is a mock hotel page generated from your pasted URL, not live Google Places data.
        </div>
      )}

      {/* Hero */}
      <div className="relative h-[55vh] min-h-[420px] bg-gray-900 overflow-hidden">
        {hotel.photoReferences[0] ? (
          <img
            src={photo(hotel.photoReferences[0], 1600)}
            alt={hotel.name}
            className="absolute inset-0 w-full h-full object-cover opacity-75"
          />
        ) : (
          <div className="absolute inset-0 bg-primary opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <p className="text-white/60 text-sm uppercase tracking-widest mb-3 font-medium">
            {hotel.types[0]?.replace(/_/g, ' ')}
            {hotel.priceLevel ? ` · ${PRICE[hotel.priceLevel]}` : ''}
          </p>
          <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
            {hotel.name}
          </h1>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <svg className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <span className="text-white font-bold">{hotel.rating}</span>
              <span className="text-white/70 text-sm">({hotel.totalRatings?.toLocaleString()} reviews)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-6 text-sm text-white">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {hotel.address}
          </span>
          {hotel.phone && (
            <a href={`tel:${hotel.phone}`} className="flex items-center gap-2 hover:text-red-200 transition-colors">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {hotel.phone}
            </a>
          )}
          {hotel.website && (
            <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-red-200 transition-colors underline">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              Visit Website
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-14">

            {/* About */}
            {hotel.description && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
                <p className="text-gray-600 text-lg leading-relaxed">{hotel.description}</p>
              </section>
            )}

            {/* Photo gallery */}
            {hotel.photoReferences.length > 1 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Photos</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {hotel.photoReferences.slice(1, 7).map((ref, i) => (
                    <div key={i} className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                      <img
                        src={photo(ref, 600)}
                        alt={`${hotel.name} ${i + 2}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews */}
            {hotel.reviews.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Guest Reviews</h2>
                  <span className="bg-amber-50 text-amber-700 text-sm font-semibold px-3 py-1 rounded-full">
                    ★ {hotel.rating} from Google
                  </span>
                </div>
                <div className="space-y-5">
                  {hotel.reviews.map((review: Review, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-6">
                      <div className="flex items-start gap-4 mb-3">
                        {review.authorPhoto ? (
                          <img src={review.authorPhoto} alt={review.author} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">{review.author[0]}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-gray-900 truncate">{review.author}</p>
                            <span className="text-gray-400 text-sm flex-shrink-0">{review.relativeTime}</span>
                          </div>
                          <Stars rating={review.rating} />
                        </div>
                      </div>
                      <p className="text-gray-600 leading-relaxed text-sm">{review.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* CTA */}
            <div className="bg-primary rounded-2xl p-6 text-white">
              <h3 className="text-xl font-bold mb-1">Ready to book?</h3>
              <p className="text-red-200 text-sm mb-6">Check availability at {hotel.name}</p>
              <a
                href={hotel.website || hotel.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-white text-primary font-bold py-3 rounded-xl hover:bg-red-50 transition-colors"
              >
                {hotel.website ? 'Book Now' : 'View on Google Maps'}
              </a>
              <a
                href={hotel.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center text-red-200 hover:text-white text-sm mt-3 transition-colors"
              >
                See on Google Maps →
              </a>
            </div>

            {/* Map */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="h-52 bg-gray-100">
                {mapsEmbedKey ? (
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/place?key=${mapsEmbedKey}&q=place_id:${hotel.id}`}
                    className="w-full h-full border-0"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                    Map preview requires API key
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-gray-900">{hotel.address}</p>
                <a href={hotel.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline mt-1 inline-block">
                  Get directions →
                </a>
              </div>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full text-center text-gray-400 text-sm hover:text-gray-600 transition-colors py-2"
            >
              ← Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
