'use client'

import { useState, useEffect } from 'react'

// Inline editable field (S1.4). Click to edit; Enter or blur saves via onSave.
// Escape cancels. Supports single-line (input) and multi-line (textarea).

interface Props {
  value: string
  onSave: (value: string) => Promise<void>
  placeholder?: string
  multiline?: boolean
  type?: 'text' | 'tel' | 'url' | 'number'
  className?: string
  label?: string
}

export default function EditableField({
  value, onSave, placeholder, multiline, type = 'text', className, label,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(value) }, [value])

  const commit = async () => {
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      setDraft(value)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => { setDraft(value); setEditing(false) }

  if (editing) {
    const common = {
      value: draft,
      autoFocus: true,
      disabled: saving,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      className: `w-full border-2 border-primary rounded-lg px-3 py-2 text-gray-900 focus:outline-none ${className ?? ''}`,
    }
    return multiline ? (
      <textarea
        {...common}
        rows={4}
        onKeyDown={e => { if (e.key === 'Escape') cancel() }}
      />
    ) : (
      <input
        {...common}
        type={type}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') cancel()
        }}
      />
    )
  }

  const isEmpty = !value
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={label ? `Edit ${label}` : 'Click to edit'}
      className={`group text-left inline-flex items-start gap-1.5 rounded-lg hover:bg-black/5 px-1 -mx-1 transition-colors ${className ?? ''}`}
    >
      <span className={isEmpty ? 'text-gray-400 italic' : ''}>
        {isEmpty ? (placeholder || `Add ${label ?? 'value'}`) : value}
      </span>
      <svg
        className="w-3.5 h-3.5 mt-1 opacity-0 group-hover:opacity-60 flex-shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  )
}
