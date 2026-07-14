import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, Users } from 'lucide-react';

import { BalanceLabel } from '@/components/common/money';
import { DeleteGroupButton } from '@/components/groups/delete-group-button';
import { EditGroupDialog } from '@/components/groups/edit-group-dialog';
import { GroupLedger } from '@/components/groups/group-ledger';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { groupTypeLabel } from '@/constants/group-types';
import { ROUTES } from '@/constants/routes';
import { getGroup, getGroupLedger } from '@/lib/queries/groups';

export const metadata: Metadata = { title: 'Group' };

/**
 * Group detail page (Phase 3). Shows members, a current-user-scoped summary, and
 * the who-owes-whom ledger. The owner also gets edit/delete/manage controls.
 * RLS-hidden or unknown groups resolve to `null` → 404.
 */
export default async function GroupDetailPage({
  params,
}: {
  params: { groupId: string };
}) {
  const detail = await getGroup(params.groupId);
  if (!detail) notFound();

  const ledger = await getGroupLedger(params.groupId);
  const { group, members, summary, isOwner } = detail;

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.groups}>
          <ArrowLeft />
          Back to groups
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {group.name}
            </h1>
            <Badge variant="secondary">{groupTypeLabel(group.type)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {summary.memberCount}{' '}
            {summary.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
        {isOwner ? (
          <div className="flex gap-2">
            <EditGroupDialog
              group={{ id: group.id, name: group.name, type: group.type }}
            />
            <DeleteGroupButton groupId={group.id} groupName={group.name} />
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your balance in this group</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceLabel netCents={summary.netCents} subject="you" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Members</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/groups/${group.id}/members`}>
              <Users />
              {isOwner ? 'Manage' : 'View'}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-wrap gap-3">
            {members.map((member) => (
              <li key={member.userId} className="flex items-center gap-2">
                <Avatar name={member.profile.full_name} className="h-8 w-8" />
                <span className="text-sm">
                  {member.profile.full_name || 'Unnamed'}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupLedger ledger={ledger} />
        </CardContent>
      </Card>
    </section>
  );
}
