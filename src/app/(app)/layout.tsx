import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import type { NavBadges } from '@/components/layout/nav-config';
import { DecorativeBackground } from '@/components/common/decorative-background';
import { CurrencyProvider } from '@/components/providers/currency-provider';
import { RealtimeSync } from '@/components/providers/realtime-sync';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getUnreadActivityCount } from '@/lib/queries/activity';
import { getCurrentProfile } from '@/lib/queries/profile';
import { getReceivedActionableCount } from '@/lib/queries/requests';

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
  const [profile, requestsCount, activityCount] = await Promise.all([
    getCurrentProfile(),
    getReceivedActionableCount(),
    getUnreadActivityCount(),
  ]);
  const name = profile?.full_name || null;
  const avatarUrl = profile?.avatar_url ?? null;

  // Overlay nav-item counts: actionable-received on Requests, unread on Activity
  // (each omitted when 0).
  const badges: NavBadges = {
    ...(requestsCount > 0 ? { [ROUTES.requests]: requestsCount } : {}),
    ...(activityCount > 0 ? { [ROUTES.activity]: activityCount } : {}),
  };

  return (
    <CurrencyProvider initialCurrency={profile?.preferred_currency}>
      <RealtimeSync />
      <div className="relative min-h-screen">
        <DecorativeBackground />
        <AppHeader name={name} avatarUrl={avatarUrl} badges={badges} />
        <main className="mx-auto max-w-6xl px-4 py-6 pb-safe-nav sm:px-6 md:pb-10">
          {children}
        </main>
        <BottomNav badges={badges} />
      </div>
    </CurrencyProvider>
  );
}
