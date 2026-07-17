import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RoomTypesEditor from '@/components/RoomTypesEditor'
import type { RoomType, PriceOption } from '@/lib/types'

function room(over: Partial<RoomType> = {}): RoomType {
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

// Controlled harness: mirrors how the wizard feeds roomTypes back in via props,
// so chip toggles actually flip on screen. onChange is spied so we can assert
// what the editor emits — the editor itself never touches the network.
function Harness({
  initial,
  onChange,
  viewOptions = [],
  mealOptions = [],
}: {
  initial: RoomType[]
  onChange: (rt: RoomType[]) => void
  viewOptions?: PriceOption[]
  mealOptions?: PriceOption[]
}) {
  const [rts, setRts] = useState(initial)
  const [vo, setVo] = useState(viewOptions)
  const [mo, setMo] = useState(mealOptions)
  return (
    <RoomTypesEditor
      roomTypes={rts}
      onChange={rt => { setRts(rt); onChange(rt) }}
      viewOptions={vo}
      mealOptions={mo}
      onChangeOptions={patch => {
        if (patch.viewOptions) setVo(patch.viewOptions)
        if (patch.mealOptions) setMo(patch.mealOptions)
      }}
    />
  )
}

describe('RoomTypesEditor — price display', () => {
  it('shows the base price prefixed with the rupee symbol, never a dollar sign', () => {
    render(<Harness initial={[room()]} onChange={() => {}} />)
    expect(screen.getByText('₹')).toBeInTheDocument()
    expect(screen.queryByText('$')).not.toBeInTheDocument()
  })
})

describe('RoomTypesEditor — basic-info amenity chips', () => {
  it('selecting a chip emits amenities with the tag added, and does not persist by itself', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[room()]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.click(screen.getByRole('button', { name: 'AC' }))

    // The editor is presentational: its only side effect is the onChange callback.
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0][0].amenities).toEqual(['AC'])
  })

  it('clicking an already-selected chip removes it (toggle off)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[room({ amenities: ['WiFi'] })]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.click(screen.getByRole('button', { name: 'WiFi' }))

    expect(onChange.mock.calls.at(-1)![0][0].amenities).toEqual([])
  })

  it('adds a custom amenity from the free-text input (Enter to commit)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial={[room()]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    await user.type(screen.getByPlaceholderText('Add custom detail…'), 'Sea Breeze{Enter}')

    expect(onChange.mock.calls.at(-1)![0][0].amenities).toEqual(['Sea Breeze'])
  })
})

describe('RoomTypesEditor — shared add-on opt-in', () => {
  it('toggling a view option records the option id on the room', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const viewOptions: PriceOption[] = [{ id: 'v1', label: 'Sea View', priceDelta: 800 }]
    render(<Harness initial={[room()]} onChange={onChange} viewOptions={viewOptions} />)

    await user.click(screen.getByRole('button', { name: 'Edit details' }))
    // Per-room opt-in button reads exactly "Sea View +₹800"; the pool editor's
    // removable chip reads "Sea View +₹800 ×", so the exact name disambiguates.
    await user.click(screen.getByRole('button', { name: 'Sea View +₹800' }))

    expect(onChange.mock.calls.at(-1)![0][0].viewOptionIds).toEqual(['v1'])
  })
})
