export interface Hotel {
  id: string
  name: string
  rating: number
  totalRatings: number
  address: string
  phone?: string
  website?: string
  description?: string
  photoReferences: string[]
  reviews: Review[]
  types: string[]
  lat: number
  lng: number
  addedAt: string
  mapsUrl: string
  priceLevel?: number
  subdomain: string
  roomTypes: RoomType[]
}

export interface PriceOption {
  id: string
  label: string
  priceDelta: number
}

export interface RoomType {
  id: string
  name: string
  basePrice: number
  totalInventory: number
  amenities: string[]
  viewOptions: PriceOption[]
  mealOptions: PriceOption[]
}

export interface Review {
  author: string
  authorPhoto?: string
  rating: number
  text: string
  relativeTime: string
}
