'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  error?: boolean
  className?: string
}

const baseCls =
  'bg-transparent border rounded px-1 py-0.5 text-xs w-full focus:outline-none focus:ring-1'
const normalCls = `${baseCls} border-border focus:ring-ring`
const errorCls = `${baseCls} border-destructive focus:ring-destructive`

export function FilterSelect({ value, onChange, options, placeholder = '...', error }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLabel = options.find(o => o.value === value)?.label ?? ''

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const updatePos = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open, updatePos])

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
    setSearch('')
  }

  function handleInputFocus() {
    setOpen(true)
    setSearch('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      setSearch('')
      inputRef.current?.blur()
    }
    if (e.key === 'Enter' && filtered.length === 1) {
      handleSelect(filtered[0].value)
      inputRef.current?.blur()
    }
  }

  const dropdown = open && pos && createPortal(
    <div
      style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
      className="max-h-48 overflow-auto rounded border border-border bg-zinc-900 shadow-lg"
      onMouseDown={e => e.preventDefault()}
    >
      {filtered.length === 0 ? (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Няма резултати</div>
      ) : (
        filtered.map(o => (
          <div
            key={o.value}
            onMouseDown={() => handleSelect(o.value)}
            className={`px-2 py-1 text-xs cursor-pointer hover:bg-zinc-800 ${
              o.value === value ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300'
            }`}
          >
            {o.label}
          </div>
        ))
      )}
    </div>,
    document.body
  )

  return (
    <div ref={ref} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={open ? search : selectedLabel}
        placeholder={placeholder}
        onChange={e => setSearch(e.target.value)}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        className={error ? errorCls : normalCls}
      />
      {dropdown}
    </div>
  )
}
