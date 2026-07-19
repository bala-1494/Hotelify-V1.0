'use client'

import { Hotel, PriceOption } from '@/lib/types'
import { Theme } from '@/lib/themes'
import { photoUrl } from '@/lib/photo'

// Shared live-preview of the guest booking page, used by both the onboarding
// wizard and the owner console's Room-types step. It stands in for the real
// published page at /book/[subdomain] — close enough to show the effect of an
// edit as it happens, without the availability/booking machinery.

const rupee = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')

// A guest-selectable add-on shown in the preview (View or Meal-plan option).
export interface PreviewAddon {
  label: string
  priceDelta: number
}

export interface PreviewRoom {
  name: string
  price: number
  maxOccupancy: number
  bedNote: string
  amenities: string[]
  // Kept separate (not a flat list) so the preview can mirror the real booking
  // page: View + Meal plan are OPTIONAL groups the guest picks from, each choice
  // adding its priceDelta to the per-night rate.
  viewOptions: PreviewAddon[]
  mealOptions: PreviewAddon[]
}

// Structural input satisfied by both the wizard's WizRoom and the console's
// RoomType (maxOccupancy / bedNote are optional on RoomType).
export interface PreviewRoomInput {
  name: string
  basePrice: number
  maxOccupancy?: number
  bedNote?: string
  amenities: string[]
  viewOptionIds: string[]
  mealOptionIds: string[]
}

export function previewRooms(
  rooms: PreviewRoomInput[],
  viewOptions: PriceOption[],
  mealOptions: PriceOption[]
): PreviewRoom[] {
  const resolve = (pool: PriceOption[], ids: string[]): PreviewAddon[] =>
    ids
      .map(id => pool.find(o => o.id === id))
      .filter((o): o is PriceOption => !!o)
      .map(o => ({ label: o.label, priceDelta: o.priceDelta }))
  return rooms.map(r => ({
    name: r.name,
    price: r.basePrice,
    maxOccupancy: r.maxOccupancy ?? 2,
    bedNote: r.bedNote ?? '',
    amenities: r.amenities,
    viewOptions: resolve(viewOptions, r.viewOptionIds),
    mealOptions: resolve(mealOptions, r.mealOptionIds),
  }))
}

export function BrowserFrame({ slug, badge, compact, children }: {
  slug: string
  badge?: string
  compact?: boolean
  children: React.ReactNode
}) {
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

// Lightweight, self-contained render of the booking page. The real published
// page lives at /book/[subdomain].
export function WizardPreview({ theme, hotel, summary, coverRef, rooms, compact }: {
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
                {r.bedNote && <p className="text-xs text-gray-400 mt-0.5">{r.bedNote}</p>}
                <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                  <span aria-hidden>👤</span> Max {r.maxOccupancy} guest{r.maxOccupancy === 1 ? '' : 's'}
                </span>
                {r.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.amenities.map(a => (
                      <span key={a} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                  </div>
                )}
                {/* View + Meal plan mirror the real booking flow: optional groups
                    the guest picks from, each choice adding to the nightly rate.
                    The default (free) chip is pre-selected, like on the live page. */}
                <PreviewAddonGroup title="View" defaultLabel="Standard" options={r.viewOptions} theme={theme} />
                <PreviewAddonGroup title="Meal plan" defaultLabel="Room only" options={r.mealOptions} theme={theme} />
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

// A read-only stand-in for the booking page's optional add-on selector. Shows the
// default (free) choice pre-selected followed by each opted-in option with its
// "+₹" surcharge, so the owner sees exactly what a guest chooses from. Renders
// nothing when the room offers no options in that group.
function PreviewAddonGroup({ title, defaultLabel, options, theme }: {
  title: string
  defaultLabel: string
  options: PreviewAddon[]
  theme: Theme
}) {
  if (options.length === 0) return null
  return (
    <div className="mt-2.5">
      <p className="text-[10px] font-bold text-gray-400 tracking-wide uppercase mb-1">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full font-medium text-white"
          style={{ background: theme.primary }}
        >
          {defaultLabel}
        </span>
        {options.map(o => (
          <span
            key={o.label}
            className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600"
          >
            {o.label} +{rupee(o.priceDelta)}
          </span>
        ))}
      </div>
    </div>
  )
}
