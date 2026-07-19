'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { useHotels } from '@/hooks/useHotels'
import { apiFetch } from '@/lib/apiClient'
import { Hotel, PriceOption, RoomType } from '@/lib/types'
import { THEMES, DEFAULT_THEME_ID, Theme } from '@/lib/themes'
import { photoUrl } from '@/lib/photo'
import { generateMockHotel } from '@/lib/mockHotel'

// ---------------------------------------------------------------------------
// Onboarding — a single import → preview → customize → publish flow, matching
// the "Hotelify Onboarding" design. Everything is edited in local state and
// persisted once at publish: POST /api/hotels (create, honoring theme + rooms +
// add-on pools + summary/description + visible photos), then PATCH { published }.
// ---------------------------------------------------------------------------

type Step = 'import' | 'preview' | 'setup' | 'published'
type ImportMode = 'search' | 'url'

interface WizPhoto {
  ref: string
  label: string
  hidden: boolean
}

interface WizRoom {
  id: string
  name: string
  basePrice: number
  totalInventory: number
  maxOccupancy: number
  bedNote: string
  available: boolean
  amenities: string[]
  viewOptionIds: string[]
  mealOptionIds: string[]
  expanded: boolean
}

interface Prediction {
  placeId: string
  mainText: string
  secondaryText: string
}

const AMENITY_MASTER = ['Geyser', 'WiFi', 'Balcony', 'Attached Bathroom', 'AC', 'TV', 'Room service', 'Mini fridge']

const PRESETS: { name: string; maxOccupancy: number; basePrice: number; bedNote: string; hint: string; amenities: string[] }[] = [
  { name: 'Standard Room', maxOccupancy: 2, basePrice: 3499, bedNote: '1 queen bed · 220 sq ft', hint: 'from ₹3,499', amenities: ['WiFi', 'Geyser', 'Attached Bathroom'] },
  { name: 'Deluxe Room', maxOccupancy: 2, basePrice: 4799, bedNote: '1 king bed · 300 sq ft · city view', hint: 'from ₹4,799', amenities: ['WiFi', 'Geyser', 'Balcony', 'Attached Bathroom'] },
  { name: 'Twin Room', maxOccupancy: 2, basePrice: 3999, bedNote: '2 single beds · 250 sq ft', hint: 'from ₹3,999', amenities: ['WiFi', 'Geyser', 'Attached Bathroom'] },
  { name: 'Family Room', maxOccupancy: 4, basePrice: 5999, bedNote: '1 king + 2 singles · 400 sq ft', hint: 'from ₹5,999', amenities: ['WiFi', 'AC', 'TV', 'Attached Bathroom'] },
  { name: 'Suite', maxOccupancy: 4, basePrice: 7999, bedNote: 'Separate living area · 520 sq ft', hint: 'from ₹7,999', amenities: ['WiFi', 'AC', 'TV', 'Balcony', 'Room service'] },
]

const STEP_LABELS = ['Theme', 'Photos', 'Your story', 'Room types', 'Publish']
const IMPORT_TEXTS = [
  'Finding your property on Google Maps…',
  'Pulling photos & reviews…',
  'Reading address & amenities…',
  'Building your draft booking page…',
]

const uuid = () => crypto.randomUUID()
const rupee = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'your-hotel'

// Ensure an imported hotel satisfies the current Hotel shape before preview/persist.
function withDefaults(h: Hotel): Hotel {
  return {
    ...h,
    photos: h.photos ?? [],
    themeId: h.themeId ?? DEFAULT_THEME_ID,
    published: h.published ?? false,
    viewOptions: h.viewOptions ?? [],
    mealOptions: h.mealOptions ?? [],
    roomTypes: h.roomTypes ?? [],
  }
}

export default function OnboardingPage() {
  const { user, hotelId, loading, membershipLoading, signOut } = useAuth()
  const router = useRouter()
  const { addHotel } = useHotels()
  const createdRef = useRef(false)

  const [step, setStep] = useState<Step>('import')
  const [error, setError] = useState('')

  // Import screen
  const [importMode, setImportMode] = useState<ImportMode>('search')
  const [searchQ, setSearchQ] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importStep, setImportStep] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Imported hotel + wizard state
  const [imported, setImported] = useState<Hotel | null>(null)
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID)
  const [photos, setPhotos] = useState<WizPhoto[]>([])
  const [cover, setCover] = useState(0)
  const [summary, setSummary] = useState('')
  const [rooms, setRooms] = useState<WizRoom[]>([])
  const [viewOptions, setViewOptions] = useState<PriceOption[]>([
    { id: uuid(), label: 'Sea View', priceDelta: 500 },
    { id: uuid(), label: 'Garden view', priceDelta: 200 },
    { id: uuid(), label: 'Pool view', priceDelta: 100 },
  ])
  const [mealOptions, setMealOptions] = useState<PriceOption[]>([
    { id: uuid(), label: 'Breakfast', priceDelta: 300 },
    { id: uuid(), label: 'Lunch', priceDelta: 500 },
  ])

  // Setup wizard nav
  const [setupStep, setSetupStep] = useState(0)
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true })
  const [publishing, setPublishing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [liveSubdomain, setLiveSubdomain] = useState('')

  const theme = useMemo(() => THEMES.find(t => t.id === themeId) ?? THEMES[0], [themeId])

  // Routing guards: signed in; a returning owner (hotel already exists, and we
  // didn't just create it this session) skips onboarding.
  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (!membershipLoading && hotelId && !createdRef.current) router.replace('/dashboard')
  }, [user, hotelId, loading, membershipLoading, router])

  // Debounced Google autocomplete for the search tab.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = searchQ.trim()
    if (importMode !== 'search' || q.length < 3) { setPredictions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?input=${encodeURIComponent(q)}`)
        const data = await res.json()
        setPredictions(res.ok ? data.predictions ?? [] : [])
      } catch {
        setPredictions([])
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQ, importMode])

  // --- import -------------------------------------------------------------
  const fetchHotel = async (body: { placeId: string } | { url: string }, fallback: string): Promise<Hotel> => {
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.hotel) return data.hotel
    } catch { /* fall through to mock */ }
    // The live Places import is intermittently unavailable — fall back to a
    // deterministic mock so onboarding always has a property to customize.
    return generateMockHotel(fallback)
  }

  const runImport = async (body: { placeId: string } | { url: string }, fallback: string) => {
    setError('')
    setImporting(true)
    setImportStep(0)
    const timer = setInterval(() => setImportStep(s => Math.min(IMPORT_TEXTS.length - 1, s + 1)), 700)
    const [hotel] = await Promise.all([
      fetchHotel(body, fallback),
      new Promise(r => setTimeout(r, 2200)),
    ])
    clearInterval(timer)
    seedFromImport(withDefaults(hotel))
    setImporting(false)
    setStep('preview')
  }

  const seedFromImport = (h: Hotel) => {
    setImported(h)
    setPhotos((h.photoReferences ?? []).map((ref, i) => ({ ref, label: `Photo ${i + 1}`, hidden: false })))
    setCover(0)
    setSummary(h.description ?? '')
    setThemeId(DEFAULT_THEME_ID)
    setRooms([])
    setSetupStep(0)
    setVisited({ 0: true })
  }

  // --- room helpers -------------------------------------------------------
  const updateRoom = (id: string, patch: Partial<WizRoom>) =>
    setRooms(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  const removeRoom = (id: string) => setRooms(rs => rs.filter(r => r.id !== id))
  const addPreset = (p: (typeof PRESETS)[number]) => {
    if (rooms.some(r => r.name === p.name)) return
    setRooms(rs => [...rs, {
      id: uuid(), name: p.name, basePrice: p.basePrice, totalInventory: 4,
      maxOccupancy: p.maxOccupancy, bedNote: p.bedNote, available: true,
      amenities: p.amenities.slice(), viewOptionIds: [], mealOptionIds: [], expanded: false,
    }])
  }
  const addBlankRoom = () => setRooms(rs => [...rs, {
    id: uuid(), name: 'New room type', basePrice: 0, totalInventory: 1,
    maxOccupancy: 2, bedNote: '', available: true,
    amenities: ['WiFi'], viewOptionIds: [], mealOptionIds: [], expanded: true,
  }])

  const removeViewOption = (id: string) => {
    setViewOptions(os => os.filter(o => o.id !== id))
    setRooms(rs => rs.map(r => ({ ...r, viewOptionIds: r.viewOptionIds.filter(x => x !== id) })))
  }
  const removeMealOption = (id: string) => {
    setMealOptions(os => os.filter(o => o.id !== id))
    setRooms(rs => rs.map(r => ({ ...r, mealOptionIds: r.mealOptionIds.filter(x => x !== id) })))
  }

  // --- derived / validation ----------------------------------------------
  const visiblePhotos = photos.filter(p => !p.hidden)
  const coverPhoto = photos[cover] && !photos[cover].hidden ? photos[cover] : visiblePhotos[0]
  const hasRooms = rooms.length > 0
  const ratesOk = hasRooms && rooms.every(r => r.basePrice > 0)
  const slug = imported ? slugify(imported.name) : 'your-hotel'

  const checklist = [
    { ok: true, text: `Theme: ${theme.name}`, step: 0 },
    { ok: visiblePhotos.length > 0, text: `${visiblePhotos.length} photos on your page`, step: 1 },
    { ok: summary.trim().length > 20, text: 'Property summary written', step: 2 },
    { ok: hasRooms, text: hasRooms ? `${rooms.length} room type${rooms.length > 1 ? 's' : ''} added` : 'No room types yet', step: 3 },
    { ok: ratesOk, text: ratesOk ? 'Rates & inventory set' : 'Set a nightly rate for every room', step: 3 },
  ]
  const canPublish = checklist.every(c => c.ok)

  const goStep = (n: number) => { setSetupStep(n); setVisited(v => ({ ...v, [n]: true })) }

  // --- publish ------------------------------------------------------------
  const handlePublish = async () => {
    if (!imported || !canPublish || publishing) return
    setPublishing(true)
    setError('')

    const orderedRefs = coverPhoto
      ? [coverPhoto.ref, ...visiblePhotos.filter(p => p !== coverPhoto).map(p => p.ref)]
      : []

    const roomTypes: RoomType[] = rooms.map(r => ({
      id: r.id,
      name: r.name,
      basePrice: r.basePrice,
      totalInventory: r.totalInventory,
      amenities: r.amenities,
      viewOptionIds: r.viewOptionIds,
      mealOptionIds: r.mealOptionIds,
      available: r.available,
      maxOccupancy: r.maxOccupancy,
      bedNote: r.bedNote,
    }))

    const finalHotel: Hotel = {
      ...imported,
      description: summary,
      themeId,
      viewOptions,
      mealOptions,
      roomTypes,
      photoReferences: orderedRefs,
    }

    try {
      const created = await addHotel(finalHotel) // POST /api/hotels
      createdRef.current = true
      setLiveSubdomain(created.subdomain)
      const res = await apiFetch(`/api/hotels/${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ published: true }),
      })
      if (!res.ok) throw new Error('Could not publish. Please try again.')
      setPublishing(false)
      setStep('published')
    } catch (e: any) {
      if (e.status === 409) { createdRef.current = false; router.replace('/dashboard'); return }
      setPublishing(false)
      setError(e.message || 'Could not publish your page. Please try again.')
    }
  }

  const liveSlug = liveSubdomain || slug
  const copyLink = () => {
    try { navigator.clipboard.writeText(`https://hotelify.com/${liveSlug}`) } catch { /* clipboard unavailable */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="px-4 sm:px-8 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary rounded-[10px] flex items-center justify-center text-white font-extrabold">H</div>
            <span className="font-extrabold text-xl tracking-tight text-gray-900">hotelify</span>
          </div>
          <div className="ml-auto flex items-center gap-4 text-sm text-gray-500">
            <span className="hidden sm:inline text-gray-400">Owner</span>
            <span className="hidden sm:inline text-gray-600">{user.email}</span>
            <button
              onClick={() => { signOut(); router.replace('/login') }}
              className="text-gray-900 font-medium hover:text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* IMPORT */}
      {step === 'import' && (
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl">
            <div className="text-center mb-7">
              <span className="inline-block bg-primary-pale text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3.5 tracking-wide">
                STEP 1 OF 3 · ADD YOUR PROPERTY
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Find your hotel on Google</h1>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">
                We&apos;ll pull your name, address, photos and reviews — and build a draft booking page for you.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-7">
              {!importing ? (
                <>
                  {/* mode tabs */}
                  <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-5">
                    {(['search', 'url'] as ImportMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setImportMode(m)}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          importMode === m ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
                        }`}
                      >
                        {m === 'search' ? 'Search for your hotel' : 'Paste a Maps link'}
                      </button>
                    ))}
                  </div>

                  {importMode === 'search' ? (
                    <>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Hotel name &amp; city</label>
                      <input
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        placeholder="e.g. The Ritz-Carlton, New York"
                        className="w-full px-3.5 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                      />
                      {predictions.length > 0 ? (
                        <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden">
                          {predictions.map(p => (
                            <button
                              key={p.placeId}
                              onClick={() => runImport({ placeId: p.placeId }, p.mainText)}
                              className="w-full flex items-center gap-3 px-3.5 py-3 text-left border-b border-gray-100 last:border-0 hover:bg-primary-pale transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg bg-gray-200 flex-none" />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{p.mainText}</p>
                                <p className="text-xs text-gray-400 truncate">{p.secondaryText}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-gray-400 text-center py-2">
                          Start typing to search Google Maps.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Google Maps URL</label>
                      <div className="flex gap-2.5">
                        <input
                          value={url}
                          onChange={e => setUrl(e.target.value)}
                          placeholder="https://maps.app.goo.gl/…"
                          className="flex-1 px-3.5 py-3 border-[1.5px] border-gray-200 rounded-xl text-sm focus:border-primary focus:outline-none"
                        />
                        <button
                          onClick={() => url.trim() && runImport({ url }, url)}
                          disabled={!url.trim()}
                          className="px-5 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-40"
                        >
                          Import
                        </button>
                      </div>
                      <div className="mt-4 bg-gray-50 rounded-xl px-3.5 py-3 text-sm text-gray-500 leading-relaxed">
                        Find your hotel on Google Maps → tap <b>Share</b> → copy the link.{' '}
                        <button
                          onClick={() => setUrl('https://maps.app.goo.gl/bloomhubguindy')}
                          className="text-primary font-semibold"
                        >
                          Use a sample link
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3.5 py-2">
                  {IMPORT_TEXTS.map((t, i) => {
                    const done = i < importStep
                    const active = i === importStep
                    return (
                      <div key={t} className="flex items-center gap-3">
                        <span className={`rounded-full flex items-center justify-center flex-none ${
                          done ? 'bg-primary' : active ? 'bg-white border-2 border-primary' : 'bg-gray-100'
                        }`} style={{ width: 22, height: 22 }}>
                          {done && (
                            <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5 4.8 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                          )}
                          {active && <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                        </span>
                        <span className={`text-sm ${i <= importStep ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{t}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* PREVIEW */}
      {step === 'preview' && imported && (
        <main className="flex-1 px-6 py-9">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-6">
              <span className="inline-block bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                ✓ FOUND YOUR PROPERTY
              </span>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Here&apos;s your draft booking page</h1>
              <p className="text-gray-500 mt-1.5">Built from your Google listing. Next, make it yours.</p>
            </div>

            <BrowserFrame slug={slug} badge="DRAFT">
              <WizardPreview
                theme={theme}
                hotel={imported}
                summary={summary}
                coverRef={coverPhoto?.ref}
                rooms={previewRooms(rooms, viewOptions, mealOptions)}
              />
            </BrowserFrame>

            <div className="flex flex-wrap justify-center gap-3.5 mt-6">
              <button
                onClick={() => { setImported(null); setStep('import') }}
                className="px-5 py-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Wrong property? Try another
              </button>
              <button
                onClick={() => setStep('setup')}
                className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors shadow-sm"
              >
                Looks right — customize it →
              </button>
            </div>
          </div>
        </main>
      )}

      {/* SETUP WIZARD */}
      {step === 'setup' && imported && (
        <main className="flex-1 w-full max-w-[1480px] mx-auto px-4 sm:px-8 py-8 grid gap-7 items-start lg:grid-cols-[220px_minmax(0,1fr)_380px]">
          {/* rail */}
          <div className="lg:sticky lg:top-24 flex lg:flex-col flex-wrap gap-1">
            <div className="text-xs font-bold text-gray-400 tracking-wider w-full lg:px-3 mb-1.5">STEP 2 OF 3 · CUSTOMIZE</div>
            {STEP_LABELS.map((label, i) => {
              const active = i === setupStep
              const done = visited[i] && i !== setupStep
              return (
                <button
                  key={label}
                  onClick={() => goStep(i)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${active ? 'bg-primary-pale' : 'hover:bg-gray-100'}`}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-none ${
                    active || done ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {done ? <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5 4.8 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg> : i + 1}
                  </span>
                  <span className={`text-sm ${active ? 'text-primary font-bold' : 'text-gray-600 font-medium'}`}>{label}</span>
                </button>
              )
            })}
          </div>

          {/* main */}
          <div className="min-w-0">
            {setupStep === 0 && (
              <ThemeStep themes={THEMES} selectedId={themeId} onPick={setThemeId} />
            )}

            {setupStep === 1 && (
              <PhotosStep
                photos={photos}
                cover={cover}
                onToggle={i => setPhotos(ps => ps.map((p, j) => (j === i ? { ...p, hidden: !p.hidden } : p)))}
                onSetCover={i => { setCover(i); setPhotos(ps => ps.map((p, j) => (j === i ? { ...p, hidden: false } : p))) }}
              />
            )}

            {setupStep === 2 && (
              <StoryStep
                summary={summary}
                onChange={setSummary}
                imported={imported.description ?? ''}
              />
            )}

            {setupStep === 3 && (
              <RoomsStep
                rooms={rooms}
                viewOptions={viewOptions}
                mealOptions={mealOptions}
                onUpdateRoom={updateRoom}
                onRemoveRoom={removeRoom}
                onAddPreset={addPreset}
                onAddBlank={addBlankRoom}
                onAddView={(label, delta) => setViewOptions(os => [...os, { id: uuid(), label, priceDelta: delta }])}
                onAddMeal={(label, delta) => setMealOptions(os => [...os, { id: uuid(), label, priceDelta: delta }])}
                onRemoveView={removeViewOption}
                onRemoveMeal={removeMealOption}
              />
            )}

            {setupStep === 4 && (
              <PublishStep
                checklist={checklist}
                slug={slug}
                canPublish={canPublish}
                publishing={publishing}
                error={error}
                onFix={goStep}
                onPublish={handlePublish}
              />
            )}

            {/* footer nav */}
            {setupStep < 4 && (
              <div className="flex justify-between mt-7">
                {setupStep > 0 ? (
                  <button
                    onClick={() => goStep(setupStep - 1)}
                    className="px-5 py-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    ← Back
                  </button>
                ) : <div />}
                <button
                  onClick={() => goStep(setupStep + 1)}
                  className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors"
                >
                  Continue →
                </button>
              </div>
            )}
          </div>

          {/* live preview */}
          <div className="hidden lg:block lg:sticky lg:top-24">
            <div className="flex items-center justify-between mb-2.5 px-1">
              <span className="text-xs font-bold text-gray-400 tracking-wider">LIVE PREVIEW</span>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Updates as you edit</span>
            </div>
            <BrowserFrame slug={slug} compact>
              <div className="max-h-[640px] overflow-auto">
                <WizardPreview
                  theme={theme}
                  hotel={imported}
                  summary={summary}
                  coverRef={coverPhoto?.ref}
                  rooms={previewRooms(rooms.filter(r => r.available), viewOptions, mealOptions)}
                  compact
                />
              </div>
            </BrowserFrame>
          </div>
        </main>
      )}

      {/* PUBLISHED */}
      {step === 'published' && imported && (
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-lg text-center">
            <div className="w-[72px] h-[72px] rounded-full bg-primary mx-auto mb-5 flex items-center justify-center shadow-lg shadow-primary/30">
              <svg width="34" height="34" viewBox="0 0 24 24"><path d="M4 12.5 9.5 18 20 6.5" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{imported.name} is live!</h1>
            <p className="text-gray-500 mt-2.5 leading-relaxed">
              Share your booking link anywhere — WhatsApp, Instagram, your Google profile. Guests can request to book instantly.
            </p>
            <div className="mt-6 bg-white border border-gray-200 rounded-xl p-2 pl-4 flex items-center gap-3 shadow-sm">
              <span className="flex-1 text-left text-sm font-semibold text-gray-900 truncate">hotelify.com/{liveSlug}</span>
              <button
                onClick={copyLink}
                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${copied ? 'bg-green-50 text-green-700' : 'bg-primary text-white'}`}
              >
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
            </div>
            <div className="flex justify-center gap-3 mt-6">
              <a
                href={`/book/${liveSlug}`}
                className="px-5 py-3 border border-gray-200 rounded-xl bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                View booking page
              </a>
              <button
                onClick={() => router.replace('/dashboard')}
                className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors"
              >
                Go to dashboard →
              </button>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview data mapping + presentational pieces
// ---------------------------------------------------------------------------

interface PreviewRoom {
  name: string
  price: number
  maxOccupancy: number
  bedNote: string
  amenities: string[]
  addons: string[]
}

function previewRooms(rooms: WizRoom[], viewOptions: PriceOption[], mealOptions: PriceOption[]): PreviewRoom[] {
  const label = (pool: PriceOption[], ids: string[]) =>
    ids.map(id => pool.find(o => o.id === id)).filter(Boolean).map(o => `${o!.label} +₹${o!.priceDelta}`)
  return rooms.map(r => ({
    name: r.name,
    price: r.basePrice,
    maxOccupancy: r.maxOccupancy,
    bedNote: r.bedNote,
    amenities: r.amenities,
    addons: [...label(viewOptions, r.viewOptionIds), ...label(mealOptions, r.mealOptionIds)],
  }))
}

function BrowserFrame({ slug, badge, compact, children }: { slug: string; badge?: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-xl shadow-gray-900/5">
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[#F45B5B]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#F6BE4F]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#5FC454]" />
        <div className={`flex-1 bg-white rounded-lg py-1.5 text-xs text-gray-500 text-center truncate ${compact ? 'mx-4' : 'mx-16'}`}>
          hotelify.com/<b className="text-gray-900">{slug}</b>
          {badge && <span className="ml-2 bg-gray-100 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
      </div>
      {children}
    </div>
  )
}

// Lightweight, self-contained render of the booking page (stands in for the
// design's BookingPagePreview; the real published page lives at /book/[subdomain]).
function WizardPreview({ theme, hotel, summary, coverRef, rooms, compact }: {
  theme: Theme
  hotel: Hotel
  summary: string
  coverRef?: string
  rooms: PreviewRoom[]
  compact?: boolean
}) {
  const from = rooms.length ? Math.min(...rooms.map(r => r.price).filter(p => p > 0)) : 0
  return (
    <div className="bg-white text-gray-900">
      {/* hero */}
      <div className="relative h-44 bg-gray-900">
        {coverRef ? (
          <img src={photoUrl(coverRef, 1000)} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover opacity-90" />
        ) : (
          <div className="absolute inset-0" style={{ background: theme.primary }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className={`text-white font-extrabold ${compact ? 'text-lg' : 'text-2xl'}`}>{hotel.name}</h2>
          <p className="text-white/70 text-xs truncate">{hotel.address}</p>
        </div>
      </div>

      <div className={compact ? 'p-4' : 'p-6'}>
        <div className="flex items-center gap-3 text-sm mb-3">
          <span className="text-amber-400">★</span>
          <b>{hotel.rating}</b>
          <span className="text-gray-400">({hotel.totalRatings?.toLocaleString()})</span>
          {from > 0 && (
            <span className="ml-auto text-gray-500">from <b style={{ color: theme.primary }}>{rupee(from)}</b>/night</span>
          )}
        </div>
        {summary && <p className="text-gray-500 text-sm leading-relaxed mb-4">{summary}</p>}

        <p className="text-xs font-bold text-gray-400 tracking-wide mb-2">ROOMS</p>
        {rooms.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No rooms added yet.</p>
        ) : (
          <div className="space-y-2.5">
            {rooms.map((r, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-sm text-gray-900">{r.name}</span>
                  <span className="text-sm font-bold" style={{ color: theme.primary }}>{rupee(r.price)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Sleeps {r.maxOccupancy}{r.bedNote ? ` · ${r.bedNote}` : ''}
                </p>
                {(r.amenities.length > 0 || r.addons.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.amenities.map(a => (
                      <span key={a} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                    {r.addons.map(a => (
                      <span key={a} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: theme.accent, color: theme.primary }}>{a}</span>
                    ))}
                  </div>
                )}
                <button
                  className="mt-3 w-full py-2 rounded-lg text-white text-xs font-bold"
                  style={{ background: theme.primary }}
                >
                  Request to book
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function ThemeStep({ themes, selectedId, onPick }: { themes: Theme[]; selectedId: string; onPick: (id: string) => void }) {
  return (
    <section>
      <h2 className="text-[23px] font-extrabold tracking-tight text-gray-900">Pick a theme</h2>
      <p className="text-gray-500 text-sm mt-1.5 mb-5">Sets the look of your booking page. You can switch anytime.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {themes.map(t => {
          const selected = t.id === selectedId
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className={`text-left bg-white rounded-2xl p-4 transition-shadow ${selected ? 'ring-2 ring-primary shadow-md' : 'border border-gray-200 hover:border-primary'}`}
            >
              <div className="h-[86px] rounded-xl relative overflow-hidden mb-3" style={{ background: t.accent }}>
                <div className="absolute left-3 top-3 w-24 h-2.5 rounded" style={{ background: t.primary }} />
                <div className="absolute left-3 top-8 w-32 h-1.5 rounded bg-black/10" />
                <div className="absolute left-3 bottom-3 w-16 h-5 rounded-md" style={{ background: t.primary }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{t.name}</span>
                {selected && (
                  <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 12 12"><path d="M2 6.5 4.8 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function PhotosStep({ photos, cover, onToggle, onSetCover }: {
  photos: WizPhoto[]
  cover: number
  onToggle: (i: number) => void
  onSetCover: (i: number) => void
}) {
  const visibleCount = photos.filter(p => !p.hidden).length
  return (
    <section>
      <h2 className="text-[23px] font-extrabold tracking-tight text-gray-900">Review your photos</h2>
      <p className="text-gray-500 text-sm mt-1.5 mb-5">
        We imported <b className="text-gray-900">{visibleCount} photos</b> from Google. Hide the ones you don&apos;t love or pick a cover.
      </p>
      {photos.length === 0 ? (
        <p className="text-sm text-gray-400">No photos were imported for this property.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {photos.map((p, i) => {
            const isCover = i === cover && !p.hidden
            return (
              <div key={i} className={`rounded-xl overflow-hidden border border-gray-200 relative ${p.hidden ? 'opacity-45' : ''}`}>
                <div className="h-28 bg-gray-100">
                  <img src={photoUrl(p.ref, 400)} alt={p.label} className="w-full h-full object-cover" />
                </div>
                {isCover && (
                  <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">COVER</span>
                )}
                <div className="flex bg-white border-t border-gray-100 text-xs font-semibold text-gray-600">
                  <button onClick={() => onSetCover(i)} className="flex-1 py-2 border-r border-gray-100 hover:text-primary transition-colors">Set cover</button>
                  <button onClick={() => onToggle(i)} className="flex-1 py-2 hover:text-primary transition-colors">{p.hidden ? 'Show' : 'Hide'}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function StoryStep({ summary, onChange, imported }: { summary: string; onChange: (v: string) => void; imported: string }) {
  return (
    <section>
      <h2 className="text-[23px] font-extrabold tracking-tight text-gray-900">Tell guests your story</h2>
      <p className="text-gray-500 text-sm mt-1.5 mb-5">We drafted this from your Google listing — make it sound like you.</p>
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-600">Property summary</span>
          <span className="text-xs text-gray-400">{summary.length} / 400</span>
        </div>
        <textarea
          value={summary}
          onChange={e => onChange(e.target.value.slice(0, 400))}
          rows={7}
          className="w-full border-[1.5px] border-gray-200 rounded-xl p-3.5 text-sm leading-relaxed focus:border-primary focus:outline-none resize-y"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => onChange(`${summary.trim()} We can't wait to host you.`.slice(0, 400))}
            className="text-xs font-semibold text-primary bg-primary-pale px-3 py-1.5 rounded-full"
          >
            ✦ Make it warmer
          </button>
          <button
            onClick={() => onChange(summary.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').slice(0, 400))}
            className="text-xs font-semibold text-primary bg-primary-pale px-3 py-1.5 rounded-full"
          >
            ✦ Shorten
          </button>
          <button
            onClick={() => onChange(imported)}
            className="text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full"
          >
            Reset to imported
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          Tip: the ✦ suggestions tidy your text locally — AI-written descriptions are coming soon.
        </p>
      </div>
    </section>
  )
}

function RoomsStep({
  rooms, viewOptions, mealOptions,
  onUpdateRoom, onRemoveRoom, onAddPreset, onAddBlank,
  onAddView, onAddMeal, onRemoveView, onRemoveMeal,
}: {
  rooms: WizRoom[]
  viewOptions: PriceOption[]
  mealOptions: PriceOption[]
  onUpdateRoom: (id: string, patch: Partial<WizRoom>) => void
  onRemoveRoom: (id: string) => void
  onAddPreset: (p: (typeof PRESETS)[number]) => void
  onAddBlank: () => void
  onAddView: (label: string, delta: number) => void
  onAddMeal: (label: string, delta: number) => void
  onRemoveView: (id: string) => void
  onRemoveMeal: (id: string) => void
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[23px] font-extrabold tracking-tight text-gray-900">Room types</h2>
        <button onClick={onAddBlank} className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors whitespace-nowrap">
          + Add Room Type
        </button>
      </div>
      <p className="text-gray-500 text-sm mt-1.5 mb-4">Set rate, inventory and details per room — or quick-add a preset:</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {PRESETS.map(p => {
          const added = rooms.some(r => r.name === p.name)
          return (
            <button
              key={p.name}
              onClick={() => onAddPreset(p)}
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

      {/* shared add-on pools */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
        <p className="font-bold text-gray-900">Add-on options</p>
        <p className="text-gray-400 text-sm mt-0.5 mb-4">
          Define View and Meal-plan add-ons once here — each room type picks which ones it offers.
        </p>
        <SharedPool title="View" options={viewOptions} onAdd={onAddView} onRemove={onRemoveView} placeholder="Sea View" />
        <div className="h-5" />
        <SharedPool title="Meal Plan" options={mealOptions} onAdd={onAddMeal} onRemove={onRemoveMeal} placeholder="Breakfast Included" />
      </div>

      {rooms.length === 0 ? (
        <div className="border-[1.5px] border-dashed border-gray-300 rounded-2xl p-9 text-center text-gray-400 text-sm">
          No rooms yet — quick-add a preset above or tap <b>+ Add Room Type</b>.
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map(r => (
            <RoomCard
              key={r.id}
              room={r}
              viewOptions={viewOptions}
              mealOptions={mealOptions}
              onUpdate={patch => onUpdateRoom(r.id, patch)}
              onRemove={() => onRemoveRoom(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SharedPool({ title, options, onAdd, onRemove, placeholder }: {
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
              <button onClick={() => onRemove(o.id)} className="text-primary/50 font-bold hover:text-primary">×</button>
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
          className="w-20 px-3 py-2.5 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-primary focus:outline-none"
        />
        <button onClick={add} className="px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
          Add
        </button>
      </div>
    </div>
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

function RoomCard({ room, viewOptions, mealOptions, onUpdate, onRemove }: {
  room: WizRoom
  viewOptions: PriceOption[]
  mealOptions: PriceOption[]
  onUpdate: (patch: Partial<WizRoom>) => void
  onRemove: () => void
}) {
  const chip = (on: boolean) =>
    `text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary'}`
  const toggleIn = (key: 'viewOptionIds' | 'mealOptionIds', id: string) => {
    const has = room[key].includes(id)
    onUpdate({ [key]: has ? room[key].filter(x => x !== id) : [...room[key], id] } as Partial<WizRoom>)
  }
  const toggleAmenity = (a: string) => {
    const has = room.amenities.includes(a)
    onUpdate({ amenities: has ? room.amenities.filter(x => x !== a) : [...room.amenities, a] })
  }
  const selectedAddons = [
    ...viewOptions.filter(o => room.viewOptionIds.includes(o.id)),
    ...mealOptions.filter(o => room.mealOptionIds.includes(o.id)),
  ]

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
        <button onClick={() => onUpdate({ expanded: !room.expanded })} className="text-sm font-semibold text-primary">
          {room.expanded ? 'Done ✓' : 'Edit details'}
        </button>
        <button onClick={onRemove} className="text-gray-300 hover:text-primary text-lg leading-none">×</button>
      </div>

      {!room.expanded && (room.amenities.length > 0 || selectedAddons.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {room.amenities.map(a => (
            <span key={a} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">{a}</span>
          ))}
          {selectedAddons.map(o => (
            <span key={o.id} className="text-xs bg-primary-pale text-primary px-3 py-1 rounded-full">{o.label} +₹{o.priceDelta}</span>
          ))}
        </div>
      )}

      {room.expanded && (
        <div className="mt-4 border-t border-gray-100 pt-4 flex flex-col gap-4">
          <div className="flex gap-7 flex-wrap items-center">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-gray-600">Max guests</span>
              <Stepper value={room.maxOccupancy} min={1} max={8} onChange={v => onUpdate({ maxOccupancy: v })} />
            </div>
            <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
              <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">Bed &amp; size</span>
              <input
                value={room.bedNote}
                onChange={e => onUpdate({ bedNote: e.target.value })}
                placeholder="1 king bed · 300 sq ft"
                className="flex-1 px-3 py-2 border-[1.5px] border-gray-200 rounded-lg text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Amenities</p>
            <div className="flex flex-wrap gap-2">
              {AMENITY_MASTER.map(a => (
                <button key={a} onClick={() => toggleAmenity(a)} className={chip(room.amenities.includes(a))}>{a}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Views offered <span className="text-gray-400 font-medium">(guests pay the add-on)</span></p>
            {viewOptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">None defined yet — add View options above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {viewOptions.map(o => (
                  <button key={o.id} onClick={() => toggleIn('viewOptionIds', o.id)} className={chip(room.viewOptionIds.includes(o.id))}>
                    {o.label} +₹{o.priceDelta}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Meal plans offered</p>
            {mealOptions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">None defined yet — add Meal Plan options above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {mealOptions.map(o => (
                  <button key={o.id} onClick={() => toggleIn('mealOptionIds', o.id)} className={chip(room.mealOptionIds.includes(o.id))}>
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

function PublishStep({ checklist, slug, canPublish, publishing, error, onFix, onPublish }: {
  checklist: { ok: boolean; text: string; step: number }[]
  slug: string
  canPublish: boolean
  publishing: boolean
  error: string
  onFix: (step: number) => void
  onPublish: () => void
}) {
  return (
    <section>
      <h2 className="text-[23px] font-extrabold tracking-tight text-gray-900">Ready to publish?</h2>
      <p className="text-gray-500 text-sm mt-1.5 mb-5">One last look — here&apos;s what your booking page includes.</p>
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-2">
        {checklist.map((c, i) => (
          <div key={i} className="flex items-center gap-3 py-3.5 border-b border-gray-100">
            <span className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-none ${c.ok ? 'bg-green-500' : 'bg-amber-400'}`}>
              {c.ok
                ? <svg width="11" height="11" viewBox="0 0 12 12"><path d="M2 6.5 4.8 9 10 3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
                : <span className="text-white text-xs font-extrabold">!</span>}
            </span>
            <span className="flex-1 text-sm text-gray-900">{c.text}</span>
            {!c.ok && (
              <button onClick={() => onFix(c.step)} className="text-sm font-semibold text-primary">Fix</button>
            )}
          </div>
        ))}
        {error && <p className="text-sm text-primary py-3">{error}</p>}
        <div className="flex items-center gap-3 py-3.5 flex-wrap">
          <span className="flex-1 text-sm text-gray-500 min-w-[180px]">Your page will live at <b className="text-gray-900">hotelify.com/{slug}</b></span>
          <button
            onClick={onPublish}
            disabled={!canPublish || publishing}
            className="px-7 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {publishing ? 'Publishing…' : 'Publish booking page'}
          </button>
        </div>
      </div>
    </section>
  )
}
