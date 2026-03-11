// app/(app)/chat/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ChatPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find latest conversation
  const { data: latest } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (latest) {
    redirect(`/chat/${latest.id}`)
  }

  // No conversations yet — create one
  const { data: newConv } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, title: 'Нов разговор' })
    .select('id')
    .single()

  if (newConv) {
    redirect(`/chat/${newConv.id}`)
  }

  redirect('/login')
}
