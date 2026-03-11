// components/chat/ChatWindow.tsx
'use client'

import { useState, useCallback } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import type { Message, ChatMessage } from '@/types/chat'

interface Props {
  initialMessages: Message[]
  conversationId: string
}

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  streaming: boolean
}

export function ChatWindow({ initialMessages, conversationId }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    setSending(true)
    setError(null)

    // Step 1: Save user message to Supabase immediately
    const saveRes = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, role: 'user', content }),
    })

    if (!saveRes.ok) {
      setError('Нещо се обърка. Опитай отново.')
      setSending(false)
      return
    }

    const savedMsg = await saveRes.json()
    const userMessage: Message = {
      id: savedMsg.id,
      conversation_id: conversationId,
      role: 'user',
      content,
      created_at: savedMsg.created_at,
    }

    setMessages(prev => [...prev, userMessage])

    // Step 2: Build history for OpenAI (last 20 messages)
    const allMessages = [...messages, userMessage]
    const chatHistory: ChatMessage[] = allMessages
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }))

    // Step 3: Start streaming
    const streamingId = crypto.randomUUID()
    setStreamingMessage({ id: streamingId, role: 'assistant', content: '', streaming: true })

    let fullContent = ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, messages: chatHistory }),
      })

      if (!res.ok) {
        const err = await res.json()
        if (res.status === 429) {
          setError('Достигнат лимит. Опитай след малко.')
        } else {
          setError('Нещо се обърка. Опитай отново.')
        }
        // suppress unused variable warning
        void err
        setStreamingMessage(null)
        setSending(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        fullContent += text
        setStreamingMessage(prev => prev ? { ...prev, content: fullContent } : null)
      }
    } catch {
      setError('Нещо се обърка. Опитай отново.')
      setStreamingMessage(null)
      setSending(false)
      return
    }

    // Step 4: Save assistant message
    setStreamingMessage(null)

    const assistantSaveRes = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, role: 'assistant', content: fullContent }),
    })

    if (assistantSaveRes.ok) {
      const saved = await assistantSaveRes.json()
      const assistantMessage: Message = {
        id: saved.id,
        conversation_id: conversationId,
        role: 'assistant',
        content: fullContent,
        created_at: saved.created_at,
      }
      setMessages(prev => [...prev, assistantMessage])
    } else {
      // Silent retry once — if it fails, still show the message in UI
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, role: 'assistant', content: fullContent }),
      })
      setMessages(prev => [...prev, {
        id: streamingId,
        conversation_id: conversationId,
        role: 'assistant',
        content: fullContent,
        created_at: new Date().toISOString(),
      }])
    }

    setSending(false)
  }, [messages, conversationId])

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        streamingMessage={streamingMessage}
        loading={false}
      />

      {error && (
        <div className="px-4 pb-2">
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      <ChatInput onSend={sendMessage} disabled={sending} />
    </div>
  )
}
