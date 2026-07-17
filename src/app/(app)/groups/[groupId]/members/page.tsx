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

  // The owner is always a member of their own group (they can't add or remove
  // themselves), so they're excluded from the add/remove chips — they appear once, in
  // the member cards below. This avoids a duplicate "You" on the Members tab.
  const manageable = allMembers
    .filter((member) => !member.is_self)
    .map((member) => ({
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
          <CardTitle className="text-base">Add people</CardTitle>
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

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Members
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            {members.length}
          </span>
        </h2>
        <GroupMembers
          groupId={group.id}
          selfMemberId={selfMemberId}
          members={members}
        />
      </section>
    </div>
  );
}
