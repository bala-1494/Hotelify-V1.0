'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Hotel } from '@/lib/types'

// First-run checklist (S1.1). "Add a room" and "pick a theme"/"publish" are
// derived from real hotel state; the interactive nudges (review photos, copy
// link) are marked done locally the first time the owner acts on them.

interface Props {
  hotel: Hotel
}

function storageKey(hotelId: string) {
  return `hotelify_checklist_${hotelId}`
}

export default function OnboardingChecklist({ hotel }: Props) {
  const router = useRouter()
  const [seen, setSeen] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(hotel.id))
      if (raw) setSeen(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [hotel.id])

  const markSeen = useCallback((key: string) => {
    setSeen(prev => {
      const next = { ...prev, [key]: true }
      try { localStorage.setItem(storageKey(hotel.id), JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [hotel.id])

  const bookingUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/book/${hotel.subdomain}` : ''

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      markSeen('link')
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const hasVisiblePhoto = hotel.photos.some(p => !p.hidden)

  const items = [
    {
      key: 'room',
      label: 'Add a room type',
      hint: 'Guests can only book rooms you list.',
      done: hotel.roomTypes.length > 0,
      cta: 'Add room',
      action: () => { markSeen('room'); router.push(`/hotel/${hotel.id}#rooms`) },
    },
    {
      key: 'photos',
      label: 'Review your photos',
      hint: 'Reorder, hide, set a cover, or upload your own.',
      done: !!seen['photos'] || hotel.photos.some(p => p.source === 'upload'),
      cta: 'Manage photos',
      action: () => { markSeen('photos'); router.push(`/hotel/${hotel.id}#photos`) },
    },
    {
      key: 'theme',
      label: 'Pick a theme',
      hint: 'Match the page to your brand, then publish.',
      done: !!seen['theme'] || hotel.published,
      cta: 'Choose theme',
      action: () => { markSeen('theme'); router.push(`/hotel/${hotel.id}#theme`) },
    },
    {
      key: 'link',
      label: 'Copy your booking link',
      hint: 'Share it anywhere — guests can request to book.',
      done: !!seen['link'] || copied,
      cta: copied ? 'Copied!' : 'Copy link',
      action: copyLink,
    },
  ]

  const completed = items.filter(i => i.done).length
  const allDone = completed === items.length

  if (dismissed || allDone) return null

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-gray-900">Finish setting up</h2>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-300 hover:text-gray-500 text-sm"
        >
          Dismiss
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        {completed} of {items.length} done
      </p>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(completed / items.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-3">
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.done ? 'bg-primary text-white' : 'bg-gray-100 text-gray-300'
              }`}
            >
              {item.done ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-300" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {item.label}
              </p>
              {!item.done && <p className="text-xs text-gray-400">{item.hint}</p>}
            </div>
            {!item.done && (
              <button
                onClick={item.action}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-pale text-primary hover:bg-red-100 transition-colors flex-shrink-0"
              >
                {item.cta}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
