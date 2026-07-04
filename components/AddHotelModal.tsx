'use client'

import { useEffect, useRef, useState } from 'react'
import { Hotel } from '@/lib/types'
import { generateMockHotel } from '@/lib/mockHotel'

interface Props {
  onClose: () => void
  onAdd: (hotel: Hotel) => void
}

interface Prediction {
  placeId: string
  mainText: string
  secondaryText: string
}

export default function AddHotelModal({ onClose, onAdd }: Props) {
  const [url, setUrl] = useState('')
  const [search, setSearch] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showPredictions, setShowPredictions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = search.trim()
    if (trimmed.length < 3) {
      setPredictions([])
      setSearchLoading(false)
      setSearchError('')
      return
    }
    setSearchLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(trimmed)}`)
        const data = await res.json()
        if (!res.ok) {
          setPredictions([])
          setSearchError(data.error || 'Search failed. Please try again.')
          return
        }
        setPredictions(data.predictions)
        setSearchError(data.predictions.length === 0 ? 'No hotels found for that name. Try a different name or paste a Maps URL below.' : '')
      } catch {
        setPredictions([])
        setSearchError('Network error while searching. Please try again.')
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const importHotel = async (
    body: { url: string } | { placeId: string },
    setLoading: (v: boolean) => void,
    setError: (v: string) => void
  ) => {
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to fetch hotel data'); return }
      onAdd(data.hotel)
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // The real Places API integration is down — generate a mock hotel from
    // the pasted URL instead of hitting /api/places.
    setUrlError('')
    setUrlLoading(true)
    setTimeout(() => {
      const hotel = generateMockHotel(url)
      setUrlLoading(false)
      onAdd(hotel)
      onClose()
    }, 500)
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (predictions.length === 0) return
    handleSelectPrediction(predictions[0])
  }

  const handleSelectPrediction = (prediction: Prediction) => {
    setShowPredictions(false)
    setSearch(prediction.mainText)
    importHotel({ placeId: prediction.placeId }, setSearchLoading, setSearchError)
  }

  const handleSearchBlur = () => {
    blurTimeoutRef.current = setTimeout(() => setShowPredictions(false), 150)
  }

  const handleSearchFocus = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    setShowPredictions(true)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Add a Hotel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleNameSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search by hotel name
            </label>
            <div className="relative mb-2">
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowPredictions(true) }}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                placeholder="e.g. The Ritz-Carlton, New York"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none transition-colors"
              />
              {searchLoading && (
                <svg className="animate-spin w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              )}
              {showPredictions && predictions.length > 0 && (
                <ul className="absolute z-10 mt-2 w-full bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                  {predictions.map(p => (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSelectPrediction(p)}
                        className="w-full text-left px-4 py-3 hover:bg-primary-pale transition-colors"
                      >
                        <p className="text-sm font-medium text-gray-900">{p.mainText}</p>
                        {p.secondaryText && <p className="text-xs text-gray-400">{p.secondaryText}</p>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {searchError && (
              <div className="mb-2 p-3 bg-primary-pale border border-red-200 rounded-xl">
                <p className="text-sm text-primary">{searchError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={searchLoading || predictions.length === 0}
              className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-6"
            >
              {searchLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Importing…
                </>
              ) : 'Import from Search'}
            </button>
          </form>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          <form onSubmit={handleUrlSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste a Google Maps URL
            </label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://www.google.com/maps/place/..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none transition-colors mb-2"
            />
            <p className="text-xs text-gray-400 mb-6">
              Preview mode: the Google Places import is temporarily unavailable, so any link you paste here generates a mock hotel page with sample photos and reviews.
            </p>

            {urlError && (
              <div className="mb-4 p-3 bg-primary-pale border border-red-200 rounded-xl">
                <p className="text-sm text-primary">{urlError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={urlLoading || !url}
                className="flex-1 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {urlLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Importing…
                  </>
                ) : 'Import from URL'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
