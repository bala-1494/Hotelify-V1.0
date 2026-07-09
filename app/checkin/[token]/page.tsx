'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

// Phase-2 check-in stub (S2.7). Resolves the check-in token to a booking
// summary. The full ID-upload → id_submitted → checked_in loop is intentionally
// NOT built here — this is the schema-ready entry point the operations flow will
// hang the ID capture off later.

interface Summary {
  guestName: string
  hotelName: string
  roomTypeName: string
  checkIn: string
  checkOut: string
  status: string
  nights: number
}

export default function CheckinStubPage() {
  const { token } = useParams<{ token: string }>()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'invalid'>('loading')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`/api/checkin/${token}`, { cache: 'no-store' })
        if (!res.ok) { setState('invalid'); return }
        const data = await res.json()
        setSummary(data.booking)
        setState('ok')
      } catch {
        setState('invalid')
      }
    })()
  }, [token])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">H</span>
          </div>
          <span className="text-gray-900 font-bold text-xl tracking-tight">hotelify</span>
        </div>

        {state === 'loading' && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state === 'invalid' && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Check-in link invalid</h1>
            <p className="text-sm text-gray-400">This check-in link isn&apos;t valid or has expired.</p>
          </div>
        )}

        {state === 'ok' && summary && (
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-1">Online check-in</p>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome, {summary.guestName}</h1>
            <p className="text-gray-400 text-sm mb-6">{summary.hotelName}</p>

            <div className="space-y-2 text-sm border-t border-gray-100 pt-4 mb-6">
              <Row label="Room" value={summary.roomTypeName} />
              <Row label="Check-in" value={summary.checkIn} />
              <Row label="Check-out" value={summary.checkOut} />
              <Row label="Nights" value={String(summary.nights)} />
              <Row label="Status" value={summary.status.replace('_', ' ')} />
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
              <p className="text-sm font-medium text-amber-800">Online check-in coming soon</p>
              <p className="text-xs text-amber-700 mt-1">
                ID upload and self check-in will be enabled here. For now, please complete check-in at the front desk.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-900 font-medium capitalize">{value}</span>
    </div>
  )
}
