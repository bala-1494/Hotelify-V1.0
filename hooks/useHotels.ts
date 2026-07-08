'use client'

import { useState, useEffect } from 'react'
import { Hotel } from '@/lib/types'
import { uniqueSubdomain } from '@/lib/slug'

const STORAGE_KEY = 'hotelify_hotels'

// Backfills fields added after a hotel was first saved, so records created
// before subdomain/roomTypes existed keep working without a migration step.
function normalize(hotel: Hotel, subdomainsInUse: string[]): Hotel {
  return {
    ...hotel,
    subdomain: hotel.subdomain || uniqueSubdomain(hotel.name, subdomainsInUse),
    roomTypes: hotel.roomTypes || [],
  }
}

export function useHotels() {
  const [hotels, setHotels] = useState<Hotel[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) { setLoaded(true); return }
    const parsed: Hotel[] = JSON.parse(stored)
    const used: string[] = []
    const normalized = parsed.map(h => {
      const n = normalize(h, used)
      used.push(n.subdomain)
      return n
    })
    setHotels(normalized)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    setLoaded(true)
  }, [])

  const persist = (updated: Hotel[]) => {
    setHotels(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const addHotel = (hotel: Hotel) => {
    const withDefaults = normalize(hotel, hotels.map(h => h.subdomain))
    const updated = [withDefaults, ...hotels.filter(h => h.id !== hotel.id)]
    persist(updated)
  }

  const updateHotel = (id: string, patch: Partial<Hotel>) => {
    persist(hotels.map(h => (h.id === id ? { ...h, ...patch } : h)))
  }

  const removeHotel = (id: string) => {
    persist(hotels.filter(h => h.id !== id))
  }

  return { hotels, loaded, addHotel, updateHotel, removeHotel }
}
