# AI Chat Assistant Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal AI chat assistant web app with Next.js, Supabase auth + persistence, and streaming OpenAI responses.

**Architecture:** Monolithic Next.js 15 App Router app. Route Handlers keep the OpenAI API key server-side. Supabase handles auth (email/password, cookie sessions via @supabase/ssr) and stores conversations + messages with RLS. Frontend streams responses token-by-token.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Supabase (@supabase/ssr), OpenAI SDK, TailwindCSS 4, shadcn/ui, react-markdown, rehype-highlight, rehype-sanitize

---

## File Map

| File | Responsibility |
|------|---------------|
| `app/layout.tsx` | Root layout with dark theme, font |
| `app/(auth)/login/page.tsx` | Login form (email + password) |
| `app/(auth)/register/page.tsx` | Register form |
| `app/(app)/chat/page.tsx` | Redirect to latest or new conversation |
| `app/(app)/chat/[id]/page.tsx` | Load conversation + messages, render layout |
| `app/api/conversations/route.ts` | POST: create conversation |
| `app/api/messages/route.ts` | POST: save a message, set title on first user msg |
| `app/api/chat/route.ts` | POST: stream OpenAI response |
| `middleware.ts` | Protect `/chat/**`, refresh session cookies |
| `lib/supabase/client.ts` | Browser Supabase client (singleton) |
| `lib/supabase/server.ts` | Server Supabase client (cookie-based) |
| `lib/openai.ts` | OpenAI client singleton |
| `types/chat.ts` | Shared TypeScript types |
| `components/sidebar/Sidebar.tsx` | Conversation list + New Chat button + user info |
| `components/sidebar/ConversationItem.tsx` | Single conversation row (active state, title) |
| `components/chat/ChatWindow.tsx` | Orchestrates message loading + streaming state |
| `components/chat/MessageList.tsx` | Scrollable list, auto-scrolls to bottom |
| `components/chat/MessageBubble.tsx` | Renders one message (markdown + bubble styles) |
| `components/chat/ChatInput.tsx` | Textarea, Enter to send, Shift+Enter newline |

---

## Chunk 1: Project Setup

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.local`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /mnt/c/Users/gorch/Documents/assistant
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

When prompted: use App Router = yes, Turbopack = yes (dev speed).

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr openai react-markdown rehype-highlight rehype-sanitize
npm install -D @types/node
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted: style = Default, base color = Zinc, CSS variables = yes.

- [ ] **Step 4: Add shadcn components**

```bash
npx shadcn@latest add button textarea avatar separator skeleton scroll-area
```

- [ ] **Step 5: Create `.env.local`**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o
EOF
```

Fill in real values from your Supabase project dashboard and OpenAI.

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize Next.js project with Supabase and OpenAI dependencies"
```

---

### Task 2: Configure dark theme and color palette

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts` (if exists) or `app/globals.css` CSS variables

- [ ] **Step 1: Update CSS variables in `app/globals.css`**

Replace the `:root` and `.dark` blocks with:

```css
@layer base {
  :root {
    --background: 240 10% 3.9%;       /* zinc-950 #09090b */
    --foreground: 0 0% 98%;            /* zinc-50  #fafafa */
    --card: 240 5.9% 10%;             /* zinc-900 #18181b */
    --card-foreground: 0 0% 98%;
    --popover: 240 5.9% 10%;
    --popover-foreground: 0 0% 98%;
    --primary: 142.1 76.2% 36.3%;     /* green-600 #16a34a */
    --primary-foreground: 355.7 100% 97.3%;
    --secondary: 240 3.7% 15.9%;      /* zinc-800 #27272a */
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%; /* zinc-400 #a1a1aa */
    --accent: 142.1 70.6% 45.3%;      /* green-500 #22c55e */
    --accent-foreground: 144.9 80.4% 10%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;         /* zinc-800 #27272a */
    --input: 240 3.7% 15.9%;
    --ring: 142.1 76.2% 36.3%;
    --radius: 0.5rem;
  }
}

* {
  @apply border-border;
}

body {
  @apply bg-background text-foreground;
}
```

- [ ] **Step 2: Update `app/layout.tsx` to force dark mode**

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Асистент',
  description: 'Личен AI чат асистент',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="bg" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Verify theme in browser**

```bash
npm run dev
```

Open http://localhost:3000 — background should be near-black (#09090b).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: configure dark theme with zinc/green color palette"
```

---

### Task 3: Set up TypeScript types

**Files:**
- Create: `types/chat.ts`

- [ ] **Step 1: Create types file**

```typescript
// types/chat.ts

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  role: MessageRole
  content: string
}
```

- [ ] **Step 2: Commit**

```bash
git add types/chat.ts
git commit -m "feat: add shared TypeScript types for chat domain"
```

---

## Chunk 2: Supabase Setup

### Task 4: Set up Supabase database schema

**Files:**
- Create: `supabase/migrations/20260311000000_create_chat_tables.sql`

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

- [ ] **Step 2: Create migration file**

```sql
-- supabase/migrations/20260311000000_create_chat_tables.sql

create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  title       text not null default 'Нов разговор',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists messages (
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
  on conversations for all
  using (auth.uid() = user_id);

create policy "Users see messages in own conversations"
  on messages for all
  using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );

-- Index for sidebar queries (list by user, sorted by updated_at)
create index conversations_user_id_updated_at_idx
  on conversations(user_id, updated_at desc);

-- Index for loading messages in a conversation
create index messages_conversation_id_created_at_idx
  on messages(conversation_id, created_at asc);
```

- [ ] **Step 3: Run migration in Supabase dashboard**

Go to your Supabase project → SQL Editor → paste and run the migration file contents.

Verify: Tables `conversations` and `messages` appear in the Table Editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase schema migrations for conversations and messages"
```

---

### Task 5: Set up Supabase client utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies can't be set here; middleware handles refresh
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create OpenAI client**

```typescript
// lib/openai.ts
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o'
```

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add Supabase browser/server clients and OpenAI client"
```

---

### Task 6: Set up auth middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create middleware**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = request.nextUrl.pathname.startsWith('/chat')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/chat/:path*', '/login', '/register'],
}
```

- [ ] **Step 2: Verify middleware compiles**

```bash
npm run build 2>&1 | head -30
```

Expected: no TypeScript errors in middleware.ts.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware protecting /chat routes"
```

---

## Chunk 3: Auth Pages

### Task 7: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login page**

```tsx
// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Грешен имейл или парола.')
      setLoading(false)
      return
    }

    router.push('/chat')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-lg border border-border bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Вход</h1>
          <p className="text-sm text-muted-foreground">Влез в своя AI асистент</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Имейл
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Парола
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-background border-border"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-primary text-accent-foreground font-medium"
          >
            {loading ? 'Влизане...' : 'Влез'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Нямаш акаунт?{' '}
          <a href="/register" className="text-accent hover:underline">
            Регистрирай се
          </a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Input component (shadcn)**

```bash
npx shadcn@latest add input
```

- [ ] **Step 3: Test login page in browser**

```bash
npm run dev
```

Navigate to http://localhost:3000/login — form should render with dark background and green button.

- [ ] **Step 4: Commit**

```bash
git add app/(auth)/login/
git commit -m "feat: add login page with Supabase email/password auth"
```

---

### Task 8: Register page

**Files:**
- Create: `app/(auth)/register/page.tsx`

- [ ] **Step 1: Create register page**

```tsx
// app/(auth)/register/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/chat')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-8 rounded-lg border border-border bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Регистрация</h1>
          <p className="text-sm text-muted-foreground">Създай своя AI асистент</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Имейл
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="password">
              Парола
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
              className="bg-background border-border"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-primary text-accent-foreground font-medium"
          >
            {loading ? 'Регистрация...' : 'Регистрирай се'}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground">
          Вече имаш акаунт?{' '}
          <a href="/login" className="text-accent hover:underline">
            Влез
          </a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(auth)/register/
git commit -m "feat: add register page"
```

---

## Chunk 4: API Routes

### Task 9: POST /api/conversations

**Files:**
- Create: `app/api/conversations/route.ts`

- [ ] **Step 1: Create route handler**

```typescript
// app/api/conversations/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, title: 'Нов разговор' })
    .select('id, title, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'database_error' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
```

- [ ] **Step 2: Test with curl**

```bash
# First get a session token from Supabase dashboard > Authentication > Users
# Then test (replace TOKEN with real session token):
curl -X POST http://localhost:3000/api/conversations \
  -H "Cookie: sb-access-token=TOKEN"
```

Expected: `{"id":"...","title":"Нов разговор","created_at":"..."}` with status 201.

Without auth: Expected: `{"error":"unauthorized"}` with status 401.

- [ ] **Step 3: Commit**

```bash
git add app/api/conversations/
git commit -m "feat: add POST /api/conversations route handler"
```

---

### Task 10: POST /api/messages

**Files:**
- Create: `app/api/messages/route.ts`

- [ ] **Step 1: Create route handler**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/messages/
git commit -m "feat: add POST /api/messages route with title auto-generation"
```

---

### Task 11: POST /api/chat (OpenAI streaming)

**Files:**
- Create: `app/api/chat/route.ts`

- [ ] **Step 1: Create streaming route handler**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/chat/
git commit -m "feat: add POST /api/chat streaming route handler"
```

---

## Chunk 5: Chat UI Components

### Task 12: MessageBubble component

**Files:**
- Create: `components/chat/MessageBubble.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/chat/MessageBubble.tsx
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { Message } from '@/types/chat'
import 'highlight.js/styles/github-dark.css'

interface Props {
  message: Message | { role: 'assistant'; content: string; id: string; streaming?: boolean }
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isStreaming = 'streaming' in message && message.streaming

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser
          ? 'bg-accent text-accent-foreground text-xs'
          : 'bg-secondary text-muted-foreground text-xs'
        }>
          {isUser ? 'Аз' : 'AI'}
        </AvatarFallback>
      </Avatar>

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 bg-secondary text-foreground text-sm">
            {message.content}
          </div>
        ) : (
          <div className="text-foreground text-sm prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              rehypePlugins={[rehypeSanitize, rehypeHighlight]}
            >
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-accent ml-0.5 animate-pulse" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/MessageBubble.tsx
git commit -m "feat: add MessageBubble component with markdown rendering and streaming cursor"
```

---

### Task 13: MessageList component

**Files:**
- Create: `components/chat/MessageList.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/chat/MessageList.tsx
'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageBubble } from './MessageBubble'
import { Skeleton } from '@/components/ui/skeleton'
import type { Message } from '@/types/chat'

interface StreamingMessage {
  id: string
  role: 'assistant'
  content: string
  streaming: boolean
}

interface Props {
  messages: Message[]
  streamingMessage: StreamingMessage | null
  loading: boolean
}

export function MessageList({ messages, streamingMessage, loading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingMessage?.content])

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-16 flex-1 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-6">
        {messages.length === 0 && !streamingMessage && (
          <div className="flex flex-col items-center justify-center h-full pt-20 gap-2">
            <p className="text-2xl font-semibold text-foreground">Здравей!</p>
            <p className="text-sm text-muted-foreground">Как мога да ти помогна?</p>
          </div>
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {streamingMessage && (
          <MessageBubble message={streamingMessage} />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/MessageList.tsx
git commit -m "feat: add MessageList component with auto-scroll and skeleton loading"
```

---

### Task 14: ChatInput component

**Files:**
- Create: `components/chat/ChatInput.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/chat/ChatInput.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ArrowUp } from 'lucide-react'

interface Props {
  onSend: (content: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <div className="border-t border-border p-4">
      <div className="relative flex items-end gap-2 rounded-xl border border-border bg-secondary p-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напиши съобщение... (Enter за изпращане, Shift+Enter за нов ред)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm text-foreground placeholder:text-muted-foreground min-h-[36px] max-h-[200px]"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg bg-accent hover:bg-primary text-accent-foreground"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add lucide-react (if not present)**

```bash
npm install lucide-react
```

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatInput.tsx
git commit -m "feat: add ChatInput component with auto-resize and Enter-to-send"
```

---

### Task 15: ChatWindow component

**Files:**
- Create: `components/chat/ChatWindow.tsx`

- [ ] **Step 1: Create component**

```tsx
// components/chat/ChatWindow.tsx
'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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

    const supabase = createClient()

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
      // Silent retry once — if it fails, show non-blocking warning but still show the message in UI
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, role: 'assistant', content: fullContent }),
      })
      // Still add to UI regardless
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
```

- [ ] **Step 2: Commit**

```bash
git add components/chat/ChatWindow.tsx
git commit -m "feat: add ChatWindow with streaming, error handling, and message persistence"
```

---

## Chunk 6: Sidebar + Pages

### Task 16: Sidebar components

**Files:**
- Create: `components/sidebar/ConversationItem.tsx`
- Create: `components/sidebar/Sidebar.tsx`

- [ ] **Step 1: Create ConversationItem**

```tsx
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
```

- [ ] **Step 2: Create Sidebar**

```tsx
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
            {userEmail[0].toUpperCase()}
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
```

- [ ] **Step 3: Commit**

```bash
git add components/sidebar/
git commit -m "feat: add Sidebar and ConversationItem components"
```

---

### Task 17: Chat pages

**Files:**
- Create: `app/(app)/chat/page.tsx`
- Create: `app/(app)/chat/[id]/page.tsx`
- Modify: `app/page.tsx` (root redirect)

- [ ] **Step 1: Create root redirect**

```tsx
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/chat')
}
```

- [ ] **Step 2: Create /chat page (creates new conversation and redirects)**

```tsx
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
```

- [ ] **Step 3: Create /chat/[id] page**

```tsx
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
```

- [ ] **Step 4: Verify full app in browser**

```bash
npm run dev
```

Test flow:
1. Visit http://localhost:3000 → redirects to /login
2. Register a new account
3. Redirects to /chat → creates first conversation
4. Type a message → user message appears instantly
5. AI response streams in with blinking cursor
6. Response completes and cursor disappears
7. Click "Нов разговор" → new chat created
8. Sidebar shows conversation with auto-generated title

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat: add chat pages, sidebar layout, and root redirect"
```

---

### Task 18: Final polish and build verification

**Files:**
- Modify: `app/layout.tsx` (add highlight.js CSS)

- [ ] **Step 1: Verify production build**

```bash
npm run build
```

Expected: build completes with no errors. Note any warnings but they don't block.

- [ ] **Step 2: Fix any TypeScript errors**

```bash
npx tsc --noEmit
```

Fix any errors before proceeding.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete AI chat assistant v1"
```

---

## Summary

After completing all tasks, the app will have:

- Auth: login + register with Supabase email/password
- Protected routes via Next.js middleware
- Sidebar with conversation list, new chat button, sign out
- Streaming AI responses with blinking cursor
- Markdown rendering with syntax highlighting and XSS sanitization
- Conversation history persisted in Supabase with RLS
- Auto-generated conversation titles from first message
- Dark theme with zinc-950 background and green accent colors
