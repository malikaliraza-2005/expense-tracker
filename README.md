# Expense Tracker

A Splitwise-style expense-sharing app built with Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

> **Status:** Phase 0 — Foundation & Environment. A running, deployable skeleton with the design system, Supabase client wiring, and base layouts in place. No features yet.

## Tech stack

- **Framework:** Next.js 14 (App Router, Server Components, Server Actions)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Storage) via `@supabase/ssr`
- **Hosting:** Vercel

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables. Copy the template and fill in your Supabase
   project values (dashboard → Settings → API):

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Scope | Purpose |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | client | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Anon key (RLS-enforced) |
   | `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Full-access key; never exposed |
   | `NEXT_PUBLIC_SITE_URL` | client | Base URL for auth redirects |

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

4. Production build:

   ```bash
   npm run build
   ```

## Project structure

```
src/
├── app/
│   ├── (auth)/      # public route group: login, register
│   ├── (app)/       # protected route group: dashboard, groups, friends, ...
│   └── layout.tsx   # root layout
├── components/
│   ├── ui/          # shadcn/ui primitives
│   └── <feature>/   # feature components
├── constants/       # app constants (currency, routes, ...)
├── lib/
│   ├── supabase/    # server / client / middleware factories
│   └── queries/     # typed data-access layer
├── types/           # shared types
├── utils/           # pure helpers (cn, money, format, date)
└── middleware.ts    # session refresh / route guard
```

See [`docs/`](./docs) for architecture, phased implementation plan, and development guidelines.

## Conventions

- Money is handled as **integer cents** end-to-end — never floats.
- Single currency; friends are registered users only.
- Balances are **derived**, never stored.
