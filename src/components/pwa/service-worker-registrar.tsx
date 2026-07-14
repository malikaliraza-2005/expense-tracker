'use client';

import * as React from 'react';

/**
 * Registers the minimal service worker (`/sw.js`) that makes the app
 * installable (Phase 7). Renders nothing.
 *
 * - Feature-detected: browsers without service-worker support simply skip
 *   registration and the app keeps working as a normal site.
 * - Production-only: avoids interfering with the dev server / HMR.
 *
 * The worker itself does no caching (online-only app), so there is no offline
 * behavior and no private data is ever stored on the device.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failures are non-fatal: the site still works without the
      // worker; it just isn't installable in this session.
    });
  }, []);

  return null;
}
