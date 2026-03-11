// app/(app)/chat/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar/Sidebar'
import { ChatWindow } from '@/components/chat/ChatWindow'
import type { Conversation, Message } from '@/types/chat'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load all sidebar conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, user_id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // Load messages for this conversation
  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) notFound()

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        conversations={(conversations as Conversation[]) ?? []}
        userEmail={user.email ?? ''}
      />
      <main className="flex-1 overflow-hidden">
        <ChatWindow
          initialMessages={(messages as Message[]) ?? []}
          conversationId={id}
        />
      </main>
    </div>
  )
}
