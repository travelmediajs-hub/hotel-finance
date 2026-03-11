// components/chat/MessageList.tsx
'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { Skeleton } from '@/components/ui/skeleton'
import type { Message } from '@/types/chat'

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  streaming: boolean
}

interface Props {
  messages: Message[]
  streamingMessage: StreamingMessage | null
  loading: boolean
}

export function MessageList({ messages, streamingMessage, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage?.content])

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {messages.length === 0 && !streamingMessage && (
          <div className="flex flex-col items-center justify-center h-full pt-20 gap-2">
            <p className="text-2xl font-semibold text-foreground">Здравей!</p>
            <p className="text-sm text-muted-foreground">Как мога да ти помогна?</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streamingMessage && (
          <MessageBubble message={streamingMessage} />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
