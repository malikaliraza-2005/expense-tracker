# Phase 1 — Fix email invites, invite landing & post-login routing

**Goal:** Adding a friend by email sends a real email; the invite link shows the
right message and never 404s after login.

**Status:** ✅ **Done & verified end-to-end** (2026-07-16). Migration **0014 is
applied/live**; `invite_details`/`accept_invite` RPCs verified against the real DB,
signed-out invite landing + register/login routing verified, and the middleware
`/register?token=X` → `/invite/X` redirect verified for a signed-in user (307).
Typecheck + lint + 24 unit tests green. Audit fix applied: the invite action now
lowercase-normalizes the email before storing (the `norm` helper was previously
dead code and the documented normalization was not actually happening). Resend
stays unconfigured, so live email is not exercised — the copy-link degrade path is
the active behavior (by design). 0015 is a Phase 2 prereq, not needed here.

---

## Context

Three bugs, one shared cause — the profile invite never used the real invitation
machinery:

- `src/components/profile/app-invite-link.tsx` built
  `` `${origin}/register?ref=${userId}` `` — a referral link that
  `src/app/(auth)/register/page.tsx` **ignores** (it reads only `token`/`email`/
  `next`, never `ref`). No invitation row, no email, no linkage.
- The working path already existed for members: `InviteByEmailDialog`
  (`src/components/members/invite-dialog.tsx`) → `inviteMemberByEmail`
  (`src/actions/invite.ts`) → `sendInviteEmail` (`src/lib/email/resend.ts`), landing
  on `src/app/invite/[token]/page.tsx`.
- The invite landing already renders the correct signed-out message + register/login
  choice; the post-login 404 risk was middleware dropping `?token=` for already-
  authenticated users.

## Technical approach (as implemented)

1. **Profile invite now invites for real.** Rewrote `AppInviteLink` into an
   email (+ optional name) form that calls
   `inviteMemberByEmail({ email, name }, { send })`:
   - **Send invite** → `send: true` (mints an `invitations` row + token, emails via
     Resend when configured).
   - **Copy link** → `send: false` (same `/invite/<token>` link to share manually).
   - Degrades to copy-link with a clear message when Resend is unconfigured (reusing
     the emailed / not-configured / send-failed states from `InviteByEmailDialog`).
   - Name defaults from the email local-part (`nameFromEmail`) because the invite
     schema (`src/schemas/invite.schema.ts`) requires a `name` when there's no
     `memberId`.
2. **Invite landing** — verified copy in `src/app/invite/[token]/page.tsx`: signed-
   out + pending shows "{inviter} invited you to split expenses" with **Create
   account** (`/register?token=…&email=…`) and **I already have an account**
   (`/login?next=/invite/<token>`). No change needed (real inviter name reads better
   than a generic "This user").
3. **Kill the post-login 404 / lost-invite paths:**
   - `src/lib/supabase/middleware.ts` — an authenticated user hitting an auth route
     carrying `?token=` is now redirected to `/invite/<token>` to claim, instead of
     being bounced to `/dashboard` and dropping the invite.
   - `src/actions/invite.ts` — added a warning when `NEXT_PUBLIC_SITE_URL` is empty
     (invite links become path-only and break when emailed).

## Files changed

- **Edited:** `src/components/profile/app-invite-link.tsx` (rewritten),
  `src/app/(app)/profile/page.tsx` (drop `userId` prop),
  `src/lib/supabase/middleware.ts` (token→invite redirect),
  `src/actions/invite.ts` (site-URL guard).
- **Verified only (no change needed):** `src/app/invite/[token]/page.tsx`,
  `src/app/(auth)/register/page.tsx`, `src/app/(auth)/login/page.tsx`.
- **Reused:** `inviteMemberByEmail`, `sendInviteEmail`, `InviteByEmailDialog`'s
  result-state pattern.

## Schema / migration

None. Relies on the pending **0014** (`invitations`, `accept_invite`,
`invite_details`). Apply 0014 before this can be exercised live.

## Edge cases

- Resend unconfigured → degrade to copy-link (handled).
- Re-inviting the same email → partial-unique reuses the pending token (already
  handled in `inviteMemberByEmail`).
- Expired / revoked / accepted token → landing renders neutral states (verified 200,
  not 404).
- Signed-in **different** account opening someone else's invite → `accept_invite`
  returns null → "couldn't accept" card.
- `NEXT_PUBLIC_SITE_URL` unset → warning logged; emailed links would be relative.
- Email casing → normalized in the action.

## Testing

- **Typecheck/lint:** `npx tsc --noEmit` and `npx eslint <changed files>` — clean.
- **Smoke (done):** dev server — `/invite/<bad-token>` → 200 "invite isn't active";
  `/register?token=…` → 200; `/profile` → 307 to login.
- **E2E (pending prereqs):** with 0014/0015 applied and a minted session
  (`verify-protected-routes-authed` recipe): signed-out and signed-in token paths
  both land correctly with no 404; real email send with Resend configured; copy-link
  degrade path.

## Done when

- [x] Profile "Invite friends" sends a real invitation (no `?ref=` dead link).
- [x] Signed-in user with `?token=` is routed to the invite page, not the dashboard.
- [x] Missing-`NEXT_PUBLIC_SITE_URL` is surfaced in logs.
- [x] Typecheck + lint clean; landing smoke-tested 200.
- [x] E2E verified against the live DB (0014 applied): `invite_details`/
  `accept_invite` RPCs, signed-out invite landing, register/login routing, and the
  signed-in `?token=` → `/invite/<token>` middleware redirect all confirmed. Resend
  is unconfigured, so real email is not sent — the copy-link degrade path is active
  (by design); a full Resend send remains untested until a key + verified domain are
  configured.
