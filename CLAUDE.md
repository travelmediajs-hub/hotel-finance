# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AI Chat Assistant built with Next.js 16 (App Router), Supabase (auth + Postgres), and OpenAI streaming. UI text is in Bulgarian. Dark theme only (zinc/green palette).

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
```

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.

## Architecture

**Route groups** separate concerns: `(auth)` for login/register, `(app)` for chat pages. Root `/` redirects to `/chat`.

**Auth flow:** Supabase cookie-based auth via `@supabase/ssr`. Middleware (`middleware.ts`) protects `/chat/**` routes and redirects authenticated users away from auth pages. Two Supabase client factories: `lib/supabase/server.ts` (server components/API routes, uses cookies) and `lib/supabase/client.ts` (browser).

**Chat streaming:** `POST /api/chat` sends messages to OpenAI and returns a `ReadableStream` (SSE). `ChatWindow` reads chunks with `getReader()` and updates UI token-by-token. Last 20 messages are sent as context. Content limit: 32KB per message.

**API routes:**
- `POST /api/conversations` — create conversation
- `POST /api/messages` — save message, auto-sets conversation title from first user message
- `POST /api/chat` — stream OpenAI response

**Database:** Two tables (`conversations`, `messages`) with RLS policies scoping all queries to the authenticated user. Schema in `supabase/migrations/`. Cascade delete on conversations removes messages.

**Components:** `ChatWindow` is the main orchestrator managing message state and streaming. Sidebar loads conversation list. All chat/sidebar components are client components; page-level data fetching happens in server components (`app/(app)/chat/[id]/page.tsx`).

**UI:** shadcn/ui components in `components/ui/`, configured via `components.json` (style: base-nova). Path alias `@/*` maps to project root. Markdown rendered with `react-markdown` + `rehype-highlight` + `rehype-sanitize`.

## Key Types

`types/chat.ts` defines `Message`, `Conversation`, and `ChatMessage` interfaces shared across client and server.
