'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import AddHotelModal from '@/components/AddHotelModal'
import { Hotel } from '@/lib/types'
import { DEFAULT_THEME_ID } from '@/lib/themes'
import { useHotels } from '@/hooks/useHotels'
import { photoUrl } from '@/lib/photo'

type Step = 'import' | 'confirm' | 'generating'

const PRICE = ['', '₹', '₹₹', '₹₹₹', '₹₹₹₹']

// Ensure an imported hotel object satisfies the current Hotel shape before we
// preview/persist it (older import paths omit the presentation fields).
function withDefaults(h: Hotel): Hotel {
  return {
    ...h,
    photos: h.photos ?? [],
    themeId: h.themeId ?? DEFAULT_THEME_ID,
    published: h.published ?? false,
    viewOptions: h.viewOptions ?? [],
    mealOptions: h.mealOptions ?? [],
    roomTypes: (h.roomTypes ?? []).map(r => ({
      ...r,
      available: r.available ?? true,
      viewOptionIds: r.viewOptionIds ?? [],
      mealOptionIds: r.mealOptionIds ?? [],
    })),
  }
}

export default function OnboardingPage() {
  const { user, hotelId, loading, membershipLoading } = useAuth()
  const router = useRouter()
  const { addHotel } = useHotels()

  const [step, setStep] = useState<Step>('import')
  const [imported, setImported] = useState<Hotel | null>(null)
  const [error, setError] = useState('')

  // Routing guards: must be signed in; if they already own a hotel, skip.
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!membershipLoading && hotelId) router.replace('/dashboard')
  }, [user, hotelId, loading, membershipLoading, router])

  const handleImported = (hotel: Hotel) => {
    setImported(withDefaults(hotel))
    setError('')
    setStep('confirm')
  }

  const handleGenerate = async () => {
    if (!imported) return
    setStep('generating')
    setError('')
    try {
      await addHotel(imported)
      router.replace(`/dashboard?welcome=1`)
    } catch (e: any) {
      if (e.status === 409 && e.hotelId) {
        router.replace('/dashboard')
        return
      }
      setError(e.message || 'Could not generate your page. Please try again.')
      setStep('confirm')
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple onboarding header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="text-gray-900 font-bold text-xl tracking-tight">hotelify</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-2">
            Welcome{user.name ? `, ${user.name}` : ''}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Let&apos;s set up your hotel</h1>
          <p className="text-gray-500">
            Import your property from Google Maps and we&apos;ll generate a complete booking page.
            You can own one hotel per account.
          </p>
        </div>

        {/* Step indicator */}
        <ol className="flex items-center gap-3 mb-10 text-sm">
          {[
            { key: 'import', label: '1. Import' },
            { key: 'confirm', label: '2. Confirm' },
            { key: 'generating', label: '3. Generate' },
          ].map((s, i) => {
            const active = step === s.key
            const done =
              (s.key === 'import' && step !== 'import') ||
              (s.key === 'confirm' && step === 'generating')
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full font-medium ${
                    active ? 'bg-primary text-white' : done ? 'bg-primary-pale text-primary' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
                {i < 2 && <span className="text-gray-300">→</span>}
              </li>
            )
          })}
        </ol>

        {step === 'confirm' && imported && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="h-52 bg-gray-900 relative">
              {imported.photoReferences[0] ? (
                <img
                  src={photoUrl(imported.photoReferences[0], 1200)}
                  alt={imported.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
              ) : (
                <div className="absolute inset-0 bg-primary opacity-30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <h2 className="text-2xl font-bold text-white">{imported.name}</h2>
                <p className="text-white/70 text-sm">{imported.address}</p>
              </div>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-6 text-sm text-gray-600 mb-5">
                <span>⭐ {imported.rating} ({imported.totalRatings?.toLocaleString()} reviews)</span>
                {imported.priceLevel ? <span>{PRICE[imported.priceLevel]}</span> : null}
                <span>{imported.photoReferences.length} photos</span>
                {imported.phone && <span>{imported.phone}</span>}
              </div>
              {imported.description && (
                <p className="text-gray-500 text-sm mb-5 leading-relaxed">{imported.description}</p>
              )}

              {error && (
                <div className="mb-4 p-3 bg-primary-pale border border-red-200 rounded-xl">
                  <p className="text-sm text-primary">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setImported(null); setStep('import'); setError('') }}
                  className="px-5 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Choose a different hotel
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
                >
                  Generate my booking page →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 flex flex-col items-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Generating your page…</p>
          </div>
        )}
      </main>

      {step === 'import' && (
        <AddHotelModal onAdd={handleImported} onClose={() => { /* onboarding import is required */ }} />
      )}
    </div>
  )
}
