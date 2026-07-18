import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BasicInfoStep from '@/components/setup/BasicInfoStep'
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
    priceLevel: 3,
    ...over,
  }
}

describe('BasicInfoStep — price level currency', () => {
  it('renders the price-level buttons with the rupee symbol and no dollar sign', () => {
    render(<BasicInfoStep hotel={makeHotel()} patchHotel={async () => {}} />)

    // Four price-level buttons, each a rupee glyph.
    expect(screen.getAllByText('₹')).toHaveLength(4)
    expect(screen.queryByText('$')).not.toBeInTheDocument()
  })
})
