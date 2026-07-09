'use client'

import { useState } from 'react'
import { Hotel } from '@/lib/types'
import { THEMES, getTheme, themeVars } from '@/lib/themes'

// Theme picker + live preview pane + publish toggle (S1.3). Selecting a theme
// updates the preview instantly and persists via onSelectTheme. The publish
// toggle flips hotels.published.

interface Props {
  hotel: Hotel
  onSelectTheme: (themeId: string) => Promise<void>
  onTogglePublish: (published: boolean) => Promise<void>
}

export default function ThemePicker({ hotel, onSelectTheme, onTogglePublish }: Props) {
  // Optimistic local selection for instant preview; persisted in the background.
  const [selectedId, setSelectedId] = useState(hotel.themeId)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const theme = getTheme(selectedId)

  const pick = async (id: string) => {
    setSelectedId(id)
    setSaving(true)
    try {
      await onSelectTheme(id)
    } catch {
      setSelectedId(hotel.themeId) // revert on failure
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    setPublishing(true)
    try {
      await onTogglePublish(!hotel.published)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section id="theme">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Theme &amp; publishing</h2>
        {saving && <span className="text-xs text-gray-400">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Swatches */}
        <div>
          <p className="text-sm font-medium text-gray-500 mb-3">Choose a theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {THEMES.map(t => {
              const active = t.id === selectedId
              return (
                <button
                  key={t.id}
                  onClick={() => pick(t.id)}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    active ? 'border-gray-900' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex gap-1.5 mb-2">
                    <span className="w-6 h-6 rounded-full" style={{ background: t.primary }} />
                    <span className="w-6 h-6 rounded-full" style={{ background: t.primaryDark }} />
                    <span className="w-6 h-6 rounded-full border border-gray-200" style={{ background: t.accent }} />
                  </div>
                  <p className="text-xs font-medium text-gray-800">{t.name}</p>
                </button>
              )
            })}
          </div>

          {/* Publish toggle */}
          <div className="mt-6 p-4 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {hotel.published ? 'Published' : 'Not published'}
              </p>
              <p className="text-xs text-gray-500">
                {hotel.published
                  ? 'Your booking page is live and accepting requests.'
                  : 'Publish to make your booking link accept guest requests.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={hotel.published}
              onClick={togglePublish}
              disabled={publishing}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${
                hotel.published ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  hotel.published ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p className="text-sm font-medium text-gray-500 mb-3">Live preview</p>
          <div
            className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
            style={themeVars(theme)}
          >
            {/* Mini hero */}
            <div className="h-28 relative" style={{ background: theme.primaryDark }}>
              <div className="absolute inset-0 flex flex-col justify-end p-4">
                <p className="text-white/70 text-[10px] uppercase tracking-wider">Preview</p>
                <p className="text-white font-bold text-lg leading-tight">{hotel.name}</p>
              </div>
            </div>
            {/* Mini info bar */}
            <div className="px-4 py-2 text-white text-xs" style={{ background: theme.primary }}>
              {hotel.address || 'Your address'}
            </div>
            {/* Mini body */}
            <div className="p-4 bg-white space-y-3">
              <div className="rounded-lg p-3" style={{ background: theme.accent }}>
                <p className="text-xs font-semibold" style={{ color: theme.primaryDark }}>
                  Deluxe Room
                </p>
                <p className="text-[11px] text-gray-500">From ₹{hotel.roomTypes[0]?.basePrice ?? 4500} / night</p>
              </div>
              <button
                className="w-full text-center text-white text-xs font-bold py-2 rounded-lg"
                style={{ background: theme.primary }}
              >
                Request to Book
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
