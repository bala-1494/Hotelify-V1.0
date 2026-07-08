import { Hotel, Review } from './types'
import { parseMapsUrl } from './places'

// Deterministic hash so the same pasted URL always regenerates the same
// mock hotel (id, photos, reviews) instead of creating a new one each time.
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}

const ADJECTIVES = ['Grand', 'Royal', 'Coastal', 'Golden', 'Azure', 'Skyline', 'Harbor', 'Palm', 'Summit', 'Meridian']
const NOUNS = ['Hotel', 'Resort', 'Suites', 'Inn', 'Retreat', 'Palace', 'Lodge']
const CITIES = ['Miami Beach, FL', 'Lake Tahoe, CA', 'Austin, TX', 'Portland, OR', 'Charleston, SC', 'Scottsdale, AZ']

const REVIEW_AUTHORS = ['Alex Morgan', 'Priya Nair', 'Jordan Lee', 'Sam Rivera', 'Casey Kim', 'Taylor Brooks']
const REVIEW_TEXTS = [
  'Beautiful property, the staff went above and beyond during our stay.',
  'Rooms were spotless and the location made it easy to explore the area.',
  'Loved the breakfast spread and the pool area was never too crowded.',
  'Check-in was smooth and the room upgrade was a pleasant surprise.',
  'Great value for the price — would definitely book again.',
  'The views from the rooftop bar alone are worth the stay.',
]
const RELATIVE_TIMES = ['2 days ago', 'a week ago', '3 weeks ago', 'a month ago', '2 months ago']

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))
}

// Self-contained placeholder image (no network call) so the mock flow never
// depends on a third-party image host being reachable.
function placeholderPhoto(seed: number, index: number, label: string, w = 1200, h = 800): string {
  const hue = (seed + index * 47) % 360
  const hue2 = (hue + 40) % 360
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue},55%,42%)"/>` +
    `<stop offset="100%" stop-color="hsl(${hue2},55%,26%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<text x="50%" y="50%" font-family="sans-serif" font-size="${Math.round(w / 20)}" ` +
    `fill="rgba(255,255,255,0.85)" text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Generates a full Hotel object from any pasted URL without calling the
// Google Places API. Used while the real /api/places integration is down.
export function generateMockHotel(url: string): Hotel {
  const { query } = parseMapsUrl(url)
  const seed = hashString(url)
  const rand = seededRandom(seed)

  // parseMapsUrl falls back to `{ query: url }` when it can't extract a name
  // (e.g. short links like maps.app.goo.gl/...), so guard against the "name"
  // actually being the raw URL itself.
  const extractedName = query && !/^https?:\/\//.test(query) ? query : undefined
  const name = extractedName || `${ADJECTIVES[seed % ADJECTIVES.length]} ${NOUNS[Math.floor(seed / 7) % NOUNS.length]}`
  const city = CITIES[seed % CITIES.length]
  const rating = Math.round((3.6 + rand() * 1.3) * 10) / 10
  const totalRatings = 200 + Math.floor(rand() * 3000)

  const reviews: Review[] = Array.from({ length: 5 }, (_, i) => ({
    author: REVIEW_AUTHORS[(seed + i) % REVIEW_AUTHORS.length],
    rating: Math.max(3, Math.min(5, Math.round(rating) - (i % 2))),
    text: REVIEW_TEXTS[(seed + i * 3) % REVIEW_TEXTS.length],
    relativeTime: RELATIVE_TIMES[i],
  }))

  const photoReferences = Array.from(
    { length: 6 },
    (_, i) => placeholderPhoto(seed, i, `${name} ${i + 1}`)
  )

  return {
    id: `mock-${seed}`,
    name,
    rating,
    totalRatings,
    address: `${100 + (seed % 900)} Ocean Ave, ${city}`,
    phone: `+1 (555) ${String(100 + (seed % 900)).padStart(3, '0')}-${String(1000 + (seed % 9000)).padStart(4, '0')}`,
    website: undefined,
    description: `${name} is a mock listing generated for preview purposes, standing in until the live Google Places import is reconnected.`,
    photoReferences,
    reviews,
    types: ['lodging'],
    lat: 25 + rand() * 20,
    lng: -110 + rand() * 40,
    addedAt: new Date().toISOString(),
    mapsUrl: url,
    priceLevel: 1 + (seed % 4),
    subdomain: '', // backfilled uniquely by useHotels() on save
    roomTypes: [],
  }
}
