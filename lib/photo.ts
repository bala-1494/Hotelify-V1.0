// Mock hotels store data: URI / full image URLs in photoReferences; real
// hotels store Google photo_reference tokens that must go through the
// server-side proxy (keeps the API key off the client). This resolves either case.
export function photoUrl(ref: string, maxwidth = 1200): string {
  if (/^(https?:|data:)/.test(ref)) return ref
  return `/api/photo?ref=${ref}&maxwidth=${maxwidth}`
}
