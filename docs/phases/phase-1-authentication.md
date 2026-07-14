# Phase 1 — Authentication & Session

> **Gate phase.** Everything downstream depends on secure auth. Do not proceed until all acceptance criteria pass.

## 1. Phase Overview

**Objective**
Users can register, log in, log out, stay signed in across refreshes, and are blocked from protected areas when signed out.

**Scope**
Email/password auth, session persistence via cookies, protected route middleware, and the `profiles` table + signup trigger (the first schema piece, required for auth to be useful).

**Expected outcome**
A locked-down app with real accounts, persistent sessions, and enforced route protection.

---

## 2. Features / Modules

**Included:** Register, Login, Logout, Protected Routes, Session Persistence.

**User flows**
- **Register:** enter email/password → account created → `profiles` row auto-created → signed in → dashboard.
- **Login:** enter credentials → session cookie set → dashboard.
- **Logout:** clear session → public page; protected routes now inaccessible.
- **Protected access:** unauthenticated user hits an app route → redirected to `/login`.

**Business rules**
- Unique email; password meets Supabase minimum.
- Session stored in httpOnly cookie; no long-lived tokens in client JS.

---

## 3. Backend Implementation Plan

**Backend tasks**
- Enable Supabase email/password auth.
- Create `profiles` table; add trigger to insert a `profiles` row on new `auth.users`.
- Middleware: validate + refresh session cookie each request; redirect logic for protected vs auth routes.

**Database operations**
- Insert into `profiles` via trigger on signup.
- Read/update own `profiles` row.

**Server actions / API requirements**
- `signUp(email, password)`, `signIn(email, password)`, `signOut()`.
- Auth callback route only if email-confirmation links are enabled.

**Security considerations**
- RLS on `profiles`: user can read/update only their own row.
- Middleware guards the protected route group.
- Errors do not leak whether an email exists (generic messaging where appropriate).

---

## 4. Frontend Implementation Plan

**Pages / components**
- `(auth)` layout with Login and Register pages/forms.
- `(app)` protected layout with auth-aware navigation and a logout control.

**UI states**
- Form: idle, submitting, field-level errors, server error toast, success redirect.

**User interactions**
- Submit register/login; logout; automatic redirects.

---

## 5. Database Changes

**Tables affected:** `profiles` (created this phase).

**Schema changes**
- `profiles(id PK → auth.users, full_name, avatar_url, preferred_currency, created_at)`.

**RLS policies**
- Select/update: `auth.uid() = id`.

**Indexes / triggers**
- Trigger on `auth.users` insert → create `profiles` row with default currency.

See [database-design.md](../database-design.md) §2.1, §7, §8.

---

## 6. Files / Modules Expected To Be Created

- `src/middleware.ts` (route protection + session refresh).
- `src/app/(auth)/login/`, `src/app/(auth)/register/` (pages + forms).
- `src/app/(app)/layout.tsx` (protected layout).
- `src/lib/actions/auth.ts` — `signUp`, `signIn`, `signOut`.
- SQL migration: `profiles` table + RLS + signup trigger.

---

## 7. Dependencies

**Previous phases:** Phase 0 (Supabase clients, layout).
**Depends on:** `@supabase/ssr` factories; base UI components.

---

## 8. Testing Checklist

**Functional**
- [ ] Register creates an account and a matching `profiles` row.
- [ ] Login sets a session; dashboard reachable.
- [ ] Session persists across a hard refresh.
- [ ] Logout clears session.

**Security**
- [ ] Direct URL to a protected route while signed out → redirect to `/login`.
- [ ] Authenticated user redirected away from auth pages.
- [ ] Two-account check: user A cannot read user B's `profiles` row (first RLS validation).

**Edge cases**
- [ ] Duplicate email registration handled gracefully.
- [ ] Wrong password shows an inline error.
- [ ] Expired/absent session behaves as unauthenticated.

**Acceptance criteria**
- [ ] All auth flows work; sessions persist; protected routes enforced; RLS blocks cross-user profile reads.

---

## 9. Demo Checklist

- [ ] Register → land on dashboard.
- [ ] Refresh → still signed in.
- [ ] Log out → protected routes redirect to login.
- [ ] Attempt to open a protected URL while logged out → redirected.
