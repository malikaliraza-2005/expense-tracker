# Phase 0 — Foundation & Environment

## 1. Phase Overview

**Objective**
Stand up a running, deployable Next.js + Supabase skeleton with the design system in place, so every later phase builds on stable rails.

**Scope**
Project scaffolding, Supabase client wiring, base layout/theme, shadcn/ui baseline, environment configuration. No features, no schema.

**Expected outcome**
An app that boots locally, builds for production, and is connected to Supabase, with a clean, conventional project structure.

---

## 2. Features / Modules

**Included:** app shell, root layout, theme tokens, shadcn/ui primitives, Supabase client factories, environment contract.

**User flows:** none user-facing yet (a blank authenticated-style shell renders).

**Business rules:**
- Single-currency and registered-friends decisions are baked into config/types from the start.
- Money handled as integer cents by convention (types/utilities established).

---

## 3. Backend Implementation Plan

**Backend tasks**
- Create the Supabase project; capture URL + anon key + service-role key.
- Configure `@supabase/ssr` client factories: browser client, server client, middleware client.
- Define the environment-variable contract.

**Database operations:** none.

**Server actions / API requirements:** none — only client factories in `lib/supabase/*`.

**Security considerations**
- Service-role key stored server-only.
- `.env.local` git-ignored; no secrets committed.

---

## 4. Frontend Implementation Plan

**Pages / components**
- Root layout with fonts, color tokens, global toaster/container.
- shadcn/ui baseline components installed (button, input, card, dialog, dropdown, toast).
- A placeholder home/shell route.

**UI states:** base loading/skeleton and toaster wiring available for later phases.

**User interactions:** none beyond navigating the shell.

---

## 5. Database Changes

None. (Schema is introduced in Phase 2; `profiles` + trigger arrive in Phase 1.)

---

## 6. Files / Modules Expected To Be Created

- `package.json`, Next.js config, Tailwind config, `tsconfig.json`.
- `src/app/layout.tsx`, base global styles.
- `src/lib/supabase/{client,server,middleware}.ts` (factories).
- `src/components/ui/*` (shadcn primitives).
- `src/types/` scaffolding; `src/lib/constants.ts` (e.g., `DEFAULT_CURRENCY`).
- `.env.local` (local, git-ignored) + documented env contract.

---

## 7. Dependencies

**Previous phases:** none (root phase).
**Depends on:** a Supabase project and (later) a Vercel project.

---

## 8. Testing Checklist

**Functional**
- [ ] `next dev` runs; shell renders.
- [ ] `next build` succeeds.
- [ ] Server-side Supabase connectivity smoke check passes.

**Security**
- [ ] No secrets in client bundle; `.env.local` ignored by Git.

**Edge cases**
- [ ] Missing env vars fail fast with a clear message.

**Acceptance criteria**
- [ ] App boots and builds; Supabase reachable from a server context; structure follows [development-guidelines.md](../development-guidelines.md).

---

## 9. Demo Checklist

- [ ] App starts locally and shows the base shell.
- [ ] Production build completes without errors.
- [ ] Supabase connection verified.
