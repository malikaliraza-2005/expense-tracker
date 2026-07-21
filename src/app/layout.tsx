import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { ServiceWorkerRegistrar } from '@/components/pwa/service-worker-registrar';
import { Toaster } from '@/components/ui/sonner';
import { APP_NAME } from '@/constants/app';
import { cn } from '@/utils/cn';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: 'Split expenses with friends and groups.',
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0B0C',
};

/**
 * Applies the persisted theme before first paint to avoid a flash of the wrong
 * theme. Runs synchronously in <head> ahead of any rendering. Kept as a small
 * inline string so it ships without a separate request. Defaults to the premium
 * dark neon theme unless the user has explicitly chosen light.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'){document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          inter.variable,
        )}
      >
        {children}
        <Toaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
