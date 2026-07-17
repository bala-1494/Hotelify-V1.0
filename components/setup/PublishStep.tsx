'use client'

import { useState } from 'react'
import { Hotel } from '@/lib/types'
import ShareBookingLink from '@/components/ShareBookingLink'

// Step 5 of the setup wizard (S1.7): preview the live booking page, publish it,
// and only then unlock sharing. The preview iframes the real public page
// (/book/[subdomain]) which renders even while unpublished.

interface Props {
  hotel: Hotel
  onTogglePublish: (published: boolean) => Promise<void>
}

export default function PublishStep({ hotel, onTogglePublish }: Props) {
  const [publishing, setPublishing] = useState(false)
  const bookingPath = `/book/${hotel.subdomain}`

  const setPublished = async (next: boolean) => {
    setPublishing(true)
    try {
      await onTogglePublish(next)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Preview &amp; publish</h2>
      <p className="text-sm text-gray-400 mb-6">
        This is exactly what guests will see. Publish to start accepting requests, then share your link.
      </p>

      {/* Live preview of the public booking page */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />
            <span className="ml-2 text-xs text-gray-400 truncate">{bookingPath}</span>
          </div>
          <a
            href={bookingPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary hover:underline flex-shrink-0"
          >
            Open in new tab ↗
          </a>
        </div>
        <div className="h-[520px] bg-gray-50">
          <iframe
            title={`Preview of ${hotel.name} booking page`}
            src={bookingPath}
            className="w-full h-full border-0"
          />
        </div>
      </div>

      {/* Publish control */}
      <div className="mt-6 p-5 rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {hotel.published ? '● Published' : 'Not published yet'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {hotel.published
              ? 'Your booking page is live and accepting guest requests.'
              : 'Guests can preview the page, but requests stay disabled until you publish.'}
          </p>
        </div>
        {hotel.published ? (
          <button
            type="button"
            onClick={() => setPublished(false)}
            disabled={publishing}
            className="px-4 py-2.5 rounded-xl border-2 border-gray-200 text-gray-700 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {publishing ? 'Saving…' : 'Unpublish'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPublished(true)}
            disabled={publishing}
            className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {publishing ? 'Publishing…' : 'Publish booking page'}
          </button>
        )}
      </div>

      {/* Share — locked until published */}
      <div className="mt-6">
        {hotel.published ? (
          <ShareBookingLink subdomain={hotel.subdomain} />
        ) : (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-5 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
              <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Sharing unlocks after you publish</p>
            <p className="text-xs text-gray-400 mt-0.5">Publish above to get a shareable booking link.</p>
          </div>
        )}
      </div>
    </section>
  )
}
