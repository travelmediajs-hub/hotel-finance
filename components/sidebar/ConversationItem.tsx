// components/sidebar/ConversationItem.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Conversation } from '@/types/chat'

interface Props {
  conversation: Conversation
}

export function ConversationItem({ conversation }: Props) {
  const pathname = usePathname()
  const isActive = pathname === `/chat/${conversation.id}`

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={`
        block px-3 py-2 rounded-lg text-sm truncate transition-colors
        ${isActive
          ? 'bg-accent/20 text-accent border border-accent/30'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        }
      `}
    >
      {conversation.title}
    </Link>
  )
}
