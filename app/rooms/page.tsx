'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import Navbar from '@/components/Navbar'
import { apiFetch, apiJson } from '@/lib/apiClient'
import type { Room, RoomStatusValue } from '@/lib/types'

// Housekeeping room-status board (S2.7 scaffold): dirty -> cleaning -> ready.

const COLUMNS: { status: RoomStatusValue; label: string; tint: string; dot: string }[] = [
  { status: 'dirty', label: 'Dirty', tint: 'bg-red-50', dot: 'bg-primary' },
  { status: 'cleaning', label: 'Cleaning', tint: 'bg-amber-50', dot: 'bg-amber-500' },
  { status: 'ready', label: 'Ready', tint: 'bg-green-50', dot: 'bg-green-500' },
]

// Next action in the housekeeping cycle.
const NEXT: Record<RoomStatusValue, { to: RoomStatusValue; label: string } | null> = {
  dirty: { to: 'cleaning', label: 'Start cleaning' },
  cleaning: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'dirty', label: 'Mark dirty' },
}

export default function RoomsPage() {
  const { user, role, loading, membershipLoading, hotelId } = useAuth()
  const router = useRouter()

  const [rooms, setRooms] = useState<Room[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const canManageStatus = role === 'owner' || role === 'manager' || role === 'housekeeping'
  const canSeed = role === 'owner' || role === 'manager'

  useEffect(() => {
    if (loading || membershipLoading) return
    if (!user) { router.push('/login'); return }
    if (!hotelId) { router.replace('/onboarding'); return }
  }, [user, hotelId, loading, membershipLoading, router])

  const load = useCallback(async () => {
    try {
      const { rooms } = await apiJson<{ rooms: Room[] }>('/api/ops/rooms')
      setRooms(rooms)
    } catch { /* ignore */ } finally { setLoaded(true) }
  }, [])

  useEffect(() => { if (user && hotelId) load() }, [user, hotelId, load])

  const setStatus = async (room: Room, status: RoomStatusValue) => {
    setBusy(true)
    // optimistic
    setRooms(prev => prev.map(r => (r.id === room.id ? { ...r, status } : r)))
    try {
      const res = await apiFetch(`/api/ops/rooms/${room.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      if (!res.ok) await load()
    } finally { setBusy(false) }
  }

  const seed = async () => {
    setBusy(true)
    try {
      await apiFetch('/api/ops/rooms/seed', { method: 'POST' })
      await load()
    } finally { setBusy(false) }
  }

  if (loading || membershipLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const grouped = COLUMNS.map(c => ({ ...c, items: rooms.filter(r => r.status === c.status) }))

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Room status board</h1>
            <p className="text-sm text-gray-400">{rooms.length} rooms</p>
          </div>
          {canSeed && rooms.length === 0 && loaded && (
            <button onClick={seed} disabled={busy}
              className="bg-primary text-white px-4 py-2.5 rounded-xl font-medium hover:bg-primary-dark disabled:opacity-50">
              Generate rooms from inventory
            </button>
          )}
        </div>

        {!loaded ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <p className="text-gray-500 mb-1">No physical rooms yet.</p>
            <p className="text-sm text-gray-400">
              {canSeed
                ? 'Generate rooms from your room-type inventory to start the housekeeping board.'
                : 'Ask an owner or manager to generate rooms.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {grouped.map(col => (
              <div key={col.status} className={`rounded-2xl ${col.tint} p-4`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <span className="font-bold text-gray-800">{col.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{col.items.length}</span>
                </div>
                <div className="space-y-2">
                  {col.items.map(room => {
                    const next = NEXT[room.status]
                    return (
                      <div key={room.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{room.label}</p>
                          <p className="text-xs text-gray-400 truncate">{room.roomTypeName}</p>
                        </div>
                        {canManageStatus && next && (
                          <button
                            onClick={() => setStatus(room, next.to)}
                            disabled={busy}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50 flex-shrink-0"
                          >
                            {next.label}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {col.items.length === 0 && <p className="text-xs text-gray-400 px-1">None</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
