# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hotel finance management system built with Next.js 16 (App Router), Supabase (auth + Postgres). UI text is in Bulgarian. Supports dark (zinc/green) and pink themes with a toggle.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
```

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Architecture

**Route groups** separate concerns: `(auth)` for login/register, `(finance)` for the finance module. Root `/` redirects to `/finance/dashboard`.

**Auth flow:** Supabase cookie-based auth via `@supabase/ssr`. Middleware (`middleware.ts`) protects `/finance/**` routes and redirects authenticated users away from auth pages. Two Supabase client factories: `lib/supabase/server.ts` (server components/API routes, uses cookies) and `lib/supabase/client.ts` (browser).

**Finance module:** Daily reports, expenses, income, transfers, banking, monthly reports, suppliers, chart of accounts, USALI reports, and property management. Role-based access: ADMIN_CO, FINANCE_CO, MANAGER, DEPT_HEAD.

**Database:** Finance tables with RLS policies scoping queries to authenticated users. Schema in `supabase/migrations/`.

**Components:** Finance components in `components/finance/`. shadcn/ui components in `components/ui/`, configured via `components.json` (style: base-nova). Path alias `@/*` maps to project root.

**Theming:** `ThemeProvider` in `components/theme-provider.tsx` manages dark/pink theme switching. Toggle in sidebar. Choice persisted in localStorage.

## Key Types

`types/finance.ts` defines finance-related interfaces and types.
