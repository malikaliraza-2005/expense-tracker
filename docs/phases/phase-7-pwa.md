# Phase 7 — PWA (Optional)

> Optional and fully droppable. Basic installability only — **no offline behavior**.

## 1. Phase Overview

**Objective**
Make the app installable — nothing more.

**Scope**
Web App Manifest, app icons, and a minimal service worker registration for installability. Explicitly **excludes** offline writes, sync, IndexedDB, background sync, and offline fallback pages.

**Expected outcome**
An installable PWA that launches standalone, with no impact on core behavior.

---

## 2. Features / Modules

**Included:** Installable app (manifest + icons + minimal service worker).

**User flows**
- **Install:** browser shows an install prompt → user installs → app launches in a standalone window.

**Business rules**
- No offline write/sync features. The architecture is left extensible so offline could be added later without refactoring, but none of it is implemented now.

---

## 3. Backend Implementation Plan

**Backend tasks:** none.

**Database operations:** none.

**Server actions / API requirements:** none (manifest + service worker are static assets).

**Security considerations**
- Service worker scoped correctly; no caching of authenticated/sensitive responses (avoid stale private data).

---

## 4. Frontend Implementation Plan

**Pages / components**
- Web App Manifest with name, theme/background colors, display `standalone`, icons.
- Icon set (multiple sizes).
- Minimal service worker registration for installability.

**UI states**
- Install prompt (browser-driven); standalone launch.

**User interactions**
- Install / launch the app.

---

## 5. Database Changes

None.

---

## 6. Files / Modules Expected To Be Created

- `public/manifest.webmanifest` (or app metadata route).
- `public/icons/*` (icon sizes).
- Service worker file + registration.
- Manifest linkage in the root layout metadata.

---

## 7. Dependencies

**Previous phases:** a stable app shell (Phases 0–6).
**Depends on:** the deployed/served static asset pipeline.

---

## 8. Testing Checklist

**Functional**
- [ ] Install prompt appears in a supporting browser.
- [ ] App installs and launches standalone.
- [ ] Lighthouse PWA "installable" check passes.

**Security**
- [ ] Service worker does not cache authenticated/private responses.

**Edge cases**
- [ ] Unsupported browsers degrade gracefully (app still works as a normal site).

**Acceptance criteria**
- [ ] App is installable and launches standalone; core behavior unchanged.

---

## 9. Demo Checklist

- [ ] Trigger install and open the installed app.
- [ ] Confirm standalone window and correct icon/name.
- [ ] Confirm the site still works normally in-browser.
