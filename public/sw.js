/*
 * Minimal service worker — installability only (Phase 7).
 *
 * Deliberately has NO fetch handler and performs NO caching. This app is
 * online-only: offline behavior, request caching, and background sync are
 * explicitly out of scope. Not caching anything also guarantees no
 * authenticated/private response is ever stored on the device.
 *
 * The lifecycle handlers below simply let a new worker take control promptly
 * so the app is installable and behaves as a standalone PWA.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
