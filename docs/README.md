# Splitwise-style Expense Tracker — Project Documentation

A production-quality MVP for splitting shared expenses between friends and groups, tracking balances, and settling debts. Built with Next.js 14, Supabase, and Vercel.

> **Status:** Documentation / pre-implementation. No application code has been written yet.

---

## Product summary

The application lets a registered user:

- Manage **friends** (registered users only) and **groups** (Trip, Home, Friends, Couple, Office, Other).
- Record **expenses** and split them **equally**, by **exact amounts**, or by **percentage**.
- See live **balances** — who owes whom — per friend, per group, and overall.
- **Settle up** by recording payments that update balances automatically.
- View a **dashboard** with total balance, you owe / you are owed, net balance, recent expenses, and a groups overview.

### Scope decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Currency | **Single currency** (per-profile preferred currency; every expense uses it) | Removes a whole class of FX/rounding bugs; `currency` columns retained for forward-compatibility |
| Friends | **Registered users only** | Keeps all foreign keys real and RLS clean |
| Balances | **Derived on read** (not stored) | Always correct; no denormalized balance drift |
| Money | **Integer minor units** (`amount_cents`) | Exact arithmetic; explicit remainder handling |

### Explicitly out of scope (this version)

Notifications, activity feed, offline sync engine, offline write queue / IndexedDB sync, background sync, conflict resolution, PowerSync, event sourcing, advanced CI/CD, extensive automated test suites.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Backend | Supabase — PostgreSQL, Auth, Storage, Row Level Security |
| Data access | Server Components (reads), Server Actions (mutations), typed data-access layer |
| Hosting | Vercel |

---

## Documentation map

| Document | Purpose |
|---|---|
| [architecture.md](./architecture.md) | System architecture, responsibilities, data flow |
| [database-design.md](./database-design.md) | ERD explanation, tables, relationships, constraints, RLS strategy |
| [api-design.md](./api-design.md) | Server Actions, data-access layer, request/response shapes, auth flow |
| [feature-specifications.md](./feature-specifications.md) | Detailed specification of every feature |
| [implementation-plan.md](./implementation-plan.md) | Phase 0–8 roadmap summary, dependencies, MVP boundary |
| [development-guidelines.md](./development-guidelines.md) | Coding standards, naming, Git workflow, project rules |
| [deployment.md](./deployment.md) | Production deployment steps, env vars, Supabase & Vercel checklist |

### Phase documentation

Each implementation phase has a dedicated file under [`phases/`](./phases):

| Phase | Document | MVP? |
|---|---|---|
| 0 | [Foundation & Environment](./phases/phase-0-foundation.md) | ✅ |
| 1 | [Authentication & Session](./phases/phase-1-authentication.md) | ✅ |
| 2 | [Database, RLS & Balance Engine](./phases/phase-2-database-rls-balance-engine.md) | ✅ |
| 3 | [Friends & Groups](./phases/phase-3-friends-groups.md) | ✅ |
| 4 | [Expenses & Splitting](./phases/phase-4-expenses-splitting.md) | ✅ |
| 5 | [Dashboard & Settlements](./phases/phase-5-dashboard-settlements.md) | ✅ |
| 6 | [Profile, Search & Polish](./phases/phase-6-profile-search-polish.md) | — |
| 7 | [PWA](./phases/phase-7-pwa.md) | — |
| 8 | [Deployment & QA](./phases/phase-8-deployment-qa.md) | — |

**MVP boundary:** Phases 0–5 deliver a fully functional product. Phases 6–8 add polish, optional PWA, and production deployment.

---

## Database entities at a glance

`profiles` · `friendships` · `groups` · `group_members` · `expenses` · `expense_splits` · `settlements` · `categories`

See [database-design.md](./database-design.md) for the full ERD and relationships.

---

## How to read this documentation

1. Start with [architecture.md](./architecture.md) for the big picture.
2. Read [database-design.md](./database-design.md) and [api-design.md](./api-design.md) to understand the data and the server surface.
3. Use [implementation-plan.md](./implementation-plan.md) as the execution index, then follow each phase file in order.
4. [development-guidelines.md](./development-guidelines.md) and [deployment.md](./deployment.md) apply throughout.
