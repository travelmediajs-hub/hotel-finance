# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Hotel finance management system built with Next.js 16 (App Router), React 19, Supabase (auth + Postgres), Tailwind v4, shadcn/ui. UI text is in Bulgarian; dates displayed as `dd.mm.yyyy`. Supports dark (zinc/green) and pink themes with a toggle.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
```

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No test framework is configured.

## Architecture

**Route groups** separate concerns: `app/(auth)` for login/register, `app/(finance)` for the protected finance module. Root `/` redirects to `/finance/dashboard`. The `(finance)/layout.tsx` calls `getFinanceUser()` and renders `FinanceSidebar`; unauthenticated visits redirect to `/login`.

**Auth flow:** Supabase cookie-based auth via `@supabase/ssr`. `middleware.ts` protects `/finance/**`, bounces authenticated users away from auth pages, and fast-paths public pages when no `sb-*` cookie is present. Two client factories: `lib/supabase/server.ts` (server components/API routes, uses cookies) and `lib/supabase/client.ts` (browser).

**Roles & RBAC:** Four roles — `ADMIN_CO`, `FINANCE_CO`, `MANAGER`, `DEPT_HEAD` (see `types/finance.ts`). CO roles see all properties; others are scoped via the `user_property_access` table. Fine-grained permissions live in the `permissions` / `roles` / `role_permissions` tables and are checked with `hasPermission()` in `lib/finance/permissions.ts`. **Role simulation:** `ADMIN_CO` can impersonate other roles via `finance_simulate_role` / `finance_simulate_property` cookies — `getFinanceUser()` returns the effective `role` plus the real `realRole`.

**API route pattern** (`app/api/finance/**/route.ts`):
1. `const user = await getFinanceUser()` — 401 if null
2. Role check if mutating (`user.role !== 'ADMIN_CO' && ...`) — 403 if denied
3. For property-scoped reads: `const allowedIds = await getUserPropertyIds(user)`; `null` means "all properties", otherwise filter/check inclusion — 403 if not allowed
4. `schema.safeParse(body)` with a Zod schema from `lib/finance/schemas/` — 400 on validation failure
5. Call `revalidatePath()` after mutations

**Finance domain:** Daily reports, expenses, income, transfers (in-transits, cash collections, money received), banking (accounts, transactions, loans, revolving credits), monthly reports, suppliers, chart of accounts, USALI reports, properties, payroll, admin. Each area has its own route segment under `app/(finance)/finance/` and matching API under `app/api/finance/`.

**Database:** Postgres via Supabase with RLS policies. 30+ migrations in `supabase/migrations/` are numbered chronologically (`YYYYMMDDHHMMSS_*.sql`) — always add new migrations with a later timestamp rather than editing existing ones.

**Components:** Finance feature components in `components/finance/` (co-located, flat). shadcn/ui primitives in `components/ui/`, configured via `components.json` (style: `base-nova`). Path alias `@/*` maps to project root.

**Theming:** `ThemeProvider` in `components/theme-provider.tsx` manages dark/pink theme switching via a `data-theme` class; toggle lives in the sidebar; choice persisted in `localStorage`.

**Cron:** `vercel.json` schedules a daily `4:00 UTC` call to `/api/creato/sync` (Creato PMS reservation sync).

## Key Types

`types/finance.ts` — all finance enums and interfaces (mirrors the DB schema). Import types from here rather than redeclaring.

## Skeleton Reference Docs

`hotel-finance/zadanie_v7.0_aktualno.md` is the authoritative Bulgarian-language spec for the finance system (entities, workflows, business rules). Consult it when the intended behavior of a finance feature is unclear.
