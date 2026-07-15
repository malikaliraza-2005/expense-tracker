import type { Metadata } from 'next';
import Link from 'next/link';

import { Bell, Info, Palette, ShieldCheck, User } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { ThemeSetting } from '@/components/settings/theme-setting';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/constants/app';
import { ROUTES } from '@/constants/routes';

export const metadata: Metadata = { title: 'Settings' };

/**
 * Settings page. Groups the account's preferences into glass panels:
 * appearance (theme), account shortcuts, notifications, and an about section.
 * Presentation-first — the theme control persists client-side; the rest links
 * into existing surfaces.
 */
export default function SettingsPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Tune how Expense Tracker looks and works for you."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
              <Palette className="h-4 w-4" />
            </span>
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple/15 text-purple ring-1 ring-inset ring-purple/25">
              <User className="h-4 w-4" />
            </span>
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SettingRow
            icon={<User className="h-4 w-4" />}
            title="Profile"
            description="Your name, photo, and currency."
            href={ROUTES.profile}
          />
          <SettingRow
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Security"
            description="Manage your password from the reset flow."
            href={ROUTES.forgotPassword}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/15 text-cyan ring-1 ring-inset ring-cyan/25">
              <Bell className="h-4 w-4" />
            </span>
            Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In-app toasts keep you posted when balances change. Email digests are
            on the roadmap.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-income/15 text-income ring-1 ring-inset ring-income/25">
              <Info className="h-4 w-4" />
            </span>
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{APP_NAME}</span>
          <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            v0.1.0
          </span>
        </CardContent>
      </Card>
    </section>
  );
}

function SettingRow({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      className="h-auto w-full justify-start gap-3 rounded-xl border border-border/50 bg-background/30 p-3 text-left"
    >
      <Link href={href}>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {description}
          </span>
        </span>
      </Link>
    </Button>
  );
}
