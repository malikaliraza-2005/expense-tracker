# System Architecture

This document describes the complete system architecture for the Splitwise-style expense tracker: the responsibilities of each tier, how a request flows through the system, and why the boundaries are drawn where they are.

---

## 1. Architectural overview

The system is organized into three responsibility tiers along the request path:

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENT  (browser / installable PWA — runs on user's device)  │
│    • Client Components: forms, dialogs, split editor, search  │
│    • PWA shell: Web App Manifest + Service Worker (optional)  │
│    • Session stored in an httpOnly cookie                     │
└───────────────────────────┬──────────────────────────────────┘
                            │  ① HTTPS: navigation / Server Action
┌───────────────────────────▼──────────────────────────────────┐
│  SERVER  (Next.js 14 App Router — hosted on Vercel)           │
│    • Middleware: guard protected routes, refresh session      │
│    • Server Components: fetch data, render/stream HTML        │
│    • Server Actions: mutations (expenses, groups, settle up)  │
│    • Typed data-access layer + split/balance modules          │
└───────────────────────────┬──────────────────────────────────┘
                            │  ② Supabase client with user JWT
┌───────────────────────────▼──────────────────────────────────┐
│  DATA  (Supabase — managed backend)                           │
│    ┌──────────────── Row Level Security ─────────────────┐    │
│    │  Every query & storage request scoped to auth.uid() │    │
│    └──────────────────────────────────────────────────────┘   │
│    • Supabase Auth (email/password, issues JWT)              │
│    • PostgreSQL (source of truth; balances derived on read)  │
│    • Supabase Storage (avatars, optional receipts)           │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Tier responsibilities

### 2.1 Client (browser / PWA)

| Responsibility | Detail |
|---|---|
| Interactive UI | Client Components handle forms, dialogs, the split editor (equal / exact / percentage), search inputs, and optimistic feedback. |
| Presentation state | Local UI state only (open/closed dialogs, form drafts, validation messages). No business logic or authorization decisions. |
| Session carrier | The Supabase session lives in an httpOnly cookie; the client never holds long-lived tokens in JS. |
| PWA shell (optional) | Web App Manifest + icons + a minimal service worker make the app installable. No offline writes. |

**The client never trusts itself.** All authorization and integrity are enforced on the server and in the database. Client-side validation exists purely for UX.

### 2.2 Server (Next.js on Vercel)

| Responsibility | Detail |
|---|---|
| Route protection | Middleware validates and refreshes the session cookie on each request; redirects unauthenticated users to `/login`. |
| Reads | Server Components fetch data server-side (dashboard, lists, balances) and stream HTML — no client-side data round-trips. |
| Writes | Server Actions perform all mutations (create/edit/delete expense, settle up, manage groups & friends). |
| Business logic | The split module and balance module run on the server; they are the single source of computation for shares and balances. |
| Data access | A typed data-access layer wraps Supabase queries so components/actions never build raw queries inline. |

### 2.3 Data (Supabase)

| Component | Responsibility |
|---|---|
| Auth | Email/password authentication; issues the JWT / session that RLS evaluates. A trigger seeds a `profiles` row on signup. |
| PostgreSQL | The source of truth for all entities. Balances are **not** stored — they are derived from `expense_splits` and `settlements`. |
| Row Level Security | The primary authorization boundary. Every table policy scopes rows to the authenticated user (`auth.uid()`) and their memberships. |
| Storage | Holds avatar images (and optional receipts), guarded by storage policies mirroring table RLS. |

---

## 3. Data flow — request round-trip

A representative write (adding an expense) flows as follows:

1. **Interact.** The user fills the expense form in a Client Component and submits.
2. **Reach the server.** The submission invokes a Server Action running on Vercel.
3. **Authenticate.** Middleware has already validated/refreshed the session cookie; the action reads the user's identity from the SSR Supabase client.
4. **Compute.** The split module converts the amount + split type into exact per-person integer shares (with remainder handling).
5. **Persist atomically.** The expense and its `expense_splits` are written together so they can never diverge.
6. **Enforce.** Supabase Auth verifies the JWT; RLS policies confirm the user may write to the target group/expense.
7. **Return & re-render.** On success the action revalidates affected server-rendered views; the dashboard and balances recompute on the next read and stream back to the browser.

A representative read (dashboard) is simpler: a Server Component calls the data-access layer with the user's JWT → RLS returns only permitted rows → the balance module nets them → HTML is streamed to the client.

---

## 4. Why the boundaries are drawn this way

- **Authorization belongs in the database.** RLS makes the database the final arbiter of access, so a bug in the app layer cannot leak another user's data. This is the strongest available guarantee for a multi-tenant app.
- **Business logic belongs on the server.** Split and balance math running server-side (and in typed modules) keeps it testable, consistent, and impossible to tamper with from the client.
- **Balances are derived, not stored.** Deriving balances from source-of-truth rows eliminates denormalization drift — the ledger is always internally consistent. If read performance ever demands it, the same logic can move into SQL without a schema change.
- **Reads via Server Components, writes via Server Actions.** This uses the App Router's strengths (server rendering, streaming, no client data-fetching boilerplate) while keeping mutations in one auditable place.

---

## 5. Cross-cutting concerns

| Concern | Approach |
|---|---|
| **Authentication** | `@supabase/ssr` cookie-based sessions across middleware, Server Components, and Server Actions. |
| **Authorization** | RLS on every table + storage policies. The app layer adds defense-in-depth checks but never replaces RLS. |
| **Integrity** | Money as integer cents; expense + splits written atomically; splits validated to sum to the total before write. |
| **Consistency** | Balances derived from a single source of truth. |
| **Error handling** | Server Actions return typed results; the UI surfaces actionable messages. |
| **Responsiveness** | Tailwind + shadcn/ui, mobile-first, verified at mobile/tablet/desktop breakpoints. |

---

## 6. Deployment topology

- **Vercel** hosts the Next.js app (Server Components, Server Actions, middleware) and serves the client bundle.
- **Supabase** (managed) provides Postgres, Auth, and Storage.
- Environment variables connect the two; secrets stay server-side. See [deployment.md](./deployment.md).

See also: [database-design.md](./database-design.md) for the data model and [api-design.md](./api-design.md) for the server surface.
