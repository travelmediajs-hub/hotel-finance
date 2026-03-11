'use client'
// components/chat/MessageBubble.tsx
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Message } from '@/types/chat'
import 'highlight.js/styles/github-dark.css'

interface Props {
  message: Message | { role: 'assistant'; content: string; id: string; streaming?: boolean }
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isStreaming = 'streaming' in message && message.streaming

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser
          ? 'bg-accent text-accent-foreground text-xs'
          : 'bg-secondary text-muted-foreground text-xs'
        }>
          {isUser ? 'Аз' : 'AI'}
        </AvatarFallback>
      </Avatar>

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-secondary text-foreground text-sm">
            {message.content}
          </div>
        ) : (
          <div className="text-foreground text-sm prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              rehypePlugins={[rehypeHighlight, rehypeSanitize]}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
