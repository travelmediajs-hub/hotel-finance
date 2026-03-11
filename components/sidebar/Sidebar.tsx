// components/sidebar/Sidebar.tsx
'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConversationItem } from './ConversationItem'
import { Plus, LogOut } from 'lucide-react'
import type { Conversation } from '@/types/chat'

interface Props {
  conversations: Conversation[]
  userEmail: string
}

export function Sidebar({ conversations, userEmail }: Props) {
  const router = useRouter()

  async function handleNewChat() {
    const res = await fetch('/api/conversations', { method: 'POST' })
    if (!res.ok) return
    const conv = await res.json()
    router.push(`/chat/${conv.id}`)
    router.refresh()
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r border-border">
      {/* Header */}
      <div className="p-4">
        <h1 className="text-sm font-semibold text-foreground mb-3">AI Асистент</h1>
        <Button
          onClick={handleNewChat}
          variant="outline"
          className="w-full justify-start gap-2 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <Plus className="h-4 w-4" />
          Нов разговор
        </Button>
      </div>

      <Separator className="bg-border" />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Няма разговори. Започни нов!
          </p>
        ) : (
          conversations.map(conv => (
            <ConversationItem key={conv.id} conversation={conv} />
          ))
        )}
      </div>

      <Separator className="bg-border" />

      {/* User footer */}
      <div className="p-3 flex items-center gap-3">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-secondary text-muted-foreground text-xs">
            {userEmail[0]?.toUpperCase() ?? '?'}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 text-xs text-muted-foreground truncate">{userEmail}</span>
        <button
          onClick={handleSignOut}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Изход"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
