'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import { Hotel, RoomType } from '@/lib/types'
import { apiFetch, apiJson } from '@/lib/apiClient'
import RoomTypesEditor from '@/components/RoomTypesEditor'
import PhotoManager from '@/components/PhotoManager'
import ThemePicker from '@/components/ThemePicker'
import BasicInfoStep from '@/components/setup/BasicInfoStep'
import PublishStep from '@/components/setup/PublishStep'
import {
  SETUP_STEPS,
  TOTAL_STEPS,
  stepByIndex,
  clampStep,
  firstIncompleteStep,
  isStepDone,
  loadConfirmed,
  saveConfirmed,
  type SetupStepKey,
} from '@/lib/setupProgress'

// Owner setup wizard (S1.7). Replaces the old single-scroll console with a
// 5-step guided flow: Basic info → Photos → Rooms → Theme → Preview & publish.
// Every step still auto-saves through the same handlers; "Confirm & continue"
// just advances and remembers the step. The dashboard checklist deep-links here
// via ?step=n, and the draft card's Edit CTA resumes at the first open step.

export default function HotelSetupWizardPage() {
  const { user, loading, hotelId, membershipLoading } = useAuth()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [currentStep, setCurrentStep] = useState(0) // 0 = not yet initialized
  const [confirmed, setConfirmed] = useState<Partial<Record<SetupStepKey, boolean>>>({})
  const initedRef = useRef(false)

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

  // Load remembered confirm-state for this hotel.
  useEffect(() => { setConfirmed(loadConfirmed(id)) }, [id])

  // Pick the starting step once the hotel loads: explicit ?step= wins, else
  // resume at the first step the owner hasn't finished.
  useEffect(() => {
    if (!hotel || initedRef.current) return
    initedRef.current = true
    const raw = new URLSearchParams(window.location.search).get('step')
    const initial =
      raw != null && raw !== '' ? clampStep(Number(raw)) : firstIncompleteStep(hotel, loadConfirmed(hotel.id))
    setCurrentStep(initial)
  }, [hotel])

  // ---- mutations -----------------------------------------------------------
  const patchHotel = async (patch: Record<string, any>) => {
    // Optimistically apply the patch so instant controls (price-level buttons,
    // theme swatches, publish toggle) reflect the change immediately instead of
    // waiting on the PATCH round-trip. Reconcile with the server row on success,
    // and roll back to the prior state on failure (EditableField relies on the
    // throw to reset its own draft).
    const prev = hotel
    setHotel(h => (h ? { ...h, ...patch } : h))
    try {
      const { hotel } = await apiJson<{ hotel: Hotel }>(`/api/hotels/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      setHotel(hotel)
    } catch (e) {
      setHotel(prev)
      throw e
    }
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

  // ---- wizard navigation ---------------------------------------------------
  const goToStep = (index: number) => {
    setCurrentStep(clampStep(index))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const markConfirmed = (key: SetupStepKey) => {
    setConfirmed(prev => {
      const next = { ...prev, [key]: true }
      saveConfirmed(id, next)
      return next
    })
  }

  const handlePrimary = () => {
    const step = stepByIndex(currentStep)
    markConfirmed(step.key)
    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1)
    } else {
      router.push('/dashboard')
    }
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

  if (loading || !user || !hotel || currentStep === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isMock = hotel.id.startsWith('mock-')
  const active = stepByIndex(currentStep)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Status bar */}
      <div className="bg-gray-900 text-white text-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Setup — changes save automatically.
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stepper */}
        <ol className="flex items-center gap-2 mb-8 overflow-x-auto pb-1">
          {SETUP_STEPS.map((s, i) => {
            const done = isStepDone(hotel, confirmed, s.key)
            const isCurrent = s.index === currentStep
            return (
              <li key={s.key} className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => goToStep(s.index)}
                  className="flex items-center gap-2 group"
                  title={s.label}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                      isCurrent
                        ? 'bg-primary text-white'
                        : done
                        ? 'bg-primary-pale text-primary'
                        : 'bg-gray-200 text-gray-400 group-hover:bg-gray-300'
                    }`}
                  >
                    {done && !isCurrent ? (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.index
                    )}
                  </span>
                  <span
                    className={`text-sm font-medium whitespace-nowrap ${
                      isCurrent ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'
                    } hidden sm:inline`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < SETUP_STEPS.length - 1 && (
                  <span className="w-5 sm:w-8 h-px bg-gray-200 flex-shrink-0" />
                )}
              </li>
            )
          })}
        </ol>

        {/* Step body */}
        <div className="mb-8">
          {active.key === 'basic' && <BasicInfoStep hotel={hotel} patchHotel={patchHotel} />}

          {active.key === 'photos' && (
            <PhotoManager
              photos={hotel.photos}
              onSaveMeta={savePhotoMeta}
              onUpload={uploadPhoto}
              onDelete={deletePhoto}
            />
          )}

          {active.key === 'rooms' && (
            <RoomTypesEditor roomTypes={hotel.roomTypes} onChange={saveRoomTypes} />
          )}

          {active.key === 'theme' && (
            <ThemePicker hotel={hotel} onSelectTheme={themeId => patchHotel({ themeId })} hidePublish />
          )}

          {active.key === 'publish' && (
            <PublishStep hotel={hotel} onTogglePublish={published => patchHotel({ published })} />
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between gap-4 border-t border-gray-100 pt-6">
          {currentStep > 1 ? (
            <button
              onClick={() => goToStep(currentStep - 1)}
              className="px-5 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-white transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-3 text-gray-400 font-medium hover:text-gray-600 transition-colors"
            >
              Exit to dashboard
            </button>
          )}

          <button
            onClick={handlePrimary}
            className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
          >
            {currentStep < TOTAL_STEPS ? 'Confirm & continue →' : 'Finish → Dashboard'}
          </button>
        </div>
      </main>
    </div>
  )
}
