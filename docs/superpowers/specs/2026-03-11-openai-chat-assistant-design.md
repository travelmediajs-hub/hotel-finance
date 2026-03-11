# AI Chat Assistant — Design Spec
**Date:** 2026-03-11
**Status:** Approved

---

## Overview

A personal AI chat assistant web application built with Next.js, Supabase, and OpenAI. Users authenticate, start conversations, and receive streaming AI responses. Conversation history is persisted in Supabase PostgreSQL.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript 5 |
| Auth + DB | Supabase (PostgreSQL + Row-Level Security) |
| AI | OpenAI API (gpt-4o, streaming) |
| Styling | TailwindCSS 4 + shadcn/ui |
| Markdown | react-markdown + rehype-highlight + rehype-sanitize |

---

## Architecture

### Approach
Monolithic Next.js application. Route Handlers handle OpenAI communication server-side (keeping the API key secure). Supabase manages authentication and data persistence.

### Data Flow

1. User clicks "New Chat" → frontend calls `POST /api/conversations` → server creates a conversation record in Supabase and returns the new `conversationId` → frontend navigates to `/chat/[id]`
2. User types a message → `ChatInput` component
3. Frontend immediately saves the user message to Supabase via `POST /api/messages`
4. Frontend sends `POST /api/chat` with `{ conversationId, messages }` (last N messages, see Token Budget)
5. Route Handler validates session, calls OpenAI with streaming enabled
6. Response streams token-by-token back to the browser
7. After stream completes, the assistant message is saved to Supabase via a client call

If the stream is interrupted (network drop, tab close):
- The user message is already saved (step 3)
- On page reload, the conversation loads from Supabase — user message is visible, no orphaned assistant message
- The user can simply send the message again

### Project Structure
```
assistant/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/
│   │   └── chat/
│   │       ├── page.tsx            # Redirects to latest conversation or creates new one
│   │       └── [id]/page.tsx       # Specific conversation view
│   ├── api/
│   │   ├── chat/route.ts           # POST → OpenAI streaming
│   │   ├── conversations/route.ts  # POST → create conversation
│   │   └── messages/route.ts       # POST → save message
│   └── layout.tsx
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx          # Main chat container
│   │   ├── MessageList.tsx         # Scrollable message list
│   │   ├── MessageBubble.tsx       # Single message with Markdown rendering
│   │   └── ChatInput.tsx           # Textarea + send button
│   ├── sidebar/
│   │   ├── Sidebar.tsx             # Conversation list + new chat button
│   │   └── ConversationItem.tsx    # Single conversation row
│   └── ui/                         # shadcn generated components
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   └── server.ts               # Server Supabase client (cookies via @supabase/ssr)
│   └── openai.ts                   # OpenAI client instance
└── types/
    └── chat.ts                     # TypeScript types
```

---

## Database Schema

```sql
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  title       text not null default 'Нов разговор',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz default now()
);

-- Row-Level Security
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "Users see own conversations"
  on conversations for all using (auth.uid() = user_id);

create policy "Users see messages in own conversations"
  on messages for all using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );
```

### Conversation Title
Automatically set to the first 60 characters of the user's first message, trimmed and appended with "..." if truncated. This happens server-side when the first user message is saved (`POST /api/messages`).

---

## API Contracts

### POST `/api/conversations`
**Request:** `{}` (no body needed — user is identified via session)
**Response:** `{ id: string, title: string, created_at: string }`
**Auth:** Reads user from Supabase server client (cookie-based JWT via `@supabase/ssr`). Returns `401` JSON on invalid/expired session.

---

### POST `/api/messages`
**Request:**
```ts
{
  conversationId: string;   // UUID of existing conversation
  role: 'user' | 'assistant';
  content: string;          // max 32,000 characters
}
```
**Response:** `{ id: string, created_at: string }`
**Auth:** Same as above. Validates conversation belongs to authenticated user via RLS.

---

### POST `/api/chat`
**Request:**
```ts
{
  conversationId: string;
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];  // max 20 messages sent (see Token Budget)
}
```
**Response:** `text/event-stream` — raw streamed text tokens from OpenAI.
**On OpenAI 429:** Returns `{ error: 'rate_limit', message: 'Достигнат лимит. Опитай след малко.' }` with status 429.
**On other OpenAI errors:** Returns `{ error: 'openai_error', message: '...' }` with status 500.
**On auth failure:** Returns `{ error: 'unauthorized' }` with status 401 (no redirect — API routes never redirect).

---

## Token Budget

To prevent context overflow and control costs, the frontend sends only the **last 20 messages** from the conversation to `/api/chat`. No summarization in v1 — older messages are simply excluded from the API call but remain visible in the UI.

---

## Authentication

- Supabase Auth with Email/Password
- Session managed via cookies using `@supabase/ssr`
- `middleware.ts` protects all `/chat/**` routes — redirects unauthenticated users to `/login`
- API routes (`/api/**`) return `401 JSON` on invalid session (never redirect)
- All data operations use the authenticated user's JWT (anon key + user session), never the service role key

---

## UI / Design System

### Color Palette
```
Background:   #09090b  (zinc-950)
Surface:      #18181b  (zinc-900)  — cards, sidebar
Border:       #27272a  (zinc-800)
Accent:       #22c55e  (green-500) — buttons, active states
Accent Hover: #16a34a  (green-600)
Text:         #fafafa  (zinc-50)
Muted:        #a1a1aa  (zinc-400)
```

### Layout
```
┌─────────────────────────────────────────────┐
│  ┌──────────┐  ┌───────────────────────────┐│
│  │ Sidebar  │  │       Chat Window         ││
│  │──────────│  │───────────────────────────││
│  │ + Нов    │  │  [Assistant]              ││
│  │          │  │  Здравей! Как мога да     ││
│  │ Разговор │  │  ти помогна?              ││
│  │ 1        │  │                           ││
│  │ Разговор │  │              [Ти]         ││
│  │ 2        │  │      Обясни ми за...      ││
│  │ ...      │  │                           ││
│  │          │  │  [Assistant]              ││
│  │          │  │  ████████ (streaming...)  ││
│  │──────────│  │───────────────────────────││
│  │ [Avatar] │  │ ┌─────────────────────┐   ││
│  │ Username │  │ │ Напиши съобщение... │ ► ││
│  └──────────┘  │ └─────────────────────┘   ││
│                └───────────────────────────┘│
└─────────────────────────────────────────────┘
```

### shadcn Components
- `Button` — green primary for send
- `ScrollArea` — message list scrolling
- `Textarea` — auto-resize input (Enter = send, Shift+Enter = newline)
- `Avatar` — user and assistant icons
- `Separator` — sidebar dividers
- `Skeleton` — loading placeholders while messages load

### Message Display
- **User messages:** right-aligned, zinc-800 bubble
- **Assistant messages:** left-aligned, no bubble background, markdown rendered
- **Streaming:** tokens appear in real time with blinking cursor `▊`
- **Code blocks:** syntax highlighted via rehype-highlight with dark theme
- **Sanitization:** rehype-sanitize applied to all rendered markdown to prevent XSS

### Error States
- **OpenAI 429:** Show toast "Достигнат лимит. Опитай след малко." — no retry button
- **Network failure mid-stream:** Show "Нещо се обърка. Опитай отново." with a **Retry** button that resends the last user message (the user message is already saved; only the API call is retried)
- **Save failure after stream:** Silent retry once; if it fails again, show a non-blocking warning toast

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # Not used in app code; kept for Supabase CLI migrations only
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
```

---

## Out of Scope (v1)

- Multiple AI model selection
- File/image uploads
- Conversation search
- Sharing conversations
- Rate limiting per user (personal use only)
- Mobile app
