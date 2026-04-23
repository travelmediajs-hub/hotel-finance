'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/** Convert YYYY-MM-DD → DD.MM.YYYY */
function toDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}

/** Convert DD.MM.YYYY → YYYY-MM-DD */
function toIso(display: string): string {
  if (!display) return ''
  const [d, m, y] = display.split('.')
  if (!d || !m || !y || y.length !== 4) return ''
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

interface DateInputProps extends Omit<React.ComponentProps<'input'>, 'type' | 'onChange' | 'value' | 'defaultValue'> {
  /** ISO date string YYYY-MM-DD */
  value?: string
  /** ISO date string YYYY-MM-DD (for uncontrolled usage) */
  defaultValue?: string
  /** Called with ISO date string YYYY-MM-DD */
  onChange?: (e: { target: { value: string } }) => void
}

/**
 * Date input that displays DD.MM.YYYY format.
 * Accepts and emits YYYY-MM-DD ISO strings.
 * Supports both controlled (value/onChange) and uncontrolled (name/defaultValue) usage.
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, value, defaultValue, onChange, name, ...props }, ref) => {
    const isControlled = value !== undefined
    const [isoValue, setIsoValue] = React.useState(value ?? defaultValue ?? '')
    const [display, setDisplay] = React.useState(() => toDisplay(value ?? defaultValue ?? ''))
    const hiddenRef = React.useRef<HTMLInputElement>(null)

    // Sync when controlled value prop changes externally
    React.useEffect(() => {
      if (isControlled) {
        setDisplay(toDisplay(value ?? ''))
        setIsoValue(value ?? '')
      }
    }, [isControlled, value])

    function updateValue(iso: string) {
      setIsoValue(iso)
      setDisplay(toDisplay(iso))
      if (onChange) {
        onChange({ target: { value: iso } })
      }
    }

    function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
      let v = e.target.value.replace(/[^\d.]/g, '')

      // Auto-insert dots after DD and MM
      const digits = v.replace(/\./g, '')
      if (digits.length >= 2 && !v.includes('.')) {
        v = digits.slice(0, 2) + '.' + digits.slice(2)
      }
      if (digits.length >= 4) {
        v = digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4, 8)
      }

      setDisplay(v)

      // Emit ISO value when we have a complete date
      if (v.length === 10) {
        const iso = toIso(v)
        if (iso) {
          setIsoValue(iso)
          if (onChange) onChange({ target: { value: iso } })
        }
      } else if (v === '') {
        setIsoValue('')
        if (onChange) onChange({ target: { value: '' } })
      }
    }

    function handleCalendarClick() {
      hiddenRef.current?.showPicker?.()
    }

    function handleNativeDateChange(e: React.ChangeEvent<HTMLInputElement>) {
      updateValue(e.target.value)
    }

    function handleBlur() {
      if (display && display.length !== 10) {
        const iso = toIso(display)
        if (!iso) {
          setDisplay(toDisplay(isControlled ? (value ?? '') : isoValue))
        }
      }
    }

    return (
      <div className="relative flex w-full min-w-0">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          placeholder="дд.мм.гггг"
          maxLength={10}
          value={display}
          onChange={handleTextChange}
          onBlur={handleBlur}
          className={cn(
            'h-8 flex-1 min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 pr-7 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30 dark:disabled:bg-input/80',
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={handleCalendarClick}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Отвори календар"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
        </button>
        {/* Hidden native date input for calendar popup and form submission */}
        <input
          ref={hiddenRef}
          type="date"
          name={name}
          value={isoValue}
          onChange={handleNativeDateChange}
          className="absolute inset-0 opacity-0 pointer-events-none"
          tabIndex={-1}
          aria-hidden
          required={props.required}
        />
      </div>
    )
  }
)
DateInput.displayName = 'DateInput'

export { DateInput }
