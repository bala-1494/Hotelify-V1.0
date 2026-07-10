'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import BookingCard from '@/components/ops/BookingCard'
import ManualBookingModal from '@/components/ops/ManualBookingModal'
import { apiFetch, apiJson } from '@/lib/apiClient'
import type { Booking, BookingStatus, RoomTypeLite, AcceptResult } from '@/lib/types'

const FILTER_CLS = 'border-2 border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none'

const COLUMNS: { status: BookingStatus; label: string; tint: string }[] = [
  { status: 'pending', label: 'Pending', tint: 'bg-amber-50 text-amber-700' },
  { status: 'confirmed', label: 'Confirmed', tint: 'bg-green-50 text-green-700' },
  { status: 'checked_in', label: 'Checked-in', tint: 'bg-blue-50 text-blue-700' },
  { status: 'completed', label: 'Completed', tint: 'bg-gray-100 text-gray-600' },
  { status: 'rejected', label: 'Rejected', tint: 'bg-red-50 text-primary' },
  { status: 'cancelled', label: 'Cancelled', tint: 'bg-gray-100 text-gray-500' },
]

export default function BookingsPage() {
  const { user, role, loading, membershipLoading, hotelId } = useAuth()
  const router = useRouter()

  const [bookings, setBookings] = useState<Booking[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomTypeLite[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showManual, setShowManual] = useState(false)

  // Filters
  const [fStatus, setFStatus] = useState<BookingStatus | ''>('')
  const [fRoomType, setFRoomType] = useState('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')

  const canAct = role === 'owner' || role === 'manager' || role === 'front_desk'

  // Guards: desk roles only. Housekeeping -> rooms.
  useEffect(() => {
    if (loading || membershipLoading) return
    if (!user) { router.push('/login'); return }
    if (!hotelId) { router.replace('/onboarding'); return }
    if (role === 'housekeeping') router.replace('/rooms')
  }, [user, role, hotelId, loading, membershipLoading, router])

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (fStatus) params.set('status', fStatus)
    if (fRoomType) params.set('roomTypeId', fRoomType)
    if (fFrom) params.set('from', fFrom)
    if (fTo) params.set('to', fTo)
    try {
      const [b, rt] = await Promise.all([
        apiJson<{ bookings: Booking[] }>(`/api/ops/bookings?${params.toString()}`),
        roomTypes.length === 0 ? apiJson<{ roomTypes: RoomTypeLite[] }>('/api/ops/room-types') : Promise.resolve({ roomTypes }),
      ])
      setBookings(b.bookings)
      if ('roomTypes' in rt) setRoomTypes(rt.roomTypes)
    } catch {
      /* leave prior state */
    } finally {
      setLoaded(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fStatus, fRoomType, fFrom, fTo])

  useEffect(() => {
    if (user && hotelId && role !== 'housekeeping') load()
  }, [user, hotelId, role, load])

  // Resolve view/meal option ids -> labels for display.
  const optionsFor = useMemo(() => {
    const map = new Map<string, { views: Map<string, string>; meals: Map<string, string> }>()
    for (const rt of roomTypes) {
      map.set(rt.id, {
        views: new Map(rt.viewOptions.map(o => [o.id, o.label])),
        meals: new Map(rt.mealOptions.map(o => [o.id, o.label])),
      })
    }
    return (b: Booking): string[] => {
      const m = map.get(b.roomTypeId)
      const out: string[] = []
      if (b.viewOptionId && m?.views.get(b.viewOptionId)) out.push(m.views.get(b.viewOptionId)!)
      if (b.mealOptionId && m?.meals.get(b.mealOptionId)) out.push(m.meals.get(b.mealOptionId)!)
      return out
    }
  }, [roomTypes])

  // ---- actions -------------------------------------------------------------
  const onAccept = async (id: string, reassignRoomTypeId?: string | null): Promise<AcceptResult> => {
    const res = await apiFetch(`/api/ops/bookings/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ roomTypeId: reassignRoomTypeId ?? undefined }),
    })
    const data: AcceptResult = await res.json().catch(() => ({ ok: false, reason: 'error' }))
    if (data.ok) await load()
    return data
  }
  const onReject = async (id: string, reason: string) => {
    const res = await apiFetch(`/api/ops/bookings/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
    const data = await res.json().catch(() => ({ ok: false }))
    if (data.ok) await load()
    return data
  }
  const onCheckIn = async (id: string) => {
    const res = await apiFetch(`/api/ops/bookings/${id}/checkin`, { method: 'POST' })
    const data = await res.json().catch(() => ({ ok: false }))
    if (data.ok) await load()
    return data
  }

  if (loading || membershipLoading || !user || role === 'housekeeping') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const grouped = COLUMNS.map(c => ({ ...c, items: bookings.filter(b => b.status === c.status) }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            <p className="text-sm text-gray-400">{bookings.length} shown</p>
          </div>
          {canAct && (
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-medium hover:bg-primary-dark transition-colors"
            >
              + Manual booking
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 flex flex-wrap gap-4 items-end">
          <Filter label="Status">
            <select value={fStatus} onChange={e => setFStatus(e.target.value as BookingStatus | '')} className={FILTER_CLS}>
              <option value="">All</option>
              {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
            </select>
          </Filter>
          <Filter label="Room type">
            <select value={fRoomType} onChange={e => setFRoomType(e.target.value)} className={FILTER_CLS}>
              <option value="">All</option>
              {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
            </select>
          </Filter>
          <Filter label="From">
            <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className={FILTER_CLS} />
          </Filter>
          <Filter label="To">
            <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className={FILTER_CLS} />
          </Filter>
          {(fStatus || fRoomType || fFrom || fTo) && (
            <button
              onClick={() => { setFStatus(''); setFRoomType(''); setFFrom(''); setFTo('') }}
              className="text-sm text-gray-400 hover:text-gray-600 pb-2"
            >
              Clear
            </button>
          )}
        </div>

        {!loaded ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {grouped.map(col => (
              <div key={col.status} className="flex-shrink-0 w-80">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${col.tint}`}>
                    {col.label}
                  </span>
                  <span className="text-xs text-gray-400">{col.items.length}</span>
                </div>
                <div className="space-y-3">
                  {col.items.length === 0 ? (
                    <p className="text-xs text-gray-300 px-1 py-4">Nothing here.</p>
                  ) : (
                    col.items.map(b => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        options={optionsFor(b)}
                        roomTypes={roomTypes}
                        canAct={canAct}
                        onAccept={onAccept}
                        onReject={onReject}
                        onCheckIn={onCheckIn}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showManual && (
        <ManualBookingModal
          roomTypes={roomTypes}
          onClose={() => setShowManual(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
