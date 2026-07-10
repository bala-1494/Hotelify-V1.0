'use client'

import { useMemo, useState } from 'react'
import { apiFetch } from '@/lib/apiClient'
import type { RoomTypeLite } from '@/lib/types'

// Manual (walk-in / phone) booking form (S2.4). Mirrors the guest booking form
// shape (room, view/meal options, dates, guest info) and lands the booking
// directly as status='confirmed', source='manual'.

interface Props {
  roomTypes: RoomTypeLite[]
  onClose: () => void
  onCreated: () => void
}

function todayStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export default function ManualBookingModal({ roomTypes, onClose, onCreated }: Props) {
  const bookable = roomTypes.filter(r => r.available)
  const [roomTypeId, setRoomTypeId] = useState(bookable[0]?.id ?? '')
  const [viewId, setViewId] = useState<string | null>(null)
  const [mealId, setMealId] = useState<string | null>(null)
  const [checkIn, setCheckIn] = useState(todayStr())
  const [checkOut, setCheckOut] = useState(todayStr(1))
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const room = roomTypes.find(r => r.id === roomTypeId) ?? null

  const nights = useMemo(() => {
    const diff = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
    return diff > 0 ? diff : 1
  }, [checkIn, checkOut])

  const viewDelta = room?.viewOptions.find(o => o.id === viewId)?.priceDelta ?? 0
  const mealDelta = room?.mealOptions.find(o => o.id === mealId)?.priceDelta ?? 0
  const total = ((room?.basePrice ?? 0) + viewDelta + mealDelta) * nights

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!room || !guestName.trim() || !guestEmail.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch('/api/ops/bookings/manual', {
        method: 'POST',
        body: JSON.stringify({
          roomTypeId: room.id,
          guestName: guestName.trim(),
          guestEmail: guestEmail.trim(),
          checkIn,
          checkOut,
          viewOptionId: viewId,
          mealOptionId: mealId,
          nights,
          totalPrice: total,
          note: note.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Could not create booking'); return }
      if (!data.ok) {
        setError(data.reason === 'full' ? 'That room type is fully booked for these dates.' : `Could not create booking (${data.reason}).`)
        return
      }
      onCreated()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manual booking</h2>
            <p className="text-xs text-gray-400">Walk-in or phone — confirms immediately.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {bookable.length === 0 && (
            <p className="text-sm text-primary">No available room types — mark a room type available first.</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Room type</label>
            <select
              value={roomTypeId}
              onChange={e => { setRoomTypeId(e.target.value); setViewId(null); setMealId(null) }}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {roomTypes.map(r => (
                <option key={r.id} value={r.id} disabled={!r.available}>
                  {r.name} — ₹{r.basePrice}/night{r.available ? '' : ' (unavailable)'}
                </option>
              ))}
            </select>
          </div>

          {room && room.viewOptions.length > 0 && (
            <OptionRow title="View" options={room.viewOptions} selectedId={viewId} onSelect={setViewId} />
          )}
          {room && room.mealOptions.length > 0 && (
            <OptionRow title="Meal plan" options={room.mealOptions} selectedId={mealId} onSelect={setMealId} />
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
              <input
                type="date" value={checkIn} min={todayStr()}
                onChange={e => {
                  setCheckIn(e.target.value)
                  if (new Date(checkOut) <= new Date(e.target.value)) {
                    const n = new Date(e.target.value); n.setDate(n.getDate() + 1)
                    setCheckOut(n.toISOString().slice(0, 10))
                  }
                }}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
              <input
                type="date" value={checkOut} min={todayStr(1)}
                onChange={e => setCheckOut(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Guest name</label>
              <input
                value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Guest email</label>
              <input
                type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="guest@email.com"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Note (optional)</label>
            <input
              value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. late arrival, paid cash"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">{nights} night{nights === 1 ? '' : 's'}</span>
            <span className="text-xl font-bold text-gray-900">₹{total}</span>
          </div>

          {error && <p className="text-sm text-primary">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !room || !guestName.trim() || !guestEmail.trim()}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Confirm booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function OptionRow({
  title, options, selectedId, onSelect,
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
        <Chip active={selectedId === null} onClick={() => onSelect(null)}>None</Chip>
        {options.map(o => (
          <Chip key={o.id} active={selectedId === o.id} onClick={() => onSelect(o.id)}>
            {o.label} +₹{o.priceDelta}
          </Chip>
        ))}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'
      }`}
    >
      {children}
    </button>
  )
}
