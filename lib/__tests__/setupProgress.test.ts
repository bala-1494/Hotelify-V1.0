import { describe, it, expect, beforeEach } from 'vitest'
import {
  SETUP_STEPS,
  TOTAL_STEPS,
  stepByIndex,
  clampStep,
  isStepDone,
  firstIncompleteStep,
  completedCount,
  allStepsDone,
  loadConfirmed,
  saveConfirmed,
} from '@/lib/setupProgress'
import type { Hotel } from '@/lib/types'

function makeHotel(over: Partial<Hotel> = {}): Hotel {
  return {
    id: 'h1',
    name: 'Bloom Hub',
    rating: 4.5,
    totalRatings: 100,
    address: '30 Anna Salai',
    photoReferences: [],
    reviews: [],
    types: [],
    lat: 0,
    lng: 0,
    addedAt: '2026-01-01',
    mapsUrl: '',
    subdomain: 'bloom-hub',
    roomTypes: [],
    viewOptions: [],
    mealOptions: [],
    photos: [],
    themeId: 'default',
    published: false,
    ...over,
  }
}

describe('stepByIndex / clampStep', () => {
  it('maps 1-based indexes to steps and falls back to the first step', () => {
    expect(stepByIndex(3).key).toBe('rooms')
    expect(stepByIndex(99).key).toBe('basic')
  })

  it('clamps out-of-range and non-finite values into 1..TOTAL_STEPS', () => {
    expect(clampStep(0)).toBe(1)
    expect(clampStep(-5)).toBe(1)
    expect(clampStep(999)).toBe(TOTAL_STEPS)
    expect(clampStep(Number.NaN)).toBe(1)
    expect(clampStep(3.4)).toBe(3)
  })
})

describe('isStepDone', () => {
  it('marks the rooms step done once at least one room type exists', () => {
    const empty = makeHotel({ roomTypes: [] })
    expect(isStepDone(empty, {}, 'rooms')).toBe(false)

    const withRoom = makeHotel({
      roomTypes: [
        { id: 'r1', name: 'Deluxe', basePrice: 4500, totalInventory: 3, amenities: [], viewOptionIds: [], mealOptionIds: [], available: true },
      ],
    })
    expect(isStepDone(withRoom, {}, 'rooms')).toBe(true)
  })

  it('treats confirm-only steps as done when remembered, and publish as done when published', () => {
    const hotel = makeHotel()
    expect(isStepDone(hotel, {}, 'basic')).toBe(false)
    expect(isStepDone(hotel, { basic: true }, 'basic')).toBe(true)
    expect(isStepDone(makeHotel({ published: true }), {}, 'publish')).toBe(true)
  })
})

describe('firstIncompleteStep / counts', () => {
  it('points at the first unfinished step', () => {
    // basic confirmed, but no photos/rooms/theme/publish yet -> photos (step 2).
    expect(firstIncompleteStep(makeHotel(), { basic: true })).toBe(2)
  })

  it('returns the last step and reports all-done when everything is complete', () => {
    const hotel = makeHotel({
      published: true,
      photos: [{ id: 'p1', url: 'x', source: 'upload', order: 0, hidden: false, isCover: true }],
      roomTypes: [
        { id: 'r1', name: 'Deluxe', basePrice: 4500, totalInventory: 3, amenities: [], viewOptionIds: [], mealOptionIds: [], available: true },
      ],
    })
    const confirmed = { basic: true, theme: true }
    expect(completedCount(hotel, confirmed)).toBe(TOTAL_STEPS)
    expect(allStepsDone(hotel, confirmed)).toBe(true)
    expect(firstIncompleteStep(hotel, confirmed)).toBe(TOTAL_STEPS)
  })
})

describe('confirmed-step persistence (localStorage)', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips confirmed flags per hotel id', () => {
    expect(loadConfirmed('h1')).toEqual({})
    saveConfirmed('h1', { basic: true, photos: true })
    expect(loadConfirmed('h1')).toEqual({ basic: true, photos: true })
    // Scoped per hotel — a different id is unaffected.
    expect(loadConfirmed('h2')).toEqual({})
  })

  it('returns {} for corrupt stored JSON instead of throwing', () => {
    window.localStorage.setItem('hotelify_setup_h1', '{not valid json')
    expect(loadConfirmed('h1')).toEqual({})
  })
})

describe('step metadata', () => {
  it('has 5 uniquely-indexed steps in order', () => {
    expect(SETUP_STEPS).toHaveLength(5)
    expect(SETUP_STEPS.map(s => s.index)).toEqual([1, 2, 3, 4, 5])
    expect(SETUP_STEPS.map(s => s.key)).toEqual(['basic', 'photos', 'rooms', 'theme', 'publish'])
  })
})
