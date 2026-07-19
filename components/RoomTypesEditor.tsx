'use client'

import { useState } from 'react'
import { RoomType, PriceOption } from '@/lib/types'

// Owner console room-types editor. Shares the onboarding wizard's "Room types"
// design (preset quick-add, per-room Max guests + Bed & size, shared add-on
// pools) but keeps the console's controlled contract: it emits onChange /
// onChangeOptions and never touches the network — the page buffers the draft and
// persists once on "Confirm & continue".

const AMENITY_MASTER = ['Geyser', 'WiFi', 'Balcony', 'Attached Bathroom', 'AC', 'TV', 'Room service', 'Mini fridge']

const PRESETS: { name: string; maxOccupancy: number; basePrice: number; bedNote: string; hint: string; amenities: string[] }[] = [
  { name: 'Standard Room', maxOccupancy: 2, basePrice: 3499, bedNote: '1 queen bed · 220 sq ft', hint: 'from ₹3,499', amenities: ['WiFi', 'Geyser', 'Attached Bathroom'] },
  { name: 'Deluxe Room', maxOccupancy: 2, basePrice: 4799, bedNote: '1 king bed · 300 sq ft · city view', hint: 'from ₹4,799', amenities: ['WiFi', 'Geyser', 'Balcony', 'Attached Bathroom'] },
  { name: 'Twin Room', maxOccupancy: 2, basePrice: 3999, bedNote: '2 single beds · 250 sq ft', hint: 'from ₹3,999', amenities: ['WiFi', 'Geyser', 'Attached Bathroom'] },
  { name: 'Family Room', maxOccupancy: 4, basePrice: 5999, bedNote: '1 king + 2 singles · 400 sq ft', hint: 'from ₹5,999', amenities: ['WiFi', 'AC', 'TV', 'Attached Bathroom'] },
  { name: 'Suite', maxOccupancy: 4, basePrice: 7999, bedNote: 'Separate living area · 520 sq ft', hint: 'from ₹7,999', amenities: ['WiFi', 'AC', 'TV', 'Balcony', 'Room service'] },
]

interface Props {
  roomTypes: RoomType[]
  onChange: (roomTypes: RoomType[]) => void
  // Hotel-level shared add-on pools + a saver (wired to patchHotel).
  viewOptions: PriceOption[]
  mealOptions: PriceOption[]
  onChangeOptions: (patch: { viewOptions?: PriceOption[]; mealOptions?: PriceOption[] }) => void
}

function newId() {
  return crypto.randomUUID()
}

export default function RoomTypesEditor({
  roomTypes,
  onChange,
  viewOptions,
  mealOptions,
  onChangeOptions,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const update = (id: string, patch: Partial<RoomType>) => {
    onChange(roomTypes.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const remove = (id: string) => {
    onChange(roomTypes.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const addPreset = (p: (typeof PRESETS)[number]) => {
    if (roomTypes.some(r => r.name === p.name)) return
    const room: RoomType = {
      id: newId(),
      name: p.name,
      basePrice: p.basePrice,
      totalInventory: 4,
      amenities: p.amenities.slice(),
      viewOptionIds: [],
      mealOptionIds: [],
      available: true,
      maxOccupancy: p.maxOccupancy,
      bedNote: p.bedNote,
    }
    onChange([...roomTypes, room])
  }

  const addBlank = () => {
    const room: RoomType = {
      id: newId(),
      name: 'New room type',
      basePrice: 0,
      totalInventory: 1,
      amenities: ['WiFi'],
      viewOptionIds: [],
      mealOptionIds: [],
      available: true,
      maxOccupancy: 2,
      bedNote: '',
    }
    onChange([...roomTypes, room])
    setExpandedId(room.id)
  }

  // ---- shared option pools -------------------------------------------------
  const addSharedOption = (group: 'viewOptions' | 'mealOptions', label: string, delta: number) => {
    const pool = group === 'viewOptions' ? viewOptions : mealOptions
    const option: PriceOption = { id: newId(), label: label.trim(), priceDelta: delta }
    onChangeOptions({ [group]: [...pool, option] })
  }

  const removeSharedOption = (group: 'viewOptions' | 'mealOptions', id: string) => {
    const pool = group === 'viewOptions' ? viewOptions : mealOptions
    onChangeOptions({ [group]: pool.filter(o => o.id !== id) })
    // Drop the id from any room that had opted in, so nothing dangles.
    const idsKey = group === 'viewOptions' ? 'viewOptionIds' : 'mealOptionIds'
    if (roomTypes.some(r => r[idsKey].includes(id))) {
      onChange(roomTypes.map(r => ({ ...r, [idsKey]: r[idsKey].filter(x => x !== id) })))
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Room types</h2>
        <button
          onClick={addBlank}
          className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors whitespace-nowrap"
        >
          + Add Room Type
        </button>
      </div>
      <p className="text-gray-500 text-sm mt-1.5 mb-4">Set rate, inventory and details per room — or quick-add a preset:</p>

      {/* preset quick-add */}
      <div className="flex flex-wrap gap-2 mb-5">
        {PRESETS.map(p => {
          const added = roomTypes.some(r => r.name === p.name)
          return (
            <button
              key={p.name}
              onClick={() => addPreset(p)}
              disabled={added}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold transition-colors ${
                added ? 'bg-primary-pale text-primary border border-primary' : 'bg-white text-gray-900 border border-gray-200 hover:border-primary'
              }`}
            >
              {p.name}<span className="text-gray-400 font-medium text-xs">{p.hint}</span>
            </button>
          )
        })}
      </div>

      {/* shared add-on pools: defined once, opted into per room below */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
        <p className="font-bold text-gray-900">Add-on options</p>
        <p className="text-gray-400 text-sm mt-0.5 mb-4">
          Define View and Meal-plan add-ons once here — each room type picks which ones it offers.
        </p>
        <SharedPool
          title="View"
          options={viewOptions}
          onAdd={(label, delta) => addSharedOption('viewOptions', label, delta)}
          onRemove={id => removeSharedOption('viewOptions', id)}
          placeholder="Sea View"
        />
        <div className="h-5" />
        <SharedPool
          title="Meal Plan"
          options={mealOptions}
          onAdd={(label, delta) => addSharedOption('mealOptions', label, delta)}
          onRemove={id => removeSharedOption('mealOptions', id)}
          placeholder="Breakfast Included"
        />
      </div>

      {roomTypes.length === 0 ? (
        <div className="border-[1.5px] border-dashed border-gray-300 rounded-2xl p-9 text-center text-gray-400 text-sm">
          No rooms yet — quick-add a preset above or tap <b>+ Add Room Type</b>.
        </div>
      ) : (
        <div className="space-y-3">
          {roomTypes.map(room => (
            <RoomTypeCard
              key={room.id}
              room={room}
              viewOptions={viewOptions}
              mealOptions={mealOptions}
              expanded={expandedId === room.id}
              onToggleExpand={() => setExpandedId(expandedId === room.id ? null : room.id)}
              onUpdate={patch => update(room.id, patch)}
              onRemove={() => remove(room.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="px-2.5 py-1 text-gray-500 hover:bg-gray-50">−</button>
      <span className="px-1 min-w-[24px] text-center text-sm font-bold">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="px-2.5 py-1 text-gray-500 hover:bg-gray-50">+</button>
    </div>
  )
}

function RoomTypeCard({
  room,
  viewOptions,
  mealOptions,
  expanded,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  room: RoomType
  viewOptions: PriceOption[]
  mealOptions: PriceOption[]
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (patch: Partial<RoomType>) => void
  onRemove: () => void
}) {
  const [customAmenity, setCustomAmenity] = useState('')

  const chip = (on: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'}`

  const toggleAmenity = (tag: string) => {
    const has = room.amenities.includes(tag)
    onUpdate({ amenities: has ? room.amenities.filter(a => a !== tag) : [...room.amenities, tag] })
  }

  const addCustomAmenity = () => {
    const tag = customAmenity.trim()
    if (!tag || room.amenities.includes(tag)) return
    onUpdate({ amenities: [...room.amenities, tag] })
    setCustomAmenity('')
  }

  const toggleOption = (key: 'viewOptionIds' | 'mealOptionIds', id: string) => {
    const has = room[key].includes(id)
    onUpdate({ [key]: has ? room[key].filter(x => x !== id) : [...room[key], id] } as Partial<RoomType>)
  }

  const selectedAddons = [
    ...viewOptions.filter(o => room.viewOptionIds.includes(o.id)),
    ...mealOptions.filter(o => room.mealOptionIds.includes(o.id)),
  ]
  const customAmenities = room.amenities.filter(a => !AMENITY_MASTER.includes(a))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:px-5">
      <div className="flex items-center gap-4 flex-wrap">
        <input
          value={room.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="flex-1 min-w-[150px] text-base font-bold text-gray-900 bg-transparent focus:outline-none"
        />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-500">₹</span>
          <input
            value={room.basePrice || ''}
            onChange={e => onUpdate({ basePrice: Number(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)) })}
            placeholder="0"
            inputMode="numeric"
            className="w-16 text-center font-bold border-b-[1.5px] border-gray-200 focus:border-primary focus:outline-none"
          />
          <span className="text-gray-400 text-xs">/ night</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Stepper value={room.totalInventory} min={1} max={99} onChange={v => onUpdate({ totalInventory: v })} />
          <span className="text-gray-400 text-xs">rooms</span>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <span className="text-gray-600">Available</span>
          <button
            type="button"
            role="switch"
            aria-checked={room.available}
            onClick={() => onUpdate({ available: !room.available })}
            className={`relative w-10 h-[22px] rounded-full transition-colors ${room.available ? 'bg-primary' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-[2.5px] w-[17px] h-[17px] bg-white rounded-full shadow transition-all ${room.available ? 'left-[20.5px]' : 'left-[2.5px]'}`} />
          </button>
        </label>
        <button onClick={onToggleExpand} className="text-sm font-semibold text-primary">
          {expanded ? 'Done ✓' : 'Edit details'}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-primary text-lg leading-none" aria-label="Remove room type">×</button>
      </div>

      {!expanded && (room.amenities.length > 0 || selectedAddons.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {room.amenities.map(a => (
            <span key={a} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{a}</span>
          ))}
          {selectedAddons.map(o => (
            <span key={o.id} className="text-xs bg-primary-pale text-primary px-3 py-1 rounded-full">{o.label} +₹{o.priceDelta}</span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 flex flex-col gap-4">
          <div className="flex gap-7 flex-wrap items-center">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-gray-600">Max guests</span>
              <Stepper value={room.maxOccupancy ?? 2} min={1} max={8} onChange={v => onUpdate({ maxOccupancy: v })} />
            </div>
            <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
              <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">Bed &amp; size</span>
              <input
                value={room.bedNote ?? ''}
                onChange={e => onUpdate({ bedNote: e.target.value })}
                placeholder="1 king bed · 300 sq ft"
                className="flex-1 px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Amenities</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {AMENITY_MASTER.map(a => (
                <button key={a} onClick={() => toggleAmenity(a)} className={chip(room.amenities.includes(a))}>{a}</button>
              ))}
              {customAmenities.map(tag => (
                <button key={tag} onClick={() => toggleAmenity(tag)} className={chip(true)}>{tag} ×</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customAmenity}
                onChange={e => setCustomAmenity(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity() } }}
                placeholder="Add custom detail…"
                className="flex-1 border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={addCustomAmenity}
                className="px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">
              Views offered <span className="text-gray-400 font-medium">(guests pay the add-on)</span>
            </p>
            {viewOptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">None defined yet — add View options under “Add-on options” above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewOptions.map(o => (
                  <button key={o.id} onClick={() => toggleOption('viewOptionIds', o.id)} className={chip(room.viewOptionIds.includes(o.id))}>
                    {o.label} +₹{o.priceDelta}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Meal plans offered</p>
            {mealOptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">None defined yet — add Meal Plan options under “Add-on options” above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mealOptions.map(o => (
                  <button key={o.id} onClick={() => toggleOption('mealOptionIds', o.id)} className={chip(room.mealOptionIds.includes(o.id))}>
                    {o.label} +₹{o.priceDelta}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Hotel-level pool editor: add/remove shared options (label + single price).
function SharedPool({
  title,
  options,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string
  options: PriceOption[]
  onAdd: (label: string, delta: number) => void
  onRemove: (id: string) => void
  placeholder: string
}) {
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')

  const add = () => {
    const l = label.trim()
    if (!l || options.some(o => o.label.toLowerCase() === l.toLowerCase())) return
    onAdd(l, Number(price) || 0)
    setLabel('')
    setPrice('')
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-600 mb-2">{title} price options</p>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {options.map(o => (
            <span key={o.id} className="flex items-center gap-1.5 bg-primary-pale border border-primary/20 text-primary text-sm font-semibold px-3 py-1.5 rounded-full">
              {o.label} +₹{o.priceDelta}
              <button onClick={() => onRemove(o.id)} className="text-primary/50 font-bold hover:text-primary" aria-label={`Remove ${o.label}`}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 px-3.5 py-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-primary focus:outline-none"
        />
        <input
          value={price}
          onChange={e => setPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))}
          placeholder="+₹"
          inputMode="numeric"
          className="w-20 px-3 py-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-primary focus:outline-none"
        />
        <button onClick={add} className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
          Add
        </button>
      </div>
    </div>
  )
}
