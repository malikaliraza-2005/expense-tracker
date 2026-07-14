import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ArrowRight, Receipt, Scale, Users, Wallet } from 'lucide-react';

import { DecorativeBackground } from '@/components/common/decorative-background';
import { Logo } from '@/components/common/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';

/**
 * Public marketing landing page (root `/`). The first thing visitors see: a
 * hero with clear Log in / Sign up calls-to-action, a short feature overview,
 * and a closing prompt. Presentation only — the CTAs link to the existing
 * `/login` and `/register` routes; no auth logic lives here.
 */

const FEATURES = [
  {
    icon: Receipt,
    title: 'Track every expense',
    description:
      'Log shared costs in seconds and never lose track of who paid for what.',
  },
  {
    icon: Users,
    title: 'Split with groups',
    description:
      'Create groups for trips, roommates, or dinners and split fairly every time.',
  },
  {
    icon: Scale,
    title: 'Balances, live',
    description:
      'See exactly who owes what, updated the moment an expense is added.',
  },
  {
    icon: Wallet,
    title: 'Settle up easily',
    description:
      'Record payments, clear balances, and stay friends — no awkward math.',
  },
];

export default async function LandingPage() {
  // Already signed in? Skip the marketing page and go straight to the app.
  // The session was just refreshed by middleware, so this read is current.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.dashboard);

  return (
    <div className="relative flex min-h-screen flex-col">
      <DecorativeBackground />

      {/* Top navigation */}
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.login}>Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={ROUTES.register}>Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col items-center py-20 text-center sm:py-28">
          <span
            className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft"
            style={{ animationDelay: '0ms' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Split expenses, stress-free
          </span>

          <h1
            className="mt-6 max-w-3xl animate-fade-in-up text-4xl font-bold tracking-tight sm:text-6xl"
            style={{ animationDelay: '80ms' }}
          >
            Shared expenses,{' '}
            <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
              without the awkward math
            </span>
          </h1>

          <p
            className="mt-5 max-w-xl animate-fade-in-up text-base text-muted-foreground sm:text-lg"
            style={{ animationDelay: '160ms' }}
          >
            Track what you spend together, split it fairly, and always know who
            owes what — for trips, roommates, and everything in between.
          </p>

          <div
            className="mt-8 flex animate-fade-in-up flex-col gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            <Button asChild size="lg">
              <Link href={ROUTES.register}>
                Get started free
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={ROUTES.login}>Log in</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="hover:-translate-y-1 hover:shadow-elevated"
            >
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-soft">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Closing call-to-action */}
        <section className="pb-24">
          <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-elevated">
            <CardContent className="flex flex-col items-center gap-5 p-10 text-center sm:p-14">
              <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
                Ready to split your first expense?
              </h2>
              <p className="max-w-md text-sm text-primary-foreground/80">
                Create a free account and settle up with friends in minutes.
              </p>
              <Button asChild size="lg" variant="secondary">
                <Link href={ROUTES.register}>
                  Create your free account
                  <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo size="sm" />
          <p>Split expenses with friends and groups — simply.</p>
        </div>
      </footer>
    </div>
  );
}
