import type { Metadata } from 'next';

import { Logo } from '@/components/common/logo';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { safeCurrency } from '@/constants/currencies';
import { createClient } from '@/lib/supabase/server';
import { formatCents } from '@/utils/money';

export const metadata: Metadata = {
  title: 'Your balance',
  robots: { index: false, follow: false },
};

interface LedgerRow {
  member_name: string;
  owner_name: string;
  currency: string | null;
  net_cents: number;
}

/**
 * Public, read-only share page. Resolves a member share token to that member's
 * balance with the account owner via the `member_ledger_by_token` function
 * (SECURITY DEFINER — no session or RLS access to anything else). Shows nothing
 * but the one balance; an invalid or revoked token shows a neutral message.
 */
export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('member_ledger_by_token', {
    p_token: params.token,
  });

  const rows = (error ? [] : ((data ?? []) as LedgerRow[])) satisfies LedgerRow[];
  const valid = rows.length > 0;
  const memberName = valid ? rows[0].member_name : '';
  const ownerName = valid ? rows[0].owner_name : '';
  const balances = rows.filter(
    (row) => row.currency !== null && row.net_cents !== 0,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>

      {!valid ? (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-semibold">This link isn&apos;t active</p>
            <p className="text-sm text-muted-foreground">
              It may have been revoked or never existed. Ask whoever shared it
              for a new link.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {memberName}, here&apos;s where you stand with {ownerName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You&apos;re all settled up with {ownerName}. 🎉
              </p>
            ) : (
              <ul className="space-y-3">
                {balances.map((row) => {
                  const owes = row.net_cents > 0; // member owes the owner
                  const amount = formatCents(
                    Math.abs(row.net_cents),
                    safeCurrency(row.currency),
                  );
                  return (
                    <li
                      key={row.currency}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-4 py-3"
                    >
                      <span className="text-sm text-muted-foreground">
                        {owes ? `You owe ${ownerName}` : `${ownerName} owes you`}
                      </span>
                      <span
                        className={`text-lg font-semibold tabular-nums ${
                          owes
                            ? 'text-destructive'
                            : 'text-emerald-600 dark:text-emerald-500'
                        }`}
                      >
                        {amount}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="pt-1 text-xs text-muted-foreground">
              This is a read-only summary shared with you. Amounts update as
              {' '}
              {ownerName} records expenses and payments.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
