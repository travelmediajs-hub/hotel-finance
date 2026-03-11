// app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_CONTENT_LENGTH = 32_000

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { conversationId, role, content } = body

  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  if (!['user', 'assistant'].includes(role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'content_too_long' }, { status: 400 })
  }

  // Insert message (RLS ensures conversation belongs to user)
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role, content })
    .select('id, created_at')
    .single()

  if (msgError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Set conversation title from first user message
  if (role === 'user') {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('role', 'user')

    if (count === 1) {
      const title = content.length > 60
        ? content.slice(0, 60).trimEnd() + '...'
        : content.trim()

      await supabase
        .from('conversations')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    } else {
      // Update updated_at for sidebar sorting
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
    }
  }

  return NextResponse.json(message, { status: 201 })
}
