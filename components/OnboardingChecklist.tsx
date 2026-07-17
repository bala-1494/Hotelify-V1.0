'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Hotel } from '@/lib/types'
import {
  SETUP_STEPS,
  TOTAL_STEPS,
  completedCount,
  allStepsDone,
  isStepDone,
  loadConfirmed,
  type SetupStepKey,
} from '@/lib/setupProgress'

// First-run checklist (S1.1 / S1.7). Mirrors the 5-step setup wizard: each item
// deep-links into /hotel/[id]?step=n, and completion is read from the same
// source the wizard writes (real hotel state + remembered confirmations).

interface Props {
  hotel: Hotel
}

export default function OnboardingChecklist({ hotel }: Props) {
  const router = useRouter()
  const [confirmed, setConfirmed] = useState<Partial<Record<SetupStepKey, boolean>>>({})
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => { setConfirmed(loadConfirmed(hotel.id)) }, [hotel.id])

  const completed = completedCount(hotel, confirmed)

  if (dismissed || allStepsDone(hotel, confirmed)) return null

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
        {completed} of {TOTAL_STEPS} done
      </p>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(completed / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <ul className="space-y-3">
        {SETUP_STEPS.map(step => {
          const done = isStepDone(hotel, confirmed, step.key)
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? 'bg-primary text-white' : 'bg-gray-100 text-gray-300'
                }`}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {step.label}
                </p>
                {!done && <p className="text-xs text-gray-400">{step.hint}</p>}
              </div>
              {!done && (
                <button
                  onClick={() => router.push(`/hotel/${hotel.id}?step=${step.index}`)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary-pale text-primary hover:bg-red-100 transition-colors flex-shrink-0"
                >
                  {step.cta}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
