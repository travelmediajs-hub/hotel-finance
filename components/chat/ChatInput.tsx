// components/chat/ChatInput.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ArrowUp } from 'lucide-react'

interface Props {
  onSend: (content: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className="border-t border-border p-4">
      <div className="relative flex items-end gap-2 rounded-xl border border-border bg-secondary p-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напиши съобщение... (Enter за изпращане, Shift+Enter за нов ред)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm text-foreground placeholder:text-muted-foreground min-h-[36px] max-h-[200px]"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg bg-accent hover:bg-primary text-accent-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
