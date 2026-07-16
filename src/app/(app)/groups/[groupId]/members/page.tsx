import { notFound } from 'next/navigation';

import { GroupMemberManager } from '@/components/groups/group-member-manager';
import { GroupMembers } from '@/components/groups/group-members';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import { getSelfMemberId } from '@/lib/queries/balances';
import { getGroup, getGroupMembersWithStats } from '@/lib/queries/groups';
import { getMembers } from '@/lib/queries/members';

export const metadata = { title: 'Group members' };

/**
 * Group Members tab: add or remove people, and see each member's in-group Paid,
 * Owes, and Balance with a Settle up action. Every figure is scoped to this
 * group via {@link getGroupMembersWithStats}.
 */
export default async function GroupMembersPage({
  params,
}: {
  params: { groupId: string };
}) {
  const user = await requireUser();
  const group = await getGroup(params.groupId);
  if (!group) notFound();

  const [members, allMembers, selfMemberId] = await Promise.all([
    getGroupMembersWithStats(params.groupId),
    getMembers(),
    getSelfMemberId(),
  ]);

  const manageable = allMembers.map((member) => ({
    id: member.id,
    name: member.name,
    isSelf: member.is_self,
    email: member.email,
  }));
  const memberIds = members.map((entry) => entry.member.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add or remove people</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupMemberManager
            groupId={group.id}
            allMembers={manageable}
            memberIds={memberIds}
            inviteRef={user.id}
          />
        </CardContent>
      </Card>

      <GroupMembers
        groupId={group.id}
        selfMemberId={selfMemberId}
        members={members}
      />
    </div>
  );
}
