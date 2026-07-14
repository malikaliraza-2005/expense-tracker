# Deployment

Production deployment steps, required environment variables, Supabase configuration, and the Vercel deployment checklist. This corresponds to [Phase 8](./phases/phase-8-deployment-qa.md).

---

## 1. Deployment topology

- **Vercel** hosts the Next.js app (Server Components, Server Actions, middleware) and serves the client bundle.
- **Supabase** (managed) provides PostgreSQL, Auth, and Storage.
- Environment variables connect the two. Secrets remain server-side.

> Deployment infrastructure (Supabase project, Vercel project) is prepared early, but the **production release and full verification happen in Phase 8**. A production build (`next build`) is run at the end of each phase to catch build issues continuously.

---

## 2. Environment variables

| Variable | Where | Purpose | Secret? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL | No (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Anon key (used with RLS) | No (public, but RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Elevated key for admin/maintenance tasks (not used for user requests) | **Yes** |
| `NEXT_PUBLIC_SITE_URL` | Client + Server | Canonical site URL (redirects, auth callbacks) | No |

Rules:
- `.env.local` for local development (git-ignored).
- Configure the same variables in Vercel Project Settings → Environment Variables for Production (and Preview).
- **Never** expose the service-role key to the client or commit any key.

---

## 3. Supabase configuration checklist

- [ ] Project created; region chosen.
- [ ] **Auth:** email/password provider enabled; confirmation settings decided (auto-confirm for MVP simplicity, or email confirmation with a callback route).
- [ ] **Redirect / Site URL:** set to the deployed domain (and localhost for dev) in Auth settings.
- [ ] **Schema applied:** all tables, enums, indexes, and the signup trigger migrated.
- [ ] **RLS enabled** on every table with policies in place (verify none are left open).
- [ ] **Storage:** avatar bucket created with access policies mirroring table RLS.
- [ ] **Seed data:** `categories` seeded (Food, Transport, Shopping, Bills, Entertainment, Travel, Other).
- [ ] Service-role key stored only in server-side env.

---

## 4. Vercel deployment checklist

- [ ] Repository connected to a Vercel project.
- [ ] Framework preset: Next.js (auto-detected).
- [ ] Environment variables set for Production (and Preview) — see §2.
- [ ] Build command `next build` and output verified.
- [ ] `NEXT_PUBLIC_SITE_URL` matches the production domain.
- [ ] Preview deployment reviewed before promoting to Production.
- [ ] Production deployment succeeds and is reachable.

---

## 5. Pre-launch verification (production smoke test)

Run against the live URL:

- [ ] Register a new account → lands on dashboard; `profiles` row created.
- [ ] Login persists across refresh; logout blocks protected routes.
- [ ] Add a friend by email; verify per-friend balance.
- [ ] Create a group; add members.
- [ ] Add an expense with **equal**, **exact**, and **percentage** splits.
- [ ] Edit and delete an expense; balances update correctly.
- [ ] Record a settlement; balances move by the exact amount.
- [ ] Dashboard figures reconcile with the ledger.
- [ ] Profile edit + avatar upload works (Storage policies correct).
- [ ] Two-account test: no cross-user data is visible (RLS holds in prod).
- [ ] Responsive check on mobile/tablet/desktop.
- [ ] (If shipped) PWA installs and launches standalone.
- [ ] No secrets present in client bundle / network responses.

---

## 6. Post-deploy

- [ ] README updated with the live URL and setup instructions.
- [ ] Confirm error states behave in production (not just dev).
- [ ] Note any deferred/optional items (filters, dark mode, PWA) not shipped.

---

## 7. Rollback

- Vercel keeps prior deployments; promote a previous good deployment if a regression ships.
- Database migrations are forward-only for the MVP; take care with destructive schema changes (prefer additive migrations).

Cross-references: [architecture.md](./architecture.md) §6, [phases/phase-8-deployment-qa.md](./phases/phase-8-deployment-qa.md).
