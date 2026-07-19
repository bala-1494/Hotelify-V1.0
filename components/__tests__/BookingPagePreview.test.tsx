import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { previewRooms, WizardPreview } from '@/components/BookingPagePreview'
import { getTheme } from '@/lib/themes'
import type { Hotel, PriceOption } from '@/lib/types'

// The console/onboarding preview must mirror the real booking flow: View and
// Meal plan are OPTIONAL add-on groups a guest picks from (each choice adding a
// "+₹" surcharge), and every room shows its "Max N guests" occupancy — not a
// flat pile of chips lumped in with amenities.

const viewOptions: PriceOption[] = [
  { id: 'v-sea', label: 'Sea View', priceDelta: 500 },
  { id: 'v-garden', label: 'Garden view', priceDelta: 200 },
]
const mealOptions: PriceOption[] = [
  { id: 'm-break', label: 'Breakfast', priceDelta: 300 },
]

function hotelStub(): Hotel {
  return {
    id: 'h1', name: 'Bloom Hub', address: 'Guindy', rating: 4.8, totalRatings: 4235,
    lat: 0, lng: 0, mapsUrl: '', types: [], reviews: [], subdomain: 'bloom-hub',
    addedAt: '', themeId: 'classic-red', published: true,
    viewOptions, mealOptions, roomTypes: [], photos: [], photoReferences: [],
  } as unknown as Hotel
}

function renderPreview() {
  const rooms = previewRooms(
    [{
      name: 'Deluxe King room', basePrice: 4500, maxOccupancy: 2, bedNote: '1 king bed · 300 sq ft',
      amenities: ['WiFi'], viewOptionIds: ['v-sea', 'v-garden'], mealOptionIds: ['m-break'],
    }],
    viewOptions, mealOptions,
  )
  return render(
    <WizardPreview theme={getTheme('classic-red')} hotel={hotelStub()} summary="" rooms={rooms} />
  )
}

describe('booking-page preview — optional add-on groups', () => {
  it('maps opted-in ids to separate view / meal option lists', () => {
    const [room] = previewRooms(
      [{ name: 'R', basePrice: 100, amenities: [], viewOptionIds: ['v-garden'], mealOptionIds: ['m-break'] }],
      viewOptions, mealOptions,
    )
    expect(room.viewOptions).toEqual([{ label: 'Garden view', priceDelta: 200 }])
    expect(room.mealOptions).toEqual([{ label: 'Breakfast', priceDelta: 300 }])
    expect(room.maxOccupancy).toBe(2) // default when the room omits it
  })

  it('shows the max-guests badge', () => {
    renderPreview()
    expect(screen.getByText(/Max 2 guests/)).toBeInTheDocument()
  })

  it('renders View + Meal plan as their own groups with the free default pre-selected', () => {
    renderPreview()
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Meal plan')).toBeInTheDocument()
    // The free default choices, as on the live booking page.
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('Room only')).toBeInTheDocument()
  })

  it('shows each opted-in option with its incremental "+₹" surcharge', () => {
    renderPreview()
    expect(screen.getByText(/Sea View \+₹500/)).toBeInTheDocument()
    expect(screen.getByText(/Garden view \+₹200/)).toBeInTheDocument()
    expect(screen.getByText(/Breakfast \+₹300/)).toBeInTheDocument()
  })

  it('omits an add-on group a room offers no options for', () => {
    const rooms = previewRooms(
      [{ name: 'Bare', basePrice: 999, maxOccupancy: 3, amenities: [], viewOptionIds: [], mealOptionIds: [] }],
      viewOptions, mealOptions,
    )
    render(<WizardPreview theme={getTheme('classic-red')} hotel={hotelStub()} summary="" rooms={rooms} />)
    expect(screen.queryByText('View')).not.toBeInTheDocument()
    expect(screen.queryByText('Meal plan')).not.toBeInTheDocument()
    expect(screen.getByText(/Max 3 guests/)).toBeInTheDocument()
  })
})
