import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Receipt,
  Scale,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';

import { DonutChart } from '@/components/charts/donut-chart';
import { DecorativeBackground } from '@/components/common/decorative-background';
import { Logo } from '@/components/common/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/utils/cn';

/**
 * Public marketing landing page (root `/`). A premium neon hero with a live
 * product-preview mock, a feature grid, and a glowing closing CTA. Presentation
 * only — CTAs link to `/login` and `/register`; no auth logic lives here.
 */

const FEATURES = [
  {
    icon: Receipt,
    title: 'Track every expense',
    description:
      'Log shared costs in seconds and never lose track of who paid for what.',
    tone: 'text-primary bg-primary/15 ring-primary/25',
  },
  {
    icon: Users,
    title: 'Split with groups',
    description:
      'Create groups for trips, roommates, or dinners and split fairly every time.',
    tone: 'text-purple bg-purple/15 ring-purple/25',
  },
  {
    icon: Scale,
    title: 'Balances, live',
    description:
      'See exactly who owes what, updated the moment an expense is added.',
    tone: 'text-cyan bg-cyan/15 ring-cyan/25',
  },
  {
    icon: Wallet,
    title: 'Settle up easily',
    description:
      'Record payments, clear balances, and stay friends — no awkward math.',
    tone: 'text-income bg-income/15 ring-income/25',
  },
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(ROUTES.dashboard);

  return (
    <div className="relative flex min-h-screen flex-col">
      <DecorativeBackground />

      {/* Top navigation */}
      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Logo size="sm" className="min-w-0" />
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={ROUTES.login}>Log in</Link>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <Link href={ROUTES.register}>Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* Hero */}
        <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span
              className="inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary shadow-glow-sm"
              style={{ animationDelay: '0ms' }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Split expenses, stress-free
            </span>

            <h1
              className="mt-6 animate-fade-in-up text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ animationDelay: '80ms' }}
            >
              Shared expenses,{' '}
              <span className="text-gradient">without the awkward math</span>
            </h1>

            <p
              className="mx-auto mt-5 max-w-xl animate-fade-in-up text-base text-muted-foreground sm:text-lg lg:mx-0"
              style={{ animationDelay: '160ms' }}
            >
              Track what you spend together, split it fairly, and always know who
              owes what — for trips, roommates, and everything in between.
            </p>

            <div
              className="mt-8 flex animate-fade-in-up flex-col justify-center gap-3 sm:flex-row lg:justify-start"
              style={{ animationDelay: '240ms' }}
            >
              <Button asChild variant="gradient" size="lg">
                <Link href={ROUTES.register}>
                  Get started free
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={ROUTES.login}>Log in</Link>
              </Button>
            </div>
          </div>

          {/* Product preview mock */}
          <div
            className="animate-fade-in-up [animation-delay:320ms]"
            style={{ animationDelay: '320ms' }}
          >
            <PreviewMock />
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description, tone }) => (
            <Card
              key={title}
              interactive
              className="animate-fade-in-up"
            >
              <CardContent className="flex flex-col gap-3 p-6">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset',
                    tone,
                  )}
                >
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
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-neon p-6 text-center text-white shadow-glow sm:p-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan/40 blur-3xl" />
            <div className="relative flex flex-col items-center gap-5">
              <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-4xl">
                Ready to split your first expense?
              </h2>
              <p className="max-w-md text-sm text-white/85">
                Create a free account and settle up with friends in minutes.
              </p>
              <Button asChild size="lg" variant="secondary" className="text-foreground">
                <Link href={ROUTES.register}>
                  Create your free account
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo size="sm" />
          <p>Split expenses with friends and groups — simply.</p>
        </div>
      </footer>
    </div>
  );
}

/** A static, glassy dashboard preview used as the hero visual. */
function PreviewMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-primary/20 blur-3xl" />
      <Card className="p-5 shadow-elevated sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Net balance</p>
            <p className="text-2xl font-bold text-income">+$248.50</p>
          </div>
          <DonutChart
            size={96}
            thickness={12}
            segments={[
              { label: 'Owed', value: 320, color: 'hsl(var(--income))' },
              { label: 'Owe', value: 72, color: 'hsl(var(--expense))' },
            ]}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-income">
              <ArrowDownLeft className="h-3.5 w-3.5" />
              You are owed
            </div>
            <p className="mt-1 text-lg font-semibold text-income">$320.00</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-expense">
              <ArrowUpRight className="h-3.5 w-3.5" />
              You owe
            </div>
            <p className="mt-1 text-lg font-semibold text-expense">$71.50</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            { name: 'Dinner at Nomad', who: 'You paid', amt: '$86.00', color: 'hsl(var(--warning))' },
            { name: 'Weekend trip', who: 'Alex paid', amt: '$220.00', color: 'hsl(var(--purple))' },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 p-2.5"
            >
              <span
                className="h-8 w-8 shrink-0 rounded-lg"
                style={{ backgroundColor: `color-mix(in srgb, ${row.color} 22%, transparent)` }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.who}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{row.amt}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
