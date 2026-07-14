# Feature Specifications

Detailed specification of every feature in the MVP, grouped by module. Each feature lists its behavior, business rules, and acceptance criteria. This is the "what it should do" reference that phase files implement.

---

## 1. Authentication

### 1.1 Register
- **Behavior:** Email + password registration. On success, a `profiles` row is auto-created and the user is signed in.
- **Rules:** Unique email; password meets Supabase minimum; friendly errors for duplicates/weak passwords.
- **Acceptance:** New account can immediately access the dashboard; a `profiles` row exists.

### 1.2 Login
- **Behavior:** Email + password sign-in; sets an httpOnly session cookie.
- **Acceptance:** Valid credentials reach the dashboard; invalid show an inline error.

### 1.3 Logout
- **Behavior:** Clears the session; returns to a public page.
- **Acceptance:** Protected routes are inaccessible afterward.

### 1.4 Protected routes & session persistence
- **Behavior:** Unauthenticated users are redirected from app routes to `/login`; sessions survive refresh via cookie.
- **Acceptance:** Hard refresh keeps the user signed in; direct URL access while signed out redirects.

---

## 2. Dashboard

- **Total balance:** the user's overall net across all friends/groups.
- **You owe:** sum the user owes others.
- **You are owed:** sum others owe the user.
- **Net balance:** you-are-owed − you-owe.
- **Recent expenses:** latest expenses involving the user.
- **Groups overview:** the user's groups with per-group balance.
- **Quick actions:** Quick Add Expense, Quick Create Group.
- **Rules:** All figures derive from `expense_splits` + `settlements`; a single currency.
- **Acceptance:** Every figure reconciles with the underlying ledger.

---

## 3. User Profile

- **View profile:** name, avatar, preferred currency.
- **Edit name:** update `full_name`.
- **Avatar:** upload/replace image in Supabase Storage; profile reflects it.
- **Preferred currency:** selected value drives display across the app (single currency).
- **Acceptance:** Edits persist; avatar visible after upload; currency reflected app-wide.

---

## 4. Friends (registered users only)

- **Add friend:** by email; links only to an existing account, else "no account found".
- **Search friends:** filter the friends list by name/email.
- **Remove friend:** removes the link (history/balances preserved where relevant).
- **Friends list:** all friends with the net balance for each.
- **View balance with a friend:** breakdown of what is owed either way.
- **Rules:** No duplicate links; cannot friend oneself.
- **Acceptance:** Add/remove reflect immediately; per-friend balance is correct.

---

## 5. Groups

- **Create group:** name + type (Trip, Home, Friends, Couple, Office, Other); optionally add members.
- **Edit group:** rename, change type.
- **Delete group:** blocked while expenses exist (protect history) — must be cleared/settled first.
- **Add/remove members:** manage `group_members`.
- **View group members / summary / balance:** members list, expense summary, and who-owes-whom ledger.
- **Rules:** Only members can view; only owner can edit/delete/manage membership.
- **Acceptance:** Non-members cannot access; membership changes reflect immediately.

---

## 6. Expenses

- **Add expense:** title, description (optional), amount, category, date, payer, split configuration; optional receipt/notes.
- **Edit expense:** any field; splits recompute.
- **Delete expense:** removes expense + its splits; balances reverse.
- **View details:** full expense with per-person shares.
- **Categories:** Food, Transport, Shopping, Bills, Entertainment, Travel, Other.
- **Payer selection:** you paid / a friend paid / any group member.
- **Rules:** Amount > 0; splits must sum to the total; expense + splits written atomically.
- **Acceptance:** Each split type produces correct shares; edit/delete keep balances correct.

### 6.1 Splitting
| Type | Behavior | Validation |
|---|---|---|
| **Equal** | Divide equally among participants; distribute remainder deterministically | ≥1 participant |
| **Exact** | Each participant assigned an exact amount | Shares sum to total |
| **Percentage** | Each participant assigned a percent | Percents sum to 100; derived cents sum to total |

Remainder rule: for equal/percentage, leftover cents are distributed one cent at a time in a stable order so `sum(shares) == total`.

---

## 7. Balances

- **Individual balances:** per-friend net (positive = owed to user, negative = user owes).
- **Group balances:** per-group who-owes-whom ledger.
- **Rules:** Derived on read; updated implicitly after every expense/settlement.
- **Acceptance:** Balances match hand-computed values for seed data.

---

## 8. Settlements (Settle Up)

- **Record settlement:** payer, receiver, amount, optional note.
- **Effect:** Reduces the corresponding balance; visible across all affected views.
- **Rules:** Payer ≠ receiver; amount > 0; single currency.
- **Acceptance:** A settlement moves balances by exactly the recorded amount.

---

## 9. Search

- **Search friends:** by name/email.
- **Search groups:** by name.
- **Search expenses:** by title (and optionally filters) — see history filters.
- **Rules:** Results are RLS-scoped to what the user may see.
- **Acceptance:** Only permitted, matching results appear.

---

## 10. Expense history & filters

- **View all expenses;** sort newest/oldest.
- **Filter by:** category, member, date, amount.
- **Status:** list is core (Phase 4); advanced filters are Phase-6-optional.
- **Acceptance:** Sorting/filtering returns correct subsets.

---

## 11. Responsive UI

- **Behavior:** Usable and polished on mobile, tablet, and desktop.
- **Rules:** No horizontal body overflow; touch targets adequate; visible keyboard focus.
- **Acceptance:** Verified at representative breakpoints.

---

## 12. PWA (optional)

- **Behavior:** Installable app — Web App Manifest, icons, minimal service worker.
- **Out of scope:** offline writes, sync, IndexedDB, background sync, offline fallback pages (droppable).
- **Acceptance:** Install prompt appears; app launches standalone.

---

## 13. Non-functional expectations

| Aspect | Expectation |
|---|---|
| Security | RLS on all tables; server-side authz; no client secrets |
| Correctness | Integer money; splits sum to total; balances reconcile |
| Performance | Indexed FKs; reads scoped and paginated where lists grow |
| Accessibility | Semantic components (shadcn/ui), focus states, labels |
| Consistency | Single currency; single source of truth for balances |
