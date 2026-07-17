'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Hotel, RoomType, RoomAvailability, PriceOption } from '@/lib/types'
import { coverPhoto, resolvePhoto } from '@/lib/photo'
import { getTheme, themeVars } from '@/lib/themes'

function todayStr(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

// Resolve a room's opted-in ids against the hotel's shared add-on pool.
function pickOptions(pool: PriceOption[], ids: string[]): PriceOption[] {
  return pool.filter(o => ids.includes(o.id))
}

type Step = 'select' | 'confirm' | 'done'

interface BookData {
  hotel: Hotel
  availability: RoomAvailability[]
  published: boolean
}

export default function GuestBookingPage() {
  const { subdomain } = useParams<{ subdomain: string }>()

  const [data, setData] = useState<BookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [guestUser, setGuestUser] = useState<{ name: string; email: string } | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)
  const [checkIn, setCheckIn] = useState(todayStr())
  const [checkOut, setCheckOut] = useState(todayStr(1))
  const [step, setStep] = useState<Step>('select')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Load hotel + availability for the selected date range. Re-runs when dates
  // change so availability (S1.6) always reflects the chosen stay.
  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/book/${subdomain}?checkIn=${checkIn}&checkOut=${checkOut}`,
        { cache: 'no-store' }
      )
      if (!res.ok) { setLoadError(true); setData(null); return }
      const json: BookData = await res.json()
      setData(json)
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [subdomain, checkIn, checkOut])

  useEffect(() => { load() }, [load])

  const hotel = data?.hotel ?? null
  const availabilityFor = (roomId: string): RoomAvailability | undefined =>
    data?.availability.find(a => a.roomTypeId === roomId)

  // Seed default selection to the first AVAILABLE room once data arrives.
  useEffect(() => {
    if (hotel && selectedRoomId === null && hotel.roomTypes.length > 0) {
      const firstAvailable = hotel.roomTypes.find(r => availabilityFor(r.id)?.isAvailable)
      setSelectedRoomId((firstAvailable ?? hotel.roomTypes[0]).id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotel, selectedRoomId])

  const selectedRoom = hotel?.roomTypes.find(r => r.id === selectedRoomId) ?? null
  const selectedAvail = selectedRoom ? availabilityFor(selectedRoom.id) : undefined

  const nights = useMemo(() => {
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    return diff > 0 ? diff : 1
  }, [checkIn, checkOut])

  const selectedViewOptions = hotel && selectedRoom ? pickOptions(hotel.viewOptions, selectedRoom.viewOptionIds) : []
  const selectedMealOptions = hotel && selectedRoom ? pickOptions(hotel.mealOptions, selectedRoom.mealOptionIds) : []
  const viewDelta = selectedViewOptions.find(o => o.id === selectedViewId)?.priceDelta ?? 0
  const mealDelta = selectedMealOptions.find(o => o.id === selectedMealId)?.priceDelta ?? 0
  const perNight = (selectedRoom?.basePrice ?? 0) + viewDelta + mealDelta
  const total = perNight * nights

  const selectRoom = (room: RoomType) => {
    if (!availabilityFor(room.id)?.isAvailable) return
    setSelectedRoomId(room.id)
    setSelectedViewId(null)
    setSelectedMealId(null)
    setStep('select')
  }

  const handleBookNow = () => {
    if (!selectedRoom || !selectedAvail?.isAvailable) return
    if (!guestUser) { setShowLogin(true); return }
    setStep('confirm')
  }

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginName.trim() || !loginEmail.trim()) return
    setGuestUser({ name: loginName.trim(), email: loginEmail.trim() })
    setShowLogin(false)
    setStep('confirm')
  }

  // S1.5: create a real pending booking (cross-device via Supabase).
  const handleConfirm = async () => {
    if (!selectedRoom || !guestUser || !hotel) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain,
          roomTypeId: selectedRoom.id,
          guestName: guestUser.name,
          guestEmail: guestUser.email,
          checkIn,
          checkOut,
          viewOptionId: selectedViewId,
          mealOptionId: selectedMealId,
          nights,
          totalPrice: total,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setSubmitError(json.error || 'Could not submit your request.'); return }
      setStep('done')
      load() // refresh availability after booking
    } catch {
      setSubmitError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError || !hotel) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking page not found</h1>
          <p className="text-gray-400 text-sm">
            This booking link isn&apos;t valid. Double-check the URL, or contact the hotel.
          </p>
        </div>
      </div>
    )
  }

  const theme = getTheme(hotel.themeId)
  const cover = coverPhoto(hotel.photos)
  const published = data?.published ?? false

  const hasCoords =
    Number.isFinite(hotel.lat) && Number.isFinite(hotel.lng) && (hotel.lat !== 0 || hotel.lng !== 0)
  const mapQuery = hasCoords ? `${hotel.lat},${hotel.lng} (${hotel.name})` : `${hotel.name} ${hotel.address}`
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`

  return (
    <div className="min-h-screen bg-gray-50" style={themeVars(theme)}>
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: theme.primary }}>
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="text-gray-900 font-bold text-xl tracking-tight">hotelify</span>
          </div>
          {guestUser && <span className="text-sm text-gray-400">Signed in as {guestUser.name}</span>}
        </div>
      </nav>

      {!published && (
        <div className="bg-amber-50 border-b border-amber-100 text-amber-800 text-sm text-center py-2 px-4">
          This booking page is not published yet. You can browse, but requests are disabled until the hotel publishes.
        </div>
      )}

      {/* Hero */}
      <div className="relative h-64 overflow-hidden" style={{ background: theme.primaryDark }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolvePhoto(cover, 1200)} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover opacity-70" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 max-w-5xl mx-auto px-4 sm:px-6 pb-6">
          <h1 className="text-3xl font-bold text-white mb-1">{hotel.name}</h1>
          <p className="text-white/70 text-sm">{hotel.address}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Room selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Select dates</h2>
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                <input
                  type="date"
                  value={checkIn}
                  min={todayStr()}
                  onChange={e => {
                    setCheckIn(e.target.value)
                    if (new Date(checkOut) <= new Date(e.target.value)) {
                      const next = new Date(e.target.value)
                      next.setDate(next.getDate() + 1)
                      setCheckOut(next.toISOString().slice(0, 10))
                    }
                  }}
                  className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={todayStr(1)}
                  onChange={e => setCheckOut(e.target.value)}
                  className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Availability below reflects confirmed bookings for these dates.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Room types</h2>
            {hotel.roomTypes.length === 0 && (
              <p className="text-gray-400 text-sm">This hotel hasn&apos;t added any room types yet.</p>
            )}
            <div className="space-y-4">
              {hotel.roomTypes.map(room => {
                const avail = availabilityFor(room.id)
                const isAvailable = avail?.isAvailable ?? true
                const active = room.id === selectedRoomId
                return (
                  <div
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`bg-white rounded-2xl p-5 shadow-sm border-2 transition-colors ${
                      !isAvailable
                        ? 'opacity-60 cursor-not-allowed border-transparent'
                        : active
                        ? 'cursor-pointer'
                        : 'cursor-pointer border-transparent hover:border-gray-200'
                    }`}
                    style={active && isAvailable ? { borderColor: theme.primary } : undefined}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{room.name}</p>
                          {!isAvailable && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              {avail && avail.available === 0 && room.available ? 'Sold out for these dates' : 'Unavailable'}
                            </span>
                          )}
                          {isAvailable && avail && avail.available <= 2 && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              Only {avail.available} left
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {room.amenities.map(a => (
                            <span key={a} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{a}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-gray-900">₹{room.basePrice}</p>
                        <p className="text-xs text-gray-400">/ night</p>
                      </div>
                    </div>

                    {active && isAvailable && (() => {
                      const vo = pickOptions(hotel.viewOptions, room.viewOptionIds)
                      const mo = pickOptions(hotel.mealOptions, room.mealOptionIds)
                      if (vo.length === 0 && mo.length === 0) return null
                      return (
                        <div className="mt-4 pt-4 border-t border-gray-50 space-y-3" onClick={e => e.stopPropagation()}>
                          {vo.length > 0 && (
                            <OptionRadioGroup title="View" options={vo} selectedId={selectedViewId} onSelect={setSelectedViewId} theme={theme} />
                          )}
                          {mo.length > 0 && (
                            <OptionRadioGroup title="Meal Plan" options={mo} selectedId={selectedMealId} onSelect={setSelectedMealId} theme={theme} />
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Map on the booking page */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="h-56 bg-gray-100">
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
            </div>
          </div>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm sticky top-24 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Your stay</h3>

            {selectedRoom ? (
              <>
                <div className="text-sm space-y-1.5">
                  <Row label="Room" value={selectedRoom.name} />
                  <Row label="Nights" value={String(nights)} />
                  <Row label="Base price" value={`₹${selectedRoom.basePrice}`} />
                  {viewDelta > 0 && <Row label="View" value={`+₹${viewDelta}`} />}
                  {mealDelta > 0 && <Row label="Meal plan" value={`+₹${mealDelta}`} />}
                </div>
                <div className="flex justify-between items-baseline pt-3 border-t border-gray-100">
                  <span className="text-gray-500 text-sm">Total</span>
                  <span className="text-2xl font-bold text-gray-900">₹{total}</span>
                </div>

                {step === 'select' && (
                  <button
                    onClick={handleBookNow}
                    disabled={!published || !selectedAvail?.isAvailable}
                    className="w-full text-white font-bold py-3 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: theme.primary }}
                  >
                    {selectedAvail?.isAvailable ? 'Request to Book' : 'Not available for these dates'}
                  </button>
                )}

                {step === 'confirm' && (
                  <div className="space-y-3">
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
                      <p><span className="text-gray-400">Guest:</span> {guestUser?.name}</p>
                      <p><span className="text-gray-400">Email:</span> {guestUser?.email}</p>
                      <p><span className="text-gray-400">Dates:</span> {checkIn} → {checkOut}</p>
                      <p className="pt-1 text-gray-400">
                        You&apos;re sending a booking <strong>request</strong>. The hotel will review and confirm.
                      </p>
                    </div>
                    {submitError && <p className="text-sm text-primary">{submitError}</p>}
                    <button
                      onClick={handleConfirm}
                      disabled={submitting}
                      className="w-full text-white font-bold py-3 rounded-xl transition-opacity disabled:opacity-60"
                      style={{ background: theme.primary }}
                    >
                      {submitting ? 'Sending request…' : 'Confirm Request'}
                    </button>
                    <button
                      onClick={() => setStep('select')}
                      className="w-full text-gray-400 text-sm hover:text-gray-600"
                    >
                      Back
                    </button>
                  </div>
                )}

                {step === 'done' && (
                  <div className="rounded-xl p-4 border" style={{ background: theme.accent, borderColor: theme.primary }}>
                    <p className="text-sm font-semibold" style={{ color: theme.primaryDark }}>
                      Request sent! 🎉
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Your request for {selectedRoom.name} ({checkIn} → {checkOut}) is <strong>pending</strong> the hotel&apos;s
                      confirmation. We&apos;ll reach out at {guestUser?.email}.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-400 text-sm">Select a room type to see pricing.</p>
            )}
          </div>
        </div>
      </div>

      {showLogin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Sign in to book</h2>
            <p className="text-sm text-gray-400 mb-5">Just your name and email to continue.</p>
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <input
                value={loginName}
                onChange={e => setLoginName(e.target.value)}
                placeholder="Full name"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
                autoFocus
              />
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Email"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!loginName.trim() || !loginEmail.trim()}
                  className="flex-1 py-2.5 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  style={{ background: theme.primary }}
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  )
}

function OptionRadioGroup({
  title, options, selectedId, onSelect, theme,
}: {
  title: string
  options: { id: string; label: string; priceDelta: number }[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  theme: { primary: string }
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-2">
        <OptionChip active={selectedId === null} onClick={() => onSelect(null)} theme={theme}>None</OptionChip>
        {options.map(o => (
          <OptionChip key={o.id} active={selectedId === o.id} onClick={() => onSelect(o.id)} theme={theme}>
            {o.label} +₹{o.priceDelta}
          </OptionChip>
        ))}
      </div>
    </div>
  )
}

function OptionChip({
  active, onClick, theme, children,
}: { active: boolean; onClick: () => void; theme: { primary: string }; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active ? 'text-white' : 'bg-white text-gray-600 border-gray-200'}`}
      style={active ? { background: theme.primary, borderColor: theme.primary } : undefined}
    >
      {children}
    </button>
  )
}
