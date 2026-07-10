'use client'

import { useState } from 'react'
import type { Booking, RoomTypeLite, AcceptResult } from '@/lib/types'

// A single booking in the inbox (S2.1) with inline accept/reject/check-in
// actions (S2.2/S2.3). When accept reports the room is full, the card offers
// reassign-to-another-type or reject (S2.2).

const REJECT_REASONS = ['Sold out', 'Dates unavailable', 'Other']

interface Props {
  booking: Booking
  options: string[]                 // resolved view/meal option labels
  roomTypes: RoomTypeLite[]
  canAct: boolean
  onAccept: (bookingId: string, reassignRoomTypeId?: string | null) => Promise<AcceptResult>
  onReject: (bookingId: string, reason: string) => Promise<{ ok: boolean }>
  onCheckIn: (bookingId: string) => Promise<{ ok: boolean }>
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function BookingCard({ booking, options, roomTypes, canAct, onAccept, onReject, onCheckIn }: Props) {
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'idle' | 'rejecting' | 'full'>('idle')
  const [reassignId, setReassignId] = useState('')
  const [msg, setMsg] = useState('')

  const isPending = booking.status === 'pending'
  const isCheckinable = booking.status === 'confirmed' || booking.status === 'id_submitted'

  const doAccept = async (reassign?: string | null) => {
    setBusy(true); setMsg('')
    try {
      const r = await onAccept(booking.id, reassign ?? null)
      if (!r.ok && r.reason === 'full') {
        setMode('full')
        setMsg('That room type is full for these dates.')
      } else if (!r.ok) {
        setMsg(`Could not accept (${r.reason}).`)
      }
    } finally {
      setBusy(false)
    }
  }

  const doReject = async (reason: string) => {
    setBusy(true)
    try { await onReject(booking.id, reason) } finally { setBusy(false) }
  }

  const doCheckIn = async () => {
    setBusy(true)
    try { await onCheckIn(booking.id) } finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{booking.guestName}</p>
          <p className="text-xs text-gray-400 truncate">{booking.guestEmail}</p>
        </div>
        {booking.source === 'manual' && (
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
            Manual
          </span>
        )}
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <div className="flex justify-between gap-2">
          <span className="text-gray-400">Room</span>
          <span className="font-medium text-gray-900 text-right">{booking.roomTypeName}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-400">Dates</span>
          <span className="text-gray-900 text-right">
            {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)} · {booking.nights}n
          </span>
        </div>
        {options.length > 0 && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-400">Options</span>
            <span className="text-gray-900 text-right">{options.join(', ')}</span>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <span className="text-gray-400">Total</span>
          <span className="font-bold text-gray-900">₹{booking.totalPrice}</span>
        </div>
      </div>

      {booking.note && (
        <p className="text-xs bg-amber-50 text-amber-800 rounded-lg px-2.5 py-1.5 mb-3">“{booking.note}”</p>
      )}
      {booking.status === 'rejected' && booking.rejectReason && (
        <p className="text-xs text-gray-400 mb-3">Rejected: {booking.rejectReason}</p>
      )}

      <p className="text-[11px] text-gray-300 mb-3">Requested {fmtDateTime(booking.createdAt)}</p>

      {msg && <p className="text-xs text-primary mb-2">{msg}</p>}

      {/* Actions */}
      {canAct && isPending && mode === 'idle' && (
        <div className="flex gap-2">
          <button onClick={() => doAccept()} disabled={busy}
            className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
            {busy ? '…' : 'Accept'}
          </button>
          <button onClick={() => setMode('rejecting')} disabled={busy}
            className="flex-1 py-2 rounded-lg border-2 border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            Reject
          </button>
        </div>
      )}

      {canAct && isPending && mode === 'rejecting' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Reason:</p>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map(r => (
              <button key={r} onClick={() => doReject(r)} disabled={busy}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-primary-pale hover:text-primary disabled:opacity-50">
                {r}
              </button>
            ))}
          </div>
          <button onClick={() => setMode('idle')} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {canAct && isPending && mode === 'full' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Reassign to another room type, or reject:</p>
          <div className="flex gap-2">
            <select value={reassignId} onChange={e => setReassignId(e.target.value)}
              className="flex-1 border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:border-primary focus:outline-none">
              <option value="">Select room type…</option>
              {roomTypes.filter(r => r.id !== booking.roomTypeId && r.available).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <button onClick={() => reassignId && doAccept(reassignId)} disabled={busy || !reassignId}
              className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold disabled:opacity-50">
              Reassign
            </button>
          </div>
          <button onClick={() => setMode('rejecting')} className="text-xs text-primary hover:underline">Reject instead</button>
        </div>
      )}

      {canAct && isCheckinable && (
        <button onClick={doCheckIn} disabled={busy}
          className="w-full py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50">
          {busy ? '…' : 'Check in'}
        </button>
      )}
    </div>
  )
}
