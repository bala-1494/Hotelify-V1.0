'use client'

import { Hotel } from '@/lib/types'
import EditableField from '@/components/EditableField'

// Step 1 of the setup wizard (S1.7): confirm the imported basic details.
// Everything auto-saves via patchHotel; "Confirm & continue" in the wizard
// footer just advances.

const PRICE = ['', '$', '$$', '$$$', '$$$$']

interface Props {
  hotel: Hotel
  patchHotel: (patch: Record<string, any>) => Promise<void>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-4 border-b border-gray-50 last:border-0">
      <span className="text-sm font-medium text-gray-500 sm:w-40 sm:pt-1 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0 text-gray-900">{children}</div>
    </div>
  )
}

export default function BasicInfoStep({ hotel, patchHotel }: Props) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Confirm hotel details</h2>
      <p className="text-sm text-gray-400 mb-6">
        We imported these from Google. Tap any value to edit — changes save as you go.
      </p>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-5 sm:px-6">
        <Row label="Hotel name">
          <div className="text-lg font-semibold">
            <EditableField value={hotel.name} label="hotel name" onSave={v => patchHotel({ name: v })} />
          </div>
        </Row>

        <Row label="Address">
          <EditableField value={hotel.address} label="address" onSave={v => patchHotel({ address: v })} />
        </Row>

        <Row label="Phone">
          <EditableField
            value={hotel.phone ?? ''}
            label="phone"
            type="tel"
            placeholder="Add phone"
            onSave={v => patchHotel({ phone: v })}
          />
        </Row>

        <Row label="Website">
          <EditableField
            value={hotel.website ?? ''}
            label="website"
            type="url"
            placeholder="Add website"
            onSave={v => patchHotel({ website: v })}
          />
        </Row>

        <Row label="Price level">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => patchHotel({ priceLevel: n })}
                title={`Set price level to ${PRICE[n]}`}
                className={`w-9 h-9 rounded-lg font-bold text-sm transition-colors ${
                  (hotel.priceLevel ?? 0) >= n
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                }`}
              >
                $
              </button>
            ))}
            {hotel.priceLevel ? (
              <button
                type="button"
                onClick={() => patchHotel({ priceLevel: 0 })}
                className="ml-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            ) : (
              <span className="ml-2 text-xs text-gray-400">Optional</span>
            )}
          </div>
        </Row>

        <Row label="Description">
          <div className="leading-relaxed">
            <EditableField
              value={hotel.description ?? ''}
              label="description"
              multiline
              placeholder="Add a short description of your property…"
              onSave={v => patchHotel({ description: v })}
            />
          </div>
        </Row>
      </div>
    </section>
  )
}
