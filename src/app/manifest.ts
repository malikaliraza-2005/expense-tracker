import type { MetadataRoute } from 'next';

import { APP_NAME } from '@/constants/app';

/**
 * Minimal web app manifest so metadata is valid from Phase 0.
 * Full PWA installability (icons, service worker) lands in Phase 7.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: 'Expenses',
    description: 'Split expenses with friends and groups.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
  };
}
