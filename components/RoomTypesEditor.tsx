'use client'

import { useState } from 'react'
import { RoomType, PriceOption } from '@/lib/types'

const SUGGESTED_AMENITIES = ['AC', 'Geyser', 'WiFi', 'TV', 'Balcony', 'Attached Bathroom', 'Room Service', 'Mini Fridge']

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
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [inventory, setInventory] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const update = (id: string, patch: Partial<RoomType>) => {
    onChange(roomTypes.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const remove = (id: string) => {
    onChange(roomTypes.filter(r => r.id !== id))
  }

  // ---- shared option pools -------------------------------------------------
  const addSharedOption = (group: 'viewOptions' | 'mealOptions', label: string, delta: string) => {
    const pool = group === 'viewOptions' ? viewOptions : mealOptions
    const option: PriceOption = { id: newId(), label: label.trim(), priceDelta: Number(delta) }
    onChangeOptions({ [group]: [...pool, option] })
  }

  const removeSharedOption = (group: 'viewOptions' | 'mealOptions', id: string) => {
    const pool = group === 'viewOptions' ? viewOptions : mealOptions
    onChangeOptions({ [group]: pool.filter(o => o.id !== id) })
    // Drop the id from any room that had opted in, so nothing dangles.
    const idsKey = group === 'viewOptions' ? 'viewOptionIds' : 'mealOptionIds'
    const affected = roomTypes.some(r => r[idsKey].includes(id))
    if (affected) {
      onChange(roomTypes.map(r => ({ ...r, [idsKey]: r[idsKey].filter(x => x !== id) })))
    }
  }

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !price || !inventory) return
    const room: RoomType = {
      id: newId(),
      name: name.trim(),
      basePrice: Number(price),
      totalInventory: Number(inventory),
      amenities: [],
      viewOptionIds: [],
      mealOptionIds: [],
      available: true,
    }
    onChange([...roomTypes, room])
    setName('')
    setPrice('')
    setInventory('')
    setShowAddForm(false)
    setExpandedId(room.id)
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Room Types</h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + Add Room Type
          </button>
        )}
      </div>

      {/* Shared add-on pools: defined once, opted into per room below. */}
      <div className="bg-gray-50 rounded-2xl p-5 mb-6 space-y-5">
        <div>
          <p className="text-sm font-semibold text-gray-700">Add-on options</p>
          <p className="text-xs text-gray-400">
            Define View and Meal-plan add-ons once here — each room type picks which ones it offers.
          </p>
        </div>
        <SharedOptionEditor
          title="View"
          options={viewOptions}
          onAdd={(label, delta) => addSharedOption('viewOptions', label, delta)}
          onRemove={id => removeSharedOption('viewOptions', id)}
          placeholder="Sea View"
        />
        <SharedOptionEditor
          title="Meal Plan"
          options={mealOptions}
          onAdd={(label, delta) => addSharedOption('mealOptions', label, delta)}
          onRemove={id => removeSharedOption('mealOptions', id)}
          placeholder="Breakfast Included"
        />
      </div>

      {showAddForm && (
        <form onSubmit={submitAdd} className="bg-gray-50 rounded-2xl p-5 mb-6 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Room name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Deluxe King Room"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-500 mb-1">Price / night</label>
            <input
              type="number"
              min="0"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="4500"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-gray-500 mb-1">Inventory</label>
            <input
              type="number"
              min="1"
              value={inventory}
              onChange={e => setInventory(e.target.value)}
              placeholder="5"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!name.trim() || !price || !inventory}
              className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {roomTypes.length === 0 && !showAddForm && (
        <p className="text-gray-400 text-sm">No room types yet — add one to start building your booking page.</p>
      )}

      <div className="space-y-4">
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
    </section>
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

  const selectedViews = viewOptions.filter(o => room.viewOptionIds.includes(o.id))
  const selectedMeals = mealOptions.filter(o => room.mealOptionIds.includes(o.id))

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center gap-4 flex-wrap">
        <input
          value={room.name}
          onChange={e => onUpdate({ name: e.target.value })}
          className="font-semibold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-primary focus:outline-none flex-1 min-w-[140px]"
        />
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span>₹</span>
          <input
            type="number"
            min="0"
            value={room.basePrice}
            onChange={e => onUpdate({ basePrice: Number(e.target.value) })}
            className="w-20 bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-gray-400">/ night</span>
        </div>
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <input
            type="number"
            min="1"
            value={room.totalInventory}
            onChange={e => onUpdate({ totalInventory: Number(e.target.value) })}
            className="w-14 bg-gray-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-gray-400">rooms</span>
        </div>
        <label className="flex items-center gap-2 text-sm select-none cursor-pointer" title="When off, guests can't book this room regardless of inventory">
          <span className={room.available ? 'text-gray-600' : 'text-gray-400'}>
            {room.available ? 'Available' : 'Unavailable'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={room.available}
            onClick={() => onUpdate({ available: !room.available })}
            className={`relative w-10 h-5 rounded-full transition-colors ${room.available ? 'bg-primary' : 'bg-gray-300'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${room.available ? 'translate-x-5' : ''}`}
            />
          </button>
        </label>
        <button onClick={onToggleExpand} className="text-sm text-primary font-medium hover:underline">
          {expanded ? 'Done' : 'Edit details'}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-primary transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!expanded && (room.amenities.length > 0 || selectedViews.length > 0 || selectedMeals.length > 0) && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          {room.amenities.map(a => (
            <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{a}</span>
          ))}
          {[...selectedViews, ...selectedMeals].map(o => (
            <span key={o.id} className="text-xs bg-primary-pale text-primary px-2.5 py-1 rounded-full">
              {o.label} +₹{o.priceDelta}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-50 space-y-5">
          {/* Basic info tags */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Basic info</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {SUGGESTED_AMENITIES.map(tag => {
                const active = room.amenities.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleAmenity(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
              {room.amenities
                .filter(a => !SUGGESTED_AMENITIES.includes(a))
                .map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleAmenity(tag)}
                    className="text-xs px-3 py-1.5 rounded-full bg-primary text-white border border-primary"
                  >
                    {tag} ×
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                value={customAmenity}
                onChange={e => setCustomAmenity(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity() } }}
                placeholder="Add custom detail…"
                className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
              />
              <button
                onClick={addCustomAmenity}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Opt-in to the hotel's shared add-on pools */}
          <OptionSelector
            title="View options"
            pool={viewOptions}
            selectedIds={room.viewOptionIds}
            onToggle={id => toggleOption('viewOptionIds', id)}
          />
          <OptionSelector
            title="Meal Plan options"
            pool={mealOptions}
            selectedIds={room.mealOptionIds}
            onToggle={id => toggleOption('mealOptionIds', id)}
          />
        </div>
      )}
    </div>
  )
}

// Per-room opt-in: toggle chips over the hotel's shared pool.
function OptionSelector({
  title,
  pool,
  selectedIds,
  onToggle,
}: {
  title: string
  pool: PriceOption[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{title}</p>
      {pool.length === 0 ? (
        <p className="text-xs text-gray-400 italic">
          None defined yet — add {title.toLowerCase()} under “Add-on options” above.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {pool.map(o => {
            const active = selectedIds.includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onToggle(o.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                }`}
              >
                {o.label} +₹{o.priceDelta}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Hotel-level pool editor: add/remove shared options (label + single price).
function SharedOptionEditor({
  title,
  options,
  onAdd,
  onRemove,
  placeholder,
}: {
  title: string
  options: PriceOption[]
  onAdd: (label: string, delta: string) => void
  onRemove: (id: string) => void
  placeholder: string
}) {
  const [label, setLabel] = useState('')
  const [delta, setDelta] = useState('')

  const add = () => {
    if (!label.trim() || delta === '') return
    onAdd(label, delta)
    setLabel('')
    setDelta('')
  }

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">{title} price options</p>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {options.map(o => (
            <button
              key={o.id}
              onClick={() => onRemove(o.id)}
              title="Remove this option"
              className="text-xs px-3 py-1.5 rounded-full bg-primary-pale text-primary border border-red-100"
            >
              {o.label} +₹{o.priceDelta} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
        <input
          type="number"
          value={delta}
          onChange={e => setDelta(e.target.value)}
          placeholder="+₹"
          className="w-20 border-2 border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:border-primary focus:outline-none"
        />
        <button
          onClick={add}
          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}
