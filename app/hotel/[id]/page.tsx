'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import { Hotel, Review, RoomType } from '@/lib/types'
import { apiFetch, apiJson } from '@/lib/apiClient'
import { coverPhoto, resolvePhoto } from '@/lib/photo'
import { getTheme, themeVars } from '@/lib/themes'
import RoomTypesEditor from '@/components/RoomTypesEditor'
import PhotoManager from '@/components/PhotoManager'
import ThemePicker from '@/components/ThemePicker'
import EditableField from '@/components/EditableField'
import ShareBookingLink from '@/components/ShareBookingLink'

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={`w-4 h-4 ${i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-200'}`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

const PRICE = ['', '$', '$$', '$$$', '$$$$']

export default function HotelConsolePage() {
  const { user, loading, hotelId, membershipLoading } = useAuth()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [notFound, setNotFound] = useState(false)

  const refetch = useCallback(async () => {
    try {
      const { hotel } = await apiJson<{ hotel: Hotel }>(`/api/hotels/${id}`)
      setHotel(hotel)
    } catch (e: any) {
      if (e.status === 404 || e.status === 403) setNotFound(true)
    }
  }, [id])

  useEffect(() => {
    if (loading || membershipLoading) return
    if (!user) { router.push('/login'); return }
    // Only the owner/manager of this hotel may open the console.
    if (hotelId && hotelId !== id) { router.replace('/dashboard'); return }
    refetch()
  }, [user, loading, membershipLoading, hotelId, id, router, refetch])

  // ---- mutations -----------------------------------------------------------
  const patchHotel = async (patch: Record<string, any>) => {
    const { hotel } = await apiJson<{ hotel: Hotel }>(`/api/hotels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
    setHotel(hotel)
  }

  const saveRoomTypes = async (roomTypes: RoomType[]) => {
    const { hotel } = await apiJson<{ hotel: Hotel }>(`/api/hotels/${id}/room-types`, {
      method: 'PUT',
      body: JSON.stringify({ roomTypes }),
    })
    setHotel(hotel)
  }

  const savePhotoMeta = async (photos: { id: string; order: number; hidden: boolean; isCover: boolean }[]) => {
    const { hotel } = await apiJson<{ hotel: Hotel }>(`/api/hotels/${id}/photos`, {
      method: 'PUT',
      body: JSON.stringify({ photos }),
    })
    setHotel(hotel)
  }

  const uploadPhoto = async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const res = await apiFetch(`/api/hotels/${id}/photos/upload`, { method: 'POST', body: form })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Upload failed')
    }
    await refetch()
  }

  const deletePhoto = async (photoId: string) => {
    const res = await apiFetch(`/api/hotels/${id}/photos/${photoId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    await refetch()
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="text-center max-w-sm">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Hotel not available</h1>
            <p className="text-gray-400 text-sm mb-6">You don&apos;t have access to this hotel, or it doesn&apos;t exist.</p>
            <button onClick={() => router.push('/dashboard')} className="text-primary font-medium">← Back to dashboard</button>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !user || !hotel) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const theme = getTheme(hotel.themeId)
  const cover = coverPhoto(hotel.photos)
  const isMock = hotel.id.startsWith('mock-')

  const hasCoords =
    Number.isFinite(hotel.lat) && Number.isFinite(hotel.lng) && (hotel.lat !== 0 || hotel.lng !== 0)
  const mapQuery = hasCoords ? `${hotel.lat},${hotel.lng} (${hotel.name})` : `${hotel.name} ${hotel.address}`
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`

  return (
    <div className="min-h-screen bg-white" style={themeVars(theme)}>
      <Navbar />

      {/* Owner console banner */}
      <div className="bg-gray-900 text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Editing mode — changes save automatically.
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${hotel.published ? 'bg-green-500/20 text-green-300' : 'bg-white/10 text-white/60'}`}>
              {hotel.published ? 'Published' : 'Draft'}
            </span>
          </span>
          <a
            href={`/book/${hotel.subdomain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-amber-300"
          >
            View public booking page →
          </a>
        </div>
      </div>

      {isMock && (
        <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm text-center py-2 px-4">
          Preview data — this hotel was generated from a pasted URL, not live Google Places data.
        </div>
      )}

      {/* Hero */}
      <div className="relative h-[45vh] min-h-[360px] overflow-hidden" style={{ background: theme.primaryDark }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvePhoto(cover, 1600)} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover opacity-75" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-white/60 text-sm uppercase tracking-widest font-medium">
              {hotel.types[0]?.replace(/_/g, ' ') || 'lodging'}
            </p>
            {/* Price level editor */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => patchHotel({ priceLevel: n })}
                  className={`text-sm font-bold ${((hotel.priceLevel ?? 0) >= n) ? 'text-white' : 'text-white/30'}`}
                  title={`Set price level to ${PRICE[n]}`}
                >
                  $
                </button>
              ))}
            </div>
          </div>
          <div className="text-4xl md:text-6xl font-bold text-white leading-tight mb-4">
            <EditableField
              value={hotel.name}
              label="hotel name"
              onSave={v => patchHotel({ name: v })}
            />
          </div>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full w-fit">
            <svg className="w-4 h-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span className="text-white font-bold">{hotel.rating}</span>
            <span className="text-white/70 text-sm">({hotel.totalRatings?.toLocaleString()} reviews)</span>
          </div>
        </div>
      </div>

      {/* Info bar (editable address / phone / website) */}
      <div style={{ background: theme.primary }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white items-center">
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <EditableField value={hotel.address} label="address" onSave={v => patchHotel({ address: v })} />
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <EditableField value={hotel.phone ?? ''} label="phone" type="tel" placeholder="Add phone" onSave={v => patchHotel({ phone: v })} />
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <EditableField value={hotel.website ?? ''} label="website" type="url" placeholder="Add website" onSave={v => patchHotel({ website: v })} />
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-14">
            {/* About */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
              <div className="text-gray-600 text-lg leading-relaxed">
                <EditableField
                  value={hotel.description ?? ''}
                  label="description"
                  multiline
                  placeholder="Add a description of your property…"
                  onSave={v => patchHotel({ description: v })}
                />
              </div>
            </section>

            {/* Photos (S1.2) */}
            <PhotoManager
              photos={hotel.photos}
              onSaveMeta={savePhotoMeta}
              onUpload={uploadPhoto}
              onDelete={deletePhoto}
            />

            {/* Room types (S1.6 availability toggle inside) */}
            <div id="rooms">
              <RoomTypesEditor roomTypes={hotel.roomTypes} onChange={saveRoomTypes} />
            </div>

            {/* Theme + publish (S1.3) */}
            <ThemePicker
              hotel={hotel}
              onSelectTheme={id => patchHotel({ themeId: id })}
              onTogglePublish={published => patchHotel({ published })}
            />

            {/* Reviews (read-only) */}
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
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={review.authorPhoto} alt={review.author} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: theme.primary }}>
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
            <ShareBookingLink subdomain={hotel.subdomain} />

            {/* Map */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              <div className="h-52 bg-gray-100">
                <iframe
                  title={`Map showing ${hotel.name}`}
                  src={mapSrc}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
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
