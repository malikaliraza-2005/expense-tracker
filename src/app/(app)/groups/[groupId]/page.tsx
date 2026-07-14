import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, Receipt, Users } from 'lucide-react';

import { BalanceLabel } from '@/components/common/money';
import { DeleteGroupButton } from '@/components/groups/delete-group-button';
import { EditGroupDialog } from '@/components/groups/edit-group-dialog';
import { GroupLedger } from '@/components/groups/group-ledger';
import { SettleUpDialog } from '@/components/settlements/settle-up-dialog';
import { SettlementList } from '@/components/settlements/settlement-list';
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
import { requireUser } from '@/lib/auth';
import { getGroup, getGroupLedger } from '@/lib/queries/groups';
import { listSettlements } from '@/lib/queries/settlements';

export const metadata: Metadata = { title: 'Group' };

/**
 * Group detail page (Phase 3, extended in Phase 5). Shows members, a
 * current-user-scoped summary, and the settlement-aware who-owes-whom ledger,
 * plus a Settle Up action and the group's settlement history. The owner also
 * gets edit/delete/manage controls. RLS-hidden or unknown groups → 404.
 */
export default async function GroupDetailPage({
  params,
}: {
  params: { groupId: string };
}) {
  const user = await requireUser();
  const detail = await getGroup(params.groupId);
  if (!detail) notFound();

  const [ledger, settlements] = await Promise.all([
    getGroupLedger(params.groupId),
    listSettlements({ groupId: params.groupId }),
  ]);
  const { group, members, summary, isOwner } = detail;

  const settlePeople = members.map((member) => ({
    id: member.userId,
    name: member.userId === user.id ? 'You' : member.profile.full_name || 'Unnamed',
  }));

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
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Your balance in this group</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href={`/groups/${group.id}/expenses`}>
              <Receipt />
              Expenses
            </Link>
          </Button>
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
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Balances</CardTitle>
          {members.length > 1 ? (
            <SettleUpDialog
              groupId={group.id}
              people={settlePeople}
              defaultPayerId={user.id}
            />
          ) : null}
        </CardHeader>
        <CardContent>
          <GroupLedger ledger={ledger} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settlement history</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No settlements recorded in this group yet.
            </p>
          ) : (
            <SettlementList settlements={settlements} currentUserId={user.id} />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
