import { Hotel } from '@/lib/types'

// Shared model for the 5-step "Finish setting up" wizard (S1.7).
// The wizard lives at /hotel/[id] and the dashboard checklist mirrors it, so
// both read step metadata + completion from here to stay in sync.
//
// Completion is derived from real hotel state where possible (rooms exist,
// page published); the purely visual/confirm-only steps (basic, photos, theme)
// are remembered per-hotel in localStorage the first time the owner confirms.

export type SetupStepKey = 'basic' | 'photos' | 'rooms' | 'theme' | 'publish'

export interface SetupStep {
  key: SetupStepKey
  index: number // 1-based, matches ?step=
  label: string
  hint: string
  cta: string
}

export const SETUP_STEPS: SetupStep[] = [
  {
    key: 'basic',
    index: 1,
    label: 'Confirm hotel details',
    hint: 'Name, address, phone, and description.',
    cta: 'Review details',
  },
  {
    key: 'photos',
    index: 2,
    label: 'Review your photos',
    hint: 'Reorder, hide, set a cover, or upload your own.',
    cta: 'Manage photos',
  },
  {
    key: 'rooms',
    index: 3,
    label: 'Add a room type',
    hint: 'Guests can only book rooms you list.',
    cta: 'Add room',
  },
  {
    key: 'theme',
    index: 4,
    label: 'Pick a theme',
    hint: 'Match the page to your brand.',
    cta: 'Choose theme',
  },
  {
    key: 'publish',
    index: 5,
    label: 'Preview & publish',
    hint: 'Preview your page, publish, then share the link.',
    cta: 'Preview & publish',
  },
]

export const TOTAL_STEPS = SETUP_STEPS.length

export function stepByIndex(index: number): SetupStep {
  return SETUP_STEPS.find(s => s.index === index) ?? SETUP_STEPS[0]
}

/** Clamp an arbitrary (possibly NaN) value to a valid 1..TOTAL_STEPS index. */
export function clampStep(index: number): number {
  if (!Number.isFinite(index)) return 1
  return Math.min(TOTAL_STEPS, Math.max(1, Math.round(index)))
}

// ---- confirmed-step persistence -------------------------------------------

type Confirmed = Partial<Record<SetupStepKey, boolean>>

function storageKey(hotelId: string) {
  return `hotelify_setup_${hotelId}`
}

export function loadConfirmed(hotelId: string): Confirmed {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(hotelId))
    return raw ? (JSON.parse(raw) as Confirmed) : {}
  } catch {
    return {}
  }
}

export function saveConfirmed(hotelId: string, next: Confirmed): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(hotelId), JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

// ---- completion --------------------------------------------------------------

/**
 * Whether a step counts as done. Real hotel state wins so completion survives a
 * cleared localStorage; `confirmed` covers the confirm-only steps.
 */
export function isStepDone(hotel: Hotel, confirmed: Confirmed, key: SetupStepKey): boolean {
  switch (key) {
    case 'basic':
      return !!confirmed.basic
    case 'photos':
      return !!confirmed.photos || hotel.photos.some(p => p.source === 'upload')
    case 'rooms':
      return hotel.roomTypes.length > 0
    case 'theme':
      return !!confirmed.theme || hotel.published
    case 'publish':
      return hotel.published
  }
}

export function completedCount(hotel: Hotel, confirmed: Confirmed): number {
  return SETUP_STEPS.filter(s => isStepDone(hotel, confirmed, s.key)).length
}

export function allStepsDone(hotel: Hotel, confirmed: Confirmed): boolean {
  return completedCount(hotel, confirmed) === TOTAL_STEPS
}

/** First step index the owner still needs to act on (1-based). */
export function firstIncompleteStep(hotel: Hotel, confirmed: Confirmed): number {
  const next = SETUP_STEPS.find(s => !isStepDone(hotel, confirmed, s.key))
  return next ? next.index : TOTAL_STEPS
}
