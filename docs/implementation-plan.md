# Implementation Plan (Phase 0–8)

Summary of the phased roadmap, the dependency graph between phases, and the MVP boundary. Each phase has a dedicated file under [`phases/`](./phases) with full detail; this document is the execution index.

---

## 1. Approach

- **Vertical slices, backend-first per feature.** Each phase ships end-to-end (DB → data layer → UI) so the app is demoable at every checkpoint.
- **Correctness first.** Auth and the schema+RLS+balance engine are hard gates before feature work.
- **MVP over completeness.** Deliver a polished, fully functional core (Phases 0–5); add polish, optional PWA, and deploy after (Phases 6–8).
- **Continuous build checks.** Run a production build at the end of each phase to avoid a late deployment surprise, even though deploy is Phase 8.

---

## 2. Phase index

| Phase | Name | Objective | MVP |
|---|---|---|---|
| 0 | [Foundation & Environment](./phases/phase-0-foundation.md) | Running, deployable skeleton | ✅ |
| 1 | [Authentication & Session](./phases/phase-1-authentication.md) | Secure auth, protected routes, persistence | ✅ (gate) |
| 2 | [Database, RLS & Balance Engine](./phases/phase-2-database-rls-balance-engine.md) | Schema + RLS + verified split/balance math | ✅ (gate) |
| 3 | [Friends & Groups](./phases/phase-3-friends-groups.md) | Social graph: friends + groups | ✅ |
| 4 | [Expenses & Splitting](./phases/phase-4-expenses-splitting.md) | Full expense lifecycle + 3 split types | ✅ (core) |
| 5 | [Dashboard & Settlements](./phases/phase-5-dashboard-settlements.md) | Overview, balances, settle up | ✅ (MVP complete) |
| 6 | [Profile, Search & Polish](./phases/phase-6-profile-search-polish.md) | Profile, search, responsive; optional filters/dark mode | — |
| 7 | [PWA](./phases/phase-7-pwa.md) | Basic installability | — (optional) |
| 8 | [Deployment & QA](./phases/phase-8-deployment-qa.md) | Ship to production + verify | — |

---

## 3. MVP boundary

**Phases 0–5 constitute the MVP** — a fully functional expense-sharing app: authentication, groups, friends, split expenses (equal/exact/percentage), live balances, and settlements, all behind RLS.

**Phases 6–8 are graduated enhancement:** they elevate and ship the MVP but are not prerequisites for core functionality. If time runs short, the product still works after Phase 5.

---

## 4. Dependency graph

```
Phase 0 (foundation)
   └─► Phase 1 (auth) ──gate──►
         └─► Phase 2 (schema + RLS + balance engine) ──gate──►
               ├─► Phase 3 (friends & groups)
               │       └─► Phase 4 (expenses & splitting)
               │               └─► Phase 5 (dashboard & settlements)  ◄── MVP complete
               │                       └─► Phase 6 (profile, search, polish)
               │                               ├─► Phase 7 (PWA, optional)
               │                               └─► Phase 8 (deploy & QA)
```

| Phase | Depends on | Why |
|---|---|---|
| 1 | 0 | Needs Supabase clients + layout |
| 2 | 1 | RLS references `auth.uid()`; needs `profiles` |
| 3 | 2 | Uses tables, RLS, balance module |
| 4 | 2, 3 | Splits against groups/friends; uses the engine |
| 5 | 4 | Dashboard visualizes expense-driven balances |
| 6 | 1–5 | Polishes existing profile/entities/lists |
| 7 | 0–6 | Needs a stable app shell |
| 8 | 0–6 (7 optional) | Ships the complete system |

---

## 5. Why this order

- **Security and correctness are foundations, not features.** Bugs in auth (1) or schema/RLS/math (2) are silent and systemic — they are built and verified first.
- **Each phase is a hard dependency of the next**, following the actual data-flow: people → expenses → balances → overview.
- **Dashboard follows expenses** because it only visualizes data the engine already produces.
- **Polish, then optional, then deploy** — enhancements build on a working core; deployment verifies the whole system at once.

---

## 6. Gates (do-not-proceed conditions)

| After phase | Must pass before continuing |
|---|---|
| 1 | Register/login/logout work; session persists; protected routes enforced; first RLS check (no cross-user profile read) |
| 2 | All three split types sum exactly to total (incl. remainders); balances reconcile after a settlement; two-user RLS blocks cross-user access |
| 4 | Add/edit/delete expense keeps balances correct; atomic expense+splits write |

---

## 7. Testing posture

Per the project scope, **no extensive automated test suite** is required. Testing is targeted:
- Unit-style checks for the split and balance modules (the highest-risk logic).
- Manual functional + security (RLS, two-user) checks per phase.
- A full end-to-end smoke test at deployment.

See each phase's Testing Checklist and [development-guidelines.md](./development-guidelines.md).

---

## 8. Risks & mitigations (roadmap-level)

| Risk | Mitigation |
|---|---|
| Split/balance math bugs | Build & verify engine in Phase 2 before UI; integer money; explicit remainder rule |
| RLS misconfiguration | Policies written with tables in Phase 2; two-user tests each phase |
| Session/SSR pitfalls | Official `@supabase/ssr` patterns; validate persistence in Phase 1 |
| Scope creep | Optional items (filters, dark mode, PWA) time-gated behind the MVP |
| Late deploy surprise | Run production build each phase; deploy infra prepared early |
