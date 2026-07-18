import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RoomType } from '@/lib/types'

// Regression guard for the room-type persistence bug: a single multi-row
// `.upsert()` silently dropped the array/jsonb columns (amenities /
// view_option_ids / meal_option_ids) of every row after the first, so a second
// room type's amenities + add-ons never saved. replaceRoomTypes now writes each
// row with its own `.update()` / `.insert()`. This test drives replaceRoomTypes
// against an in-memory fake Supabase client and asserts EVERY row persists.

const HOTEL_ID = 'hotel-1'

function hotelRow() {
  return {
    id: HOTEL_ID, name: 'Test', address: '', phone: null, website: null, description: null,
    price_level: null, rating: null, total_ratings: null, lat: null, lng: null, maps_url: null,
    types: [], reviews: [], subdomain: 'test', theme_id: null, published: false,
    view_options: [], meal_options: [], created_at: '2024-01-01T00:00:00Z',
  }
}

// Minimal chainable + awaitable fake of the supabase-js query builder, backed by
// a mutable in-memory store. Any use of `.upsert()` throws — so a regression back
// to bulk upsert fails this test loudly.
function makeFakeDb(store: { roomTypes: any[]; hotel: any }) {
  function from(table: string) {
    const state: any = { table, op: null, cols: null, filters: [] as [string, any][], inFilter: null, payload: null, single: false }
    const matches = (row: any) => {
      for (const [c, v] of state.filters) if (row[c] !== v) return false
      if (state.inFilter) { const [c, vals] = state.inFilter; if (!vals.includes(row[c])) return false }
      return true
    }
    async function run(): Promise<any> {
      if (state.table === 'hotels') {
        return { data: state.single ? store.hotel : [store.hotel], error: null }
      }
      if (state.table === 'photos') return { data: [], error: null }
      if (state.table === 'room_types') {
        if (state.op === 'select') {
          const rows = store.roomTypes.filter(matches)
          return { data: state.cols === 'id' ? rows.map(r => ({ id: r.id })) : rows.map(r => ({ ...r })), error: null }
        }
        if (state.op === 'delete') { store.roomTypes = store.roomTypes.filter(r => !matches(r)); return { error: null } }
        if (state.op === 'update') { store.roomTypes.forEach(r => { if (matches(r)) Object.assign(r, state.payload) }); return { error: null } }
        if (state.op === 'insert') { store.roomTypes.push({ ...state.payload }); return { error: null } }
      }
      return { data: null, error: null }
    }
    const b: any = {
      select(cols?: string) { state.op = 'select'; state.cols = cols; return b },
      insert(row: any) { state.op = 'insert'; state.payload = row; return run() },
      update(fields: any) { state.op = 'update'; state.payload = fields; return b },
      delete() { state.op = 'delete'; return b },
      upsert() { throw new Error('replaceRoomTypes must not use bulk upsert (drops non-first rows’ array columns)') },
      eq(col: string, val: any) { state.filters.push([col, val]); return b },
      in(col: string, vals: any[]) { state.inFilter = [col, vals]; return b },
      order() { return b },
      limit() { return b },
      maybeSingle() { state.single = true; return run() },
      then(res: any, rej: any) { return run().then(res, rej) },
    }
    return b
  }
  return { from } as any
}

let store: { roomTypes: any[]; hotel: any }
vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: () => makeFakeDb(store),
  PHOTO_BUCKET: 'hotel-photos',
}))

import { replaceRoomTypes } from '@/lib/db'

describe('replaceRoomTypes persistence', () => {
  beforeEach(() => {
    // Two existing rooms. Queen starts with EMPTY array columns (the bug's DB
    // state): the second room's amenities/add-ons had never persisted.
    store = {
      hotel: hotelRow(),
      roomTypes: [
        { id: 'a08ece20-f2c5-475b-979b-e8b89baf7c02', hotel_id: HOTEL_ID, name: 'Deluxe King room', base_price: 4500, total_inventory: 3, amenities: ['Geyser', 'WiFi'], view_option_ids: [], meal_option_ids: [], available: true, sort_order: 0 },
        { id: '5c456326-9685-49af-b6a0-f8807a148f33', hotel_id: HOTEL_ID, name: 'Deluxe Queen room', base_price: 4200, total_inventory: 5, amenities: [], view_option_ids: [], meal_option_ids: [], available: true, sort_order: 1 },
      ],
    }
  })

  it('persists the array columns of every room type, not just the first', async () => {
    const incoming: RoomType[] = [
      { id: 'a08ece20-f2c5-475b-979b-e8b89baf7c02', name: 'Deluxe King room', basePrice: 4500, totalInventory: 3, amenities: ['Geyser', 'WiFi', 'Balcony', 'Attached Bathroom'], viewOptionIds: [], mealOptionIds: [], available: true },
      { id: '5c456326-9685-49af-b6a0-f8807a148f33', name: 'Deluxe Queen room', basePrice: 4200, totalInventory: 5, amenities: ['WiFi', 'Balcony', 'Attached Bathroom'], viewOptionIds: ['v1', 'v2', 'v3'], mealOptionIds: ['m1', 'm2'], available: true },
    ]

    const hotel = await replaceRoomTypes(HOTEL_ID, incoming)

    const king = hotel.roomTypes.find(r => r.name === 'Deluxe King room')!
    const queen = hotel.roomTypes.find(r => r.name === 'Deluxe Queen room')!

    // Row 0 (always worked before).
    expect(king.amenities).toEqual(['Geyser', 'WiFi', 'Balcony', 'Attached Bathroom'])
    // Row 1 (the bug): amenities + view + meal ids must all persist now.
    expect(queen.amenities).toEqual(['WiFi', 'Balcony', 'Attached Bathroom'])
    expect(queen.viewOptionIds).toEqual(['v1', 'v2', 'v3'])
    expect(queen.mealOptionIds).toEqual(['m1', 'm2'])
  })

  it('inserts new room types and deletes removed ones', async () => {
    const incoming: RoomType[] = [
      // Keep King, drop Queen, add a brand-new room type.
      { id: 'a08ece20-f2c5-475b-979b-e8b89baf7c02', name: 'Deluxe King room', basePrice: 4500, totalInventory: 3, amenities: ['Geyser'], viewOptionIds: [], mealOptionIds: [], available: true },
      { id: 'c1d2e3f4-a5b6-47c8-99d0-e1f2a3b4c5d6', name: 'Suite', basePrice: 9000, totalInventory: 2, amenities: ['AC', 'Mini Fridge'], viewOptionIds: ['v9'], mealOptionIds: [], available: true },
    ]

    const hotel = await replaceRoomTypes(HOTEL_ID, incoming)

    expect(hotel.roomTypes.map(r => r.name).sort()).toEqual(['Deluxe King room', 'Suite'])
    const suite = hotel.roomTypes.find(r => r.name === 'Suite')!
    expect(suite.amenities).toEqual(['AC', 'Mini Fridge'])
    expect(suite.viewOptionIds).toEqual(['v9'])
  })
})
