'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useHotels } from '@/hooks/useHotels'
import { RoomType } from '@/lib/types'
import { photoUrl } from '@/lib/photo'

function todayStr(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

type Step = 'select' | 'confirm' | 'done'

export default function GuestBookingPage() {
  const { subdomain } = useParams<{ subdomain: string }>()
  const { hotels, loaded } = useHotels()
  const hotel = hotels.find(h => h.subdomain === subdomain)

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

  // hotel loads asynchronously from localStorage, so seed the default
  // selection once it (and its room types) actually become available.
  useEffect(() => {
    if (hotel && selectedRoomId === null && hotel.roomTypes.length > 0) {
      setSelectedRoomId(hotel.roomTypes[0].id)
    }
  }, [hotel, selectedRoomId])

  const selectedRoom = hotel?.roomTypes.find(r => r.id === selectedRoomId) ?? null

  const nights = useMemo(() => {
    const inDate = new Date(checkIn)
    const outDate = new Date(checkOut)
    const diff = Math.round((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 1
  }, [checkIn, checkOut])

  const viewDelta = selectedRoom?.viewOptions.find(o => o.id === selectedViewId)?.priceDelta ?? 0
  const mealDelta = selectedRoom?.mealOptions.find(o => o.id === selectedMealId)?.priceDelta ?? 0
  const perNight = (selectedRoom?.basePrice ?? 0) + viewDelta + mealDelta
  const total = perNight * nights

  const selectRoom = (room: RoomType) => {
    setSelectedRoomId(room.id)
    setSelectedViewId(null)
    setSelectedMealId(null)
  }

  const handleBookNow = () => {
    if (!selectedRoom) return
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

  const handleConfirm = () => setStep('done')

  if (!loaded) return null

  if (!hotel) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Booking page not found</h1>
          <p className="text-gray-400 text-sm">
            This link isn&apos;t available on this device. Booking pages are currently only viewable in the same
            browser used to create the hotel.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">H</span>
            </div>
            <span className="text-gray-900 font-bold text-xl tracking-tight">hotelify</span>
          </div>
          {guestUser && (
            <span className="text-sm text-gray-400">Signed in as {guestUser.name}</span>
          )}
        </div>
      </nav>

      {/* Hero */}
      <div className="relative h-64 bg-gray-900 overflow-hidden">
        {hotel.photoReferences[0] ? (
          <img src={photoUrl(hotel.photoReferences[0], 1200)} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-primary opacity-30" />
        )}
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
                  onChange={e => setCheckIn(e.target.value)}
                  className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn}
                  onChange={e => setCheckOut(e.target.value)}
                  className="border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Room types</h2>
            {hotel.roomTypes.length === 0 && (
              <p className="text-gray-400 text-sm">This hotel hasn&apos;t added any room types yet.</p>
            )}
            <div className="space-y-4">
              {hotel.roomTypes.map(room => {
                const active = room.id === selectedRoomId
                return (
                  <div
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`bg-white rounded-2xl p-5 shadow-sm border-2 cursor-pointer transition-colors ${
                      active ? 'border-primary' : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{room.name}</p>
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

                    {active && (room.viewOptions.length > 0 || room.mealOptions.length > 0) && (
                      <div className="mt-4 pt-4 border-t border-gray-50 space-y-3" onClick={e => e.stopPropagation()}>
                        {room.viewOptions.length > 0 && (
                          <OptionRadioGroup
                            title="View"
                            options={room.viewOptions}
                            selectedId={selectedViewId}
                            onSelect={setSelectedViewId}
                          />
                        )}
                        {room.mealOptions.length > 0 && (
                          <OptionRadioGroup
                            title="Meal Plan"
                            options={room.mealOptions}
                            selectedId={selectedMealId}
                            onSelect={setSelectedMealId}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
                  <div className="flex justify-between">
                    <span className="text-gray-400">Room</span>
                    <span className="text-gray-900 font-medium">{selectedRoom.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nights</span>
                    <span className="text-gray-900 font-medium">{nights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Base price</span>
                    <span className="text-gray-900">₹{selectedRoom.basePrice}</span>
                  </div>
                  {viewDelta > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">View</span>
                      <span className="text-gray-900">+₹{viewDelta}</span>
                    </div>
                  )}
                  {mealDelta > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Meal plan</span>
                      <span className="text-gray-900">+₹{mealDelta}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-baseline pt-3 border-t border-gray-100">
                  <span className="text-gray-500 text-sm">Total</span>
                  <span className="text-2xl font-bold text-gray-900">₹{total}</span>
                </div>

                {step === 'select' && (
                  <button
                    onClick={handleBookNow}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    Book Now
                  </button>
                )}

                {step === 'confirm' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">Review your details, then confirm.</p>
                    <button
                      onClick={handleConfirm}
                      className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-colors"
                    >
                      Confirm Booking
                    </button>
                  </div>
                )}

                {step === 'done' && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                    <p className="text-sm text-amber-800 font-medium">This is a preview.</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Completing a real booking isn&apos;t available yet — check back soon.
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
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
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

function OptionRadioGroup({
  title,
  options,
  selectedId,
  onSelect,
}: {
  title: string
  options: { id: string; label: string; priceDelta: number }[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onSelect(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            selectedId === null ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          None
        </button>
        {options.map(o => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              selectedId === o.id ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {o.label} +₹{o.priceDelta}
          </button>
        ))}
      </div>
    </div>
  )
}
