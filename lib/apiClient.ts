'use client'

// Client-side fetch wrapper that attaches the mock-auth identity. The signed-in
// owner's email is stored by AuthProvider under `hotelify_user`; we forward it
// as `x-user-email` so server routes can resolve membership + permissions.
// Swap this for a real session token when NextAuth lands.

function currentEmail(): string | null {
  try {
    const stored = localStorage.getItem('hotelify_user')
    if (!stored) return null
    return JSON.parse(stored).email ?? null
  } catch {
    return null
  }
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const email = currentEmail()
  const headers = new Headers(init.headers)
  if (email) headers.set('x-user-email', email)
  // Only set JSON content-type when we're sending a string body (not FormData).
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(input, { ...init, headers })
}

export async function apiJson<T = any>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(input, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err: any = new Error(data?.error || `Request failed (${res.status})`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data as T
}
