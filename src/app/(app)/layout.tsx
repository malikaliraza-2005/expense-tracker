import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { DecorativeBackground } from '@/components/common/decorative-background';
import { CurrencyProvider } from '@/components/providers/currency-provider';
import { requireUser } from '@/lib/auth';
import { getCurrentProfile } from '@/lib/queries/profile';

/**
 * Protected app shell. Server-side auth guard (`requireUser`) redirects
 * unauthenticated visitors to login (defense in depth alongside middleware).
 *
 * The chrome is a single responsive top header with an animated pill nav on
 * desktop, plus a fixed neon bottom navigation bar on mobile — no sidebar.
 * Content is centred and given bottom padding so it clears the mobile nav.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  const profile = await getCurrentProfile();
  const name = profile?.full_name || null;
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <CurrencyProvider initialCurrency={profile?.preferred_currency}>
      <div className="relative min-h-screen">
        <DecorativeBackground />
        <AppHeader name={name} avatarUrl={avatarUrl} />
        <main className="mx-auto max-w-6xl px-4 py-6 pb-safe-nav sm:px-6 md:pb-10">
          {children}
        </main>
        <BottomNav />
      </div>
    </CurrencyProvider>
  );
}
