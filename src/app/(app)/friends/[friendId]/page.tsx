import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { FriendBalance } from '@/components/friends/friend-balance';
import { SettleUpDialog } from '@/components/settlements/settle-up-dialog';
import { SettlementList } from '@/components/settlements/settlement-list';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getFriendDetail } from '@/lib/queries/friends';
import { listSettlements } from '@/lib/queries/settlements';

export const metadata: Metadata = { title: 'Friend' };

/**
 * Friend detail page (Phase 3, extended in Phase 5). Shows the current user's
 * settlement-aware balance with one friend, a Settle Up action prefilled from the
 * outstanding balance, and the history of settlements between the two of them.
 * RLS-hidden or unknown ids resolve to `null` → 404.
 */
export default async function FriendDetailPage({
  params,
}: {
  params: { friendId: string };
}) {
  const user = await requireUser();
  const detail = await getFriendDetail(params.friendId);
  if (!detail) notFound();

  const friendName = detail.friend.full_name || 'Unnamed';

  // Only settlements strictly between the current user and this friend.
  const settlements = (
    await listSettlements({ withUserId: detail.friend.id })
  ).filter(({ settlement }) => {
    const parties = [settlement.payer_id, settlement.receiver_id];
    return parties.includes(user.id) && parties.includes(detail.friend.id);
  });

  // Prefill the dialog to clear the balance: whoever owes pays the other.
  const owesMe = detail.netCents > 0;
  const defaultAmountCents = Math.abs(detail.netCents) || undefined;

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.friends}>
          <ArrowLeft />
          Back to friends
        </Link>
      </Button>

      <FriendBalance detail={detail} />

      <div className="flex justify-end">
        <SettleUpDialog
          people={[
            { id: user.id, name: 'You' },
            { id: detail.friend.id, name: friendName },
          ]}
          defaultPayerId={owesMe ? detail.friend.id : user.id}
          defaultReceiverId={owesMe ? user.id : detail.friend.id}
          defaultAmountCents={defaultAmountCents}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settlement history</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No settlements yet. Record one to clear your balance with{' '}
              {friendName}.
            </p>
          ) : (
            <SettlementList settlements={settlements} currentUserId={user.id} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
