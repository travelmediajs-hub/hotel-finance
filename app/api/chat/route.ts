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

  const body = await request.json()
  const { messages }: { conversationId: string; messages: ChatMessage[] } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'invalid_messages' }, { status: 400 })
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
