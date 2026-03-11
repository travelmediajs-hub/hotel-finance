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

  let body: { conversationId?: unknown; role?: unknown; content?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const { conversationId, role, content } = body

  // Validate conversationId is a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!conversationId || typeof conversationId !== 'string' || !uuidRegex.test(conversationId)) {
    return NextResponse.json({ error: 'invalid_conversation_id' }, { status: 400 })
  }

  if (!conversationId || !role || !content) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const roleStr = role as string
  const contentStr = content as string

  if (!['user', 'assistant'].includes(roleStr)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
  }

  if (contentStr.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: 'content_too_long' }, { status: 400 })
  }

  // Insert message (RLS ensures conversation belongs to user)
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, role: roleStr, content: contentStr })
    .select('id, created_at')
    .single()

  if (msgError) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  // Set conversation title from first user message
  if (roleStr === 'user') {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('role', 'user')

    if (count === 1) {
      const title = contentStr.length > 60
        ? contentStr.slice(0, 60).trimEnd() + '...'
        : contentStr.trim()

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
