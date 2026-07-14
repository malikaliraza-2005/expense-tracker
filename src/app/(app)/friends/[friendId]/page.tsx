import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { FriendBalance } from '@/components/friends/friend-balance';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { getFriendDetail } from '@/lib/queries/friends';

export const metadata: Metadata = { title: 'Friend' };

/**
 * Friend detail page (Phase 3). Shows the current user's balance with one
 * friend. RLS-hidden or unknown ids resolve to `null` → 404.
 */
export default async function FriendDetailPage({
  params,
}: {
  params: { friendId: string };
}) {
  const detail = await getFriendDetail(params.friendId);
  if (!detail) notFound();

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.friends}>
          <ArrowLeft />
          Back to friends
        </Link>
      </Button>

      <FriendBalance detail={detail} />
    </section>
  );
}
