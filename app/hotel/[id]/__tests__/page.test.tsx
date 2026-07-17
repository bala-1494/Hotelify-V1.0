import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Hotel, RoomType } from '@/lib/types'

// ---- module mocks ---------------------------------------------------------
// These must be STABLE references across renders: the wizard's mount effect
// depends on `user` and `router`, so returning fresh objects each render would
// re-fire the fetch every render and spin forever. vi.hoisted keeps them fixed.
const { push, replace, router, authValue } = vi.hoisted(() => {
  const push = vi.fn()
  const replace = vi.fn()
  return {
    push,
    replace,
    router: { push, replace },
    authValue: {
      user: { email: 'owner@hotelify.com', name: 'Owner' },
      role: 'owner' as const,
      hotelId: 'h1',
      loading: false,
      membershipLoading: false,
      signOut: vi.fn(),
    },
  }
})

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'h1' }),
  useRouter: () => router,
  usePathname: () => '/hotel/h1',
}))

vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authValue }))

// Sibling steps aren't under test here — stub them so the wizard shell + the
// real RoomTypesEditor are all that render.
vi.mock('@/components/Navbar', () => ({ default: () => null }))
vi.mock('@/components/PhotoManager', () => ({ default: () => null }))
vi.mock('@/components/ThemePicker', () => ({ default: () => null }))
vi.mock('@/components/setup/PublishStep', () => ({ default: () => null }))
vi.mock('@/components/setup/BasicInfoStep', () => ({ default: () => null }))

const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('@/lib/apiClient', () => ({
  apiJson: (...args: any[]) => apiJson(...args),
  apiFetch: (...args: any[]) => apiFetch(...args),
}))

// ---- fixtures -------------------------------------------------------------
function makeRoom(over: Partial<RoomType> = {}): RoomType {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Deluxe King room',
    basePrice: 4500,
    totalInventory: 3,
    amenities: [],
    viewOptionIds: [],
    mealOptionIds: [],
    available: true,
    ...over,
  }
}

function makeHotel(rooms: RoomType[]): Hotel {
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
    roomTypes: rooms,
    viewOptions: [],
    mealOptions: [],
    photos: [],
    themeId: 'default',
    published: false,
    ...({} as any),
  }
}

const roomTypePutCalls = () =>
  apiJson.mock.calls.filter(
    ([url, init]) => init?.method === 'PUT' && String(url).includes('/room-types'),
  )

// Import after mocks are registered.
import Page from '@/app/hotel/[id]/page'

beforeEach(() => {
  apiJson.mockReset()
  apiFetch.mockReset()
  push.mockReset()
  replace.mockReset()
  window.history.replaceState({}, '', '/hotel/h1?step=3') // land on the Rooms step

  apiJson.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'GET' && url === '/api/hotels/h1') {
      return { hotel: makeHotel([makeRoom()]) }
    }
    if (method === 'PATCH' && url === '/api/hotels/h1') {
      return { hotel: makeHotel([makeRoom()]) }
    }
    if (method === 'PUT' && url === '/api/hotels/h1/room-types') {
      const body = JSON.parse(init!.body as string)
      return { hotel: makeHotel(body.roomTypes) }
    }
    throw new Error(`unexpected ${method} ${url}`)
  })
})

describe('HotelSetupWizardPage — Rooms step is buffered', () => {
  it('does not persist while editing chips, then saves once on Confirm & continue', async () => {
    const user = userEvent.setup()
    render(<Page />)

    // Wait for the Rooms step to render off the fetched hotel.
    await screen.findByText('Room Types')

    // Only the initial GET has happened — no room-type writes yet.
    expect(roomTypePutCalls()).toHaveLength(0)

    // Edit a chip. This must NOT hit the API.
    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.click(screen.getByRole('button', { name: 'AC' }))
    await user.click(screen.getByRole('button', { name: 'WiFi' }))
    expect(roomTypePutCalls()).toHaveLength(0)

    // Leaving the step commits the whole draft in a single PUT.
    await user.click(screen.getByRole('button', { name: /Confirm & continue/ }))

    const puts = roomTypePutCalls()
    expect(puts).toHaveLength(1)
    const body = JSON.parse(puts[0][1].body as string)
    expect(body.roomTypes[0].amenities).toEqual(['AC', 'WiFi'])
  })

  it('advances to the next step after a successful save', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await screen.findByText('Room Types')

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.click(screen.getByRole('button', { name: 'AC' }))
    await user.click(screen.getByRole('button', { name: /Confirm & continue/ }))

    // Rooms editor is gone once we move on to the Theme step.
    await vi.waitFor(() => {
      expect(screen.queryByText('Room Types')).not.toBeInTheDocument()
    })
    expect(roomTypePutCalls()).toHaveLength(1)
  })

  it('surfaces an error and stays on the Rooms step when the save fails', async () => {
    const user = userEvent.setup()
    apiJson.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (method === 'GET') return { hotel: makeHotel([makeRoom()]) }
      // Any write fails.
      const err: any = new Error('column "view_option_ids" does not exist')
      err.status = 500
      throw err
    })

    render(<Page />)
    await screen.findByText('Room Types')

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.click(screen.getByRole('button', { name: 'AC' }))
    await user.click(screen.getByRole('button', { name: /Confirm & continue/ }))

    // Error is shown, and we're still on the Rooms step (not silently reverted).
    await screen.findByText(/column "view_option_ids" does not exist/)
    expect(screen.getByText('Room Types')).toBeInTheDocument()
  })
})
