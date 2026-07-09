import type { Photo } from './types'

// Mock hotels store data: URI / full image URLs in photoReferences; real
// hotels store Google photo_reference tokens that must go through the
// server-side proxy (keeps the API key off the client). This resolves either case.
export function photoUrl(ref: string, maxwidth = 1200): string {
  if (/^(https?:|data:)/.test(ref)) return ref
  return `/api/photo?ref=${ref}&maxwidth=${maxwidth}`
}

// Resolve a managed Photo (Google reference or uploaded URL) to a src string.
export function resolvePhoto(photo: Photo, maxwidth = 1200): string {
  if (photo.url) return photo.url
  if (photo.reference) return photoUrl(photo.reference, maxwidth)
  return ''
}

// Visible photos in display order (hidden excluded), cover first.
export function visiblePhotos(photos: Photo[]): Photo[] {
  return [...photos]
    .filter(p => !p.hidden)
    .sort((a, b) => {
      if (a.isCover !== b.isCover) return a.isCover ? -1 : 1
      return a.order - b.order
    })
}

// The cover photo, or the first visible photo, or null.
export function coverPhoto(photos: Photo[]): Photo | null {
  const visible = visiblePhotos(photos)
  return visible.find(p => p.isCover) ?? visible[0] ?? null
}
