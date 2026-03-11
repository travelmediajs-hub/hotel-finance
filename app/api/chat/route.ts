// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, OPENAI_MODEL } from '@/lib/openai'
import type { ChatMessage } from '@/types/chat'

const MAX_MESSAGES = 20

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { conversationId?: unknown; messages?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const { conversationId, messages } = body as { conversationId: string; messages: ChatMessage[] }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'invalid_messages' }, { status: 400 })
  }

  if (!conversationId || typeof conversationId !== 'string') {
    return NextResponse.json({ error: 'missing_conversation_id' }, { status: 400 })
  }

  // Verify conversation belongs to this user
  const { error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', user.id)
    .single()

  if (convError) {
    return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
  }

  // Enforce token budget: last N messages only
  const trimmedMessages = messages.slice(-MAX_MESSAGES)

  try {
    const stream = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: trimmedMessages,
      stream: true,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 429) {
      return NextResponse.json(
        { error: 'rate_limit', message: 'Достигнат лимит. Опитай след малко.' },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: 'openai_error', message: 'Нещо се обърка с AI заявката.' },
      { status: 500 }
    )
  }
}
