import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { MemberManager } from '@/components/groups/member-manager';
import { Button } from '@/components/ui/button';
import { getFriends } from '@/lib/queries/friends';
import { getGroup } from '@/lib/queries/groups';

export const metadata: Metadata = { title: 'Group members' };

/**
 * Group members page (Phase 3). The owner can add friends (not already members)
 * and remove members; other members see a read-only roster. RLS-hidden or
 * unknown groups resolve to `null` → 404.
 */
export default async function GroupMembersPage({
  params,
}: {
  params: { groupId: string };
}) {
  const detail = await getGroup(params.groupId);
  if (!detail) notFound();

  const memberIds = new Set(detail.members.map((member) => member.userId));
  const friends = detail.isOwner ? await getFriends() : [];
  const candidates = friends
    .filter((friend) => !memberIds.has(friend.profile.id))
    .map((friend) => ({
      id: friend.profile.id,
      name: friend.profile.full_name || 'Unnamed',
    }));

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={`/groups/${detail.group.id}`}>
          <ArrowLeft />
          Back to group
        </Link>
      </Button>

      <PageHeader
        title="Members"
        description={detail.group.name}
      />

      <MemberManager
        groupId={detail.group.id}
        ownerId={detail.group.created_by}
        members={detail.members}
        candidates={candidates}
        isOwner={detail.isOwner}
      />
    </section>
  );
}
