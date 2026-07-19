'use client'

import { useState } from 'react'

// The "your page is live" moment, shared by the onboarding wizard and the owner
// console so publishing feels the same wherever it happens. Purely
// presentational: the caller decides where "Go to dashboard" goes.

export default function PublishedCelebration({
  hotelName,
  slug,
  onGoToDashboard,
}: {
  hotelName: string
  slug: string
  onGoToDashboard: () => void
}) {
  const [copied, setCopied] = useState(false)

  const copyLink = () => {
    try {
      navigator.clipboard.writeText(`https://hotelify.com/${slug}`)
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="w-[72px] h-[72px] rounded-full bg-primary mx-auto mb-5 flex items-center justify-center shadow-lg shadow-primary/30">
          <svg width="34" height="34" viewBox="0 0 24 24">
            <path d="M4 12.5 9.5 18 20 6.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{hotelName} is live!</h1>
        <p className="text-gray-500 mt-2.5 leading-relaxed">
          Share your booking link anywhere — WhatsApp, Instagram, your Google profile. Guests can request to book instantly.
        </p>
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-2 pl-4 flex items-center gap-3 shadow-sm">
          <span className="flex-1 text-left text-sm font-semibold text-gray-900 truncate">hotelify.com/{slug}</span>
          <button
            onClick={copyLink}
            className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${copied ? 'bg-green-50 text-green-700' : 'bg-primary text-white'}`}
          >
            {copied ? 'Copied ✓' : 'Copy link'}
          </button>
        </div>
        <div className="flex justify-center gap-3 mt-6">
          <a
            href={`/book/${slug}`}
            className="px-5 py-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            View booking page
          </a>
          <button
            onClick={onGoToDashboard}
            className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors"
          >
            Go to dashboard →
          </button>
        </div>
      </div>
    </main>
  )
}
