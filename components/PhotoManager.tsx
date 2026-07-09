'use client'

import { useRef, useState } from 'react'
import { Photo } from '@/lib/types'
import { resolvePhoto } from '@/lib/photo'

// Photo management (S1.2): reorder, hide/show, set cover, upload custom, delete.
// All mutations are persisted immediately through the parent handlers, which
// return the refreshed photo set.

interface Props {
  photos: Photo[]
  onSaveMeta: (photos: { id: string; order: number; hidden: boolean; isCover: boolean }[]) => Promise<void>
  onUpload: (file: File) => Promise<void>
  onDelete: (photoId: string) => Promise<void>
}

function ordered(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => a.order - b.order)
}

export default function PhotoManager({ photos, onSaveMeta, onUpload, onDelete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const list = ordered(photos)

  // Re-number order sequentially and persist.
  const persist = async (next: Photo[]) => {
    setBusy(true)
    setError('')
    try {
      const meta = next.map((p, i) => ({ id: p.id, order: i, hidden: p.hidden, isCover: p.isCover }))
      await onSaveMeta(meta)
    } catch (e: any) {
      setError(e.message || 'Could not save photo changes')
    } finally {
      setBusy(false)
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = [...list]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    persist(next)
  }

  const toggleHidden = (id: string) => {
    const next = list.map(p => (p.id === id ? { ...p, hidden: !p.hidden } : p))
    persist(next)
  }

  const setCover = (id: string) => {
    // Cover must be visible; exactly one cover.
    const next = list.map(p => ({ ...p, isCover: p.id === id, hidden: p.id === id ? false : p.hidden }))
    persist(next)
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await onUpload(file)
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await onDelete(id)
    } catch (err: any) {
      setError(err.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="photos">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Photos</h2>
        <div className="flex items-center gap-3">
          {busy && (
            <svg className="animate-spin w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            + Upload photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-primary-pale border border-red-200 rounded-xl">
          <p className="text-sm text-primary">{error}</p>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-gray-400 text-sm">No photos yet — upload one to get started.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {list.map((photo, i) => (
            <div
              key={photo.id}
              className={`relative rounded-xl overflow-hidden border-2 ${
                photo.isCover ? 'border-primary' : 'border-transparent'
              } ${photo.hidden ? 'opacity-50' : ''}`}
            >
              <div className="aspect-video bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolvePhoto(photo, 600)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </div>

              {photo.isCover && (
                <span className="absolute top-2 left-2 bg-primary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  Cover
                </span>
              )}
              {photo.hidden && (
                <span className="absolute top-2 right-2 bg-gray-800/80 text-white text-xs px-2 py-0.5 rounded-full">
                  Hidden
                </span>
              )}

              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <IconButton label="Move left" onClick={() => move(i, -1)} disabled={i === 0}>
                    ←
                  </IconButton>
                  <IconButton label="Move right" onClick={() => move(i, 1)} disabled={i === list.length - 1}>
                    →
                  </IconButton>
                </div>
                <div className="flex gap-1">
                  {!photo.isCover && (
                    <TextButton onClick={() => setCover(photo.id)}>Cover</TextButton>
                  )}
                  <TextButton onClick={() => toggleHidden(photo.id)}>
                    {photo.hidden ? 'Show' : 'Hide'}
                  </TextButton>
                  <TextButton onClick={() => handleDelete(photo.id)}>Delete</TextButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function IconButton({
  children, onClick, disabled, label,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="w-6 h-6 flex items-center justify-center rounded bg-white/90 text-gray-800 text-sm font-bold hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}

function TextButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded bg-white/90 text-gray-800 text-xs font-medium hover:bg-white"
    >
      {children}
    </button>
  )
}
