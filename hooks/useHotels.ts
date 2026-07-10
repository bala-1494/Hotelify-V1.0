'use client'

import { useState, useEffect, useCallback } from 'react'
import { Hotel } from '@/lib/types'
import { DEFAULT_THEME_ID } from '@/lib/themes'
import { useAuth } from '@/components/AuthProvider'
import { apiFetch, apiJson } from '@/lib/apiClient'

// Backfills fields added after a hotel was first saved, so older records keep
// working. The server assembles most of this now; normalize() guards the client
// against missing optional fields.
function normalize(hotel: Hotel): Hotel {
  return {
    ...hotel,
    roomTypes: (hotel.roomTypes || []).map(r => ({ ...r, available: r.available ?? true })),
    photos: hotel.photos || [],
    photoReferences: hotel.photoReferences || [],
    themeId: hotel.themeId || DEFAULT_THEME_ID,
    published: hotel.published ?? false,
  }
}

// Supabase-backed, owner-scoped. Returns the signed-in owner's single hotel
// (one-per-owner), so `hotels` holds 0 or 1 entries.
export function useHotels() {
  const { user, refreshMembership } = useAuth()
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setHotels([])
      setLoaded(true)
      return
    }
    try {
      const { hotel } = await apiJson<{ hotel: Hotel | null }>('/api/hotels')
      setHotels(hotel ? [normalize(hotel)] : [])
    } catch {
      setHotels([])
    } finally {
      setLoaded(true)
    }
  }, [user])

  useEffect(() => {
    setLoaded(false)
    refresh()
  }, [refresh])

  // Create the owner's hotel. Throws on the one-hotel-per-owner guard (409).
  const addHotel = async (hotel: Hotel): Promise<Hotel> => {
    const res = await apiFetch('/api/hotels', {
      method: 'POST',
      body: JSON.stringify({ hotel }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err: any = new Error(data?.error || 'Failed to create hotel')
      err.status = res.status
      err.hotelId = data?.hotelId
      throw err
    }
    const created = normalize(data.hotel)
    setHotels([created])
    await refreshMembership()
    return created
  }

  return { hotels, loaded, addHotel, refresh }
}
