# API Design

This app does not expose a traditional REST API. Its server surface is composed of **Server Actions** (mutations), **Server Components / data-access functions** (reads), and a small number of **Route Handlers** where a real HTTP endpoint is required. This document specifies that surface, the request/response shapes, and the authentication flow.

> Terminology: where other stacks would define `POST /expenses`, this app defines a `createExpense` Server Action. The action *is* the endpoint.

---

## 1. Layers

```
UI (Client/Server Components)
      │  calls
      ▼
Server Actions  ── mutations, "use server"
      │  call
      ▼
Data-access layer  ── lib/queries/*, lib/mutations helpers
      │  uses
      ▼
Supabase SSR client (user JWT)  ──►  Postgres + RLS / Storage
```

- **Server Actions** own validation, authorization checks (defense-in-depth), computation (splits), and revalidation.
- **Data-access layer** wraps Supabase queries in typed functions so no component builds raw queries inline.
- **RLS** is the final authorization gate under everything.

---

## 2. Authentication flow

1. **Register** → `signUp(email, password)` creates an `auth.users` row; a DB trigger creates the `profiles` row.
2. **Login** → `signIn(email, password)` sets the session cookie (httpOnly) via `@supabase/ssr`.
3. **Session** → Middleware refreshes the cookie on each request; Server Components/Actions read the user from the SSR client.
4. **Protected routes** → Middleware redirects unauthenticated requests to `/login`; authenticated requests away from auth pages.
5. **Logout** → `signOut()` clears the session cookie.

All authenticated Supabase calls carry the user's JWT, which RLS evaluates.

---

## 3. Conventions

- **Result shape:** actions return a discriminated result:
  ```
  { ok: true, data?: T } | { ok: false, error: { code: string, message: string, fields?: Record<string,string> } }
  ```
- **Validation:** inputs validated on the server (shape, ranges, split-sum invariants) before any write; client-side validation is UX-only.
- **Revalidation:** mutating actions revalidate affected paths/tags so Server Components re-render with fresh data.
- **Money:** all amounts crossing the boundary are integer **cents**.
- **Authorization:** every action re-checks the caller's relationship to the resource, in addition to RLS.

---

## 4. Server Actions (mutations)

### 4.1 Authentication
| Action | Input | Output | Notes |
|---|---|---|---|
| `signUp` | `{ email, password }` | `Result<void>` | Trigger creates profile |
| `signIn` | `{ email, password }` | `Result<void>` | Sets session cookie |
| `signOut` | — | `Result<void>` | Clears session |

### 4.2 Profile
| Action | Input | Output |
|---|---|---|
| `updateProfile` | `{ full_name?, preferred_currency? }` | `Result<Profile>` |
| `uploadAvatar` | `{ file }` | `Result<{ avatar_url }>` |

### 4.3 Friends
| Action | Input | Output |
|---|---|---|
| `addFriend` | `{ email }` | `Result<Friend>` — errors if no account |
| `removeFriend` | `{ friendId }` | `Result<void>` |

### 4.4 Groups
| Action | Input | Output |
|---|---|---|
| `createGroup` | `{ name, type, memberIds? }` | `Result<Group>` |
| `updateGroup` | `{ groupId, name?, type? }` | `Result<Group>` |
| `deleteGroup` | `{ groupId }` | `Result<void>` — blocked if expenses exist |
| `addGroupMember` | `{ groupId, userId }` | `Result<void>` |
| `removeGroupMember` | `{ groupId, userId }` | `Result<void>` |

### 4.5 Expenses
| Action | Input | Output |
|---|---|---|
| `createExpense` | `{ groupId?, title, description?, amountCents, categoryId, expenseDate, paidBy, notes?, split: SplitInput }` | `Result<Expense>` |
| `updateExpense` | `{ expenseId, ...editableFields, split? }` | `Result<Expense>` |
| `deleteExpense` | `{ expenseId }` | `Result<void>` |

`SplitInput` (discriminated by type):
```
{ type: 'equal',      participantIds: string[] }
{ type: 'exact',      shares: { userId: string, amountCents: number }[] }   // must sum to amountCents
{ type: 'percentage', shares: { userId: string, percent: number }[] }        // must sum to 100
```
The server converts `SplitInput` → concrete `expense_splits` rows via `lib/splits`, then writes expense + splits atomically.

### 4.6 Settlements
| Action | Input | Output |
|---|---|---|
| `recordSettlement` | `{ groupId?, payerId, receiverId, amountCents, note? }` | `Result<Settlement>` |

---

## 5. Data-access (reads)

Read functions live in `lib/queries/*` and are called from Server Components. They return typed rows and never expose the raw Supabase client to the UI.

| Function | Returns |
|---|---|
| `getCurrentProfile()` | `Profile` |
| `getDashboard()` | `{ totalBalance, youOwe, youAreOwed, net, recentExpenses, groupsOverview }` |
| `getFriends()` | `FriendWithBalance[]` |
| `getFriendBalance(friendId)` | `{ friend, net, breakdown }` |
| `getGroups()` | `GroupWithBalance[]` |
| `getGroup(groupId)` | `{ group, members, summary }` |
| `getGroupLedger(groupId)` | `{ balances: { from, to, amountCents }[] }` |
| `listExpenses(filter)` | `Expense[]` (sort/filter by date, category, member, amount) |
| `getExpense(expenseId)` | `ExpenseDetail` (with splits) |
| `searchFriends(query)` | `Profile[]` |
| `searchGroups(query)` | `Group[]` |

All reads are RLS-scoped: the same function returns only what the caller may see.

---

## 6. Route Handlers (only where needed)

Most flows use Actions/Components. Route Handlers are reserved for cases that need a true HTTP endpoint:

| Handler | Purpose |
|---|---|
| Auth callback (if using confirmation links) | Exchange auth code → session |
| `manifest` / service worker (Phase 7) | Served as static assets, not dynamic handlers |

No public/unauthenticated data endpoints exist.

---

## 7. Error handling & status semantics

| Situation | Action result |
|---|---|
| Invalid input | `{ ok: false, error: { code: 'validation', fields } }` |
| Not authenticated | Redirect (middleware) / `{ code: 'unauthenticated' }` |
| Not authorized for resource | `{ code: 'forbidden' }` (RLS also blocks) |
| Split does not sum correctly | `{ code: 'split_invalid' }` |
| Not found / RLS-hidden | `{ code: 'not_found' }` |

The UI maps these to inline field errors or toasts with actionable messages.

---

## 8. Security considerations

- **Never trust the client.** All validation and authorization repeat on the server; RLS is the backstop.
- **Service-role key stays server-only** and is not used for user requests (user JWT + RLS is the norm).
- **Atomic writes** for expense + splits prevent partial/inconsistent state.
- **Idempotency-conscious** mutations where relevant (e.g., avoid duplicate friend links via unique constraints).

Cross-references: [architecture.md](./architecture.md), [database-design.md](./database-design.md), and per-phase files for exactly which actions land when.
