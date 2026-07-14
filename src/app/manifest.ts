import type { MetadataRoute } from 'next';

import { APP_NAME } from '@/constants/app';

/**
 * Web App Manifest — makes the app installable as a standalone PWA (Phase 7).
 * Installability only: no offline behavior. Next auto-links this route as
 * `<link rel="manifest" href="/manifest.webmanifest">`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_NAME,
    short_name: 'Expenses',
    description: 'Split expenses with friends and groups.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'en',
    dir: 'ltr',
    categories: ['finance', 'productivity'],
    background_color: '#ffffff',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
