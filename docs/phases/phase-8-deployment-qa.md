# Phase 8 — Deployment & QA

> Final phase. Ship to production and verify the whole system on the live URL.

## 1. Phase Overview

**Objective**
Deploy to production and verify the complete system end-to-end.

**Scope**
Production release to Vercel, environment configuration, Supabase production settings, full smoke test, and README.

**Expected outcome**
A deployed, working, production-quality MVP at a public URL, with documentation.

---

## 2. Features / Modules

**Included:** Production release, environment configuration, end-to-end smoke test, project README.

**User flows**
- The full user journey, exercised on the live deployment (register → friends → group → expenses → settle → dashboard).

**Business rules**
- RLS enforced in production; no client secrets; single currency; balances reconcile.

---

## 3. Backend Implementation Plan

**Backend tasks**
- Confirm Supabase production settings: Auth provider, Site/redirect URLs for the deployed domain, RLS in force, Storage policies, seeded `categories`.
- Ensure migrations are applied to the production database.

**Database operations**
- Apply schema migrations to production; verify seed data.

**Server actions / API requirements**
- All existing actions verified against production Supabase.

**Security considerations**
- Verify RLS holds in production (two-account test).
- Confirm service-role key is server-only and absent from the client bundle.

---

## 4. Frontend Implementation Plan

**Pages / components:** none new — verification of existing UI in production.

**UI states:** confirm loading/empty/error states behave in production, not just dev.

**User interactions:** exercise the full journey on the live URL.

---

## 5. Database Changes

None (schema already applied via migrations). This phase ensures production parity with the developed schema.

---

## 6. Files / Modules Expected To Be Created

- `README.md` (root) with live URL + setup instructions.
- Vercel project configuration (env vars) — see [deployment.md](../deployment.md).
- Any production-only config (e.g., `NEXT_PUBLIC_SITE_URL`).

---

## 7. Dependencies

**Previous phases:** everything to be shipped (Phases 0–6; Phase 7 optional).
**Depends on:** a Vercel project and a production Supabase project.

---

## 8. Testing Checklist

**Functional (production smoke test)**
- [ ] Register → dashboard; `profiles` row created.
- [ ] Login persists across refresh; logout blocks protected routes.
- [ ] Add friend; create group; add members.
- [ ] Add expenses with equal/exact/percentage splits.
- [ ] Edit/delete expense; balances update.
- [ ] Record settlement; balances move correctly.
- [ ] Dashboard reconciles with the ledger.
- [ ] Profile edit + avatar upload works.

**Security**
- [ ] Two-account test: no cross-user data visible (RLS in prod).
- [ ] No secrets in client bundle / network responses.

**Edge cases**
- [ ] Error states behave in production.
- [ ] Deep links to protected routes redirect when logged out.

**Acceptance criteria**
- [ ] The complete system works on the live URL; RLS holds; no secrets leaked; README complete.

---

## 9. Demo Checklist

- [ ] Open the live production URL.
- [ ] Complete the full journey end-to-end on the deployment.
- [ ] Show the README with setup + live link.
- [ ] (If shipped) demonstrate PWA install from the live site.
