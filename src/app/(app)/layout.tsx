import { DecorativeBackground } from '@/components/common/decorative-background';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopNav } from '@/components/layout/top-nav';
import { requireUser } from '@/lib/auth';
import { getCurrentProfile } from '@/lib/queries/profile';

/**
 * Protected app shell layout (Phase 1, responsive chrome added in Phase 6).
 *
 * Server-side auth guard: `requireUser` redirects unauthenticated visitors to
 * the login page (defense in depth alongside middleware). Renders the fixed
 * desktop sidebar and the mobile top bar / drawer around the page content, both
 * seeded with the current user's name and avatar.
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
    <div className="min-h-screen">
      <DecorativeBackground />
      <AppSidebar name={name} avatarUrl={avatarUrl} />
      <div className="md:pl-64">
        <TopNav name={name} avatarUrl={avatarUrl} />
        <main className="mx-auto max-w-5xl animate-fade-in px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
