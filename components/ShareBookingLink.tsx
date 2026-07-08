'use client'

import { useState } from 'react'

export default function ShareBookingLink({ subdomain }: { subdomain: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/book/${subdomain}` : ''

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Share booking page</h3>
      <p className="text-xs text-gray-400 mb-3">Anyone with this link can view room types and preview booking.</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 min-w-0 bg-gray-50 text-xs text-gray-600 rounded-lg px-3 py-2 truncate"
        />
        <button
          onClick={copy}
          className="text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary-dark transition-colors flex-shrink-0"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
