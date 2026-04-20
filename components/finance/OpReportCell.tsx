'use client'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import type { OpReportDisplayFormat } from '@/types/finance'

interface Props {
  value: number | null
  editable: boolean
  format: OpReportDisplayFormat
  onCommit?: (newValue: number | null) => void
  readonly?: boolean
  className?: string
}

function fmt(value: number | null, format: OpReportDisplayFormat): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  if (format === 'PERCENT') return `${value.toFixed(1)}%`
  if (format === 'CURRENCY') return value.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
  return value.toLocaleString('bg-BG', { maximumFractionDigits: 2 })
}

export function OpReportCell({ value, editable, format, onCommit, readonly, className }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value === null ? '' : String(value))

  useEffect(() => {
    setDraft(value === null ? '' : String(value))
  }, [value])

  if (!editable || readonly) {
    return (
      <div className={cn('px-2 py-1 text-right tabular-nums', className)}>
        {fmt(value, format)}
      </div>
    )
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          const parsed = draft.trim() === '' ? null : parseFloat(draft)
          const next = parsed !== null && !Number.isNaN(parsed) ? parsed : null
          if (next !== value) onCommit?.(next)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === 'Tab') (e.currentTarget as HTMLInputElement).blur()
          if (e.key === 'Escape') { setDraft(value === null ? '' : String(value)); setEditing(false) }
        }}
        className={cn('w-full px-2 py-1 text-right tabular-nums bg-background border border-primary outline-none', className)}
      />
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className={cn('px-2 py-1 text-right tabular-nums hover:bg-muted/40 cursor-text', className)}
    >
      {fmt(value, format)}
    </div>
  )
}
