# Development Guidelines

Coding standards, naming conventions, Git workflow, and project rules. These apply across all phases to keep the codebase consistent and reviewable.

---

## 1. Language & framework rules

- **TypeScript strict mode** on. No implicit `any`; prefer precise types over `any`/`unknown` escape hatches.
- **App Router conventions:** Server Components by default; add `"use client"` only where interactivity requires it.
- **Server Actions** (`"use server"`) for all mutations; no mutation logic in client components.
- **Reads via Server Components** calling the typed data-access layer (`lib/queries/*`).
- **No raw Supabase queries in components** — always go through the data-access layer.
- **Money is always integer cents** end-to-end; never use floats for amounts.

---

## 2. Project structure (target)

```
src/
├── app/
│   ├── (auth)/            # public: login, register
│   ├── (app)/             # protected: dashboard, groups, friends, ...
│   └── layout.tsx
├── components/
│   ├── ui/                # shadcn/ui primitives
│   └── <feature>/         # feature components
├── lib/
│   ├── supabase/          # server/client/middleware factories
│   ├── queries/           # typed reads
│   ├── actions/           # server actions (or colocated)
│   ├── splits.ts          # split math
│   └── balances.ts        # balance math
├── types/                 # shared types
└── middleware.ts
```

> Note: the folder structure is created during implementation (Phase 0+), not as part of documentation.

---

## 3. Naming conventions

| Item | Convention | Example |
|---|---|---|
| Components | PascalCase | `ExpenseForm`, `GroupCard` |
| Files (components) | PascalCase or kebab per project choice; be consistent | `expense-form.tsx` |
| Functions/vars | camelCase | `createExpense`, `youAreOwed` |
| Server Actions | verbNoun, camelCase | `updateProfile`, `recordSettlement` |
| Data-access reads | `get*` / `list*` / `search*` | `getDashboard`, `listExpenses` |
| DB tables/columns | snake_case, plural tables | `expense_splits`, `amount_cents` |
| Enums (DB) | snake_case type, lowercase values | `split_type`: `equal` |
| Types/interfaces | PascalCase | `ExpenseDetail`, `SplitInput` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_CURRENCY` |

---

## 4. Component & UI standards

- Build on **shadcn/ui** primitives; do not hand-roll accessible components that already exist.
- **Mobile-first** Tailwind; verify at mobile/tablet/desktop.
- Every list/loading/empty/error state is designed — no dead-end blank screens.
- Forms: server-validated; show inline field errors and a toast on action failure.
- Accessibility: labelled inputs, visible focus, adequate touch targets, semantic markup.

---

## 5. Data & security rules

- **RLS is mandatory** on every table; never rely on the app layer alone for authorization.
- **Re-check authorization in Server Actions** (defense in depth) in addition to RLS.
- **Service-role key is server-only**; user requests use the user JWT.
- **Validate on the server** before writes; treat client input as untrusted.
- **Atomic writes** where multiple rows must stay consistent (expense + splits).
- **No secrets in client code** or committed to Git.

---

## 6. Error handling

- Server Actions return a typed result (`{ ok, data | error }`), never throw across the boundary for expected failures.
- Error messages are actionable and user-facing ("Percentages must add up to 100%"), not raw exceptions.
- Log unexpected errors server-side; show a generic message to users.

---

## 7. Git workflow

- **Branching:** short-lived feature branches per phase/feature (e.g., `phase-2/schema-rls`, `feat/expense-form`). Never commit directly to `main` for substantial work.
- **Commits:** small, focused, imperative mood ("Add expense split module"). Reference the phase where useful.
- **Pull requests:** one per feature/phase slice; describe what changed and how it was verified.
- **`main` stays deployable:** every merge should build (`next build` passes).
- **Secrets:** `.env.local` is git-ignored; never commit keys.

Commit message convention (suggested):
```
<type>: <summary>

type ∈ feat | fix | chore | docs | refactor | test
```

---

## 8. Definition of Done (per feature)

A feature is done when:
1. It works end-to-end against Supabase with RLS enabled.
2. Server-side validation and authorization are in place.
3. UI covers loading/empty/error states and is responsive.
4. Relevant balance/split logic is verified (unit-style or manual).
5. `next build` passes and the feature is demoable.

---

## 9. Project rules (guardrails)

- **Single currency** across the app; do not introduce FX logic.
- **Friends are registered users only**; do not add placeholder-user modeling.
- **Balances are derived**, never stored; do not add denormalized balance columns.
- **Keep balance logic in TypeScript** for the MVP; the only justified SQL function is the atomic expense+splits write.
- **Stay within MVP scope** (Phases 0–5) before optional work (6–8). Out-of-scope items (notifications, activity feed, offline sync) are not added.

---

## 10. Testing posture

Per project scope, no extensive automated suite is required. Prioritize:
- Unit-style tests for `lib/splits` and `lib/balances`.
- Manual functional + two-user RLS checks each phase.
- End-to-end smoke test before/at deployment.

See [implementation-plan.md](./implementation-plan.md) §7 and each phase's Testing Checklist.
