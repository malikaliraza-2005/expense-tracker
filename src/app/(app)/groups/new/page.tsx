import type { Metadata } from 'next';
import Link from 'next/link';

import { ArrowLeft } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { GroupForm } from '@/components/groups/group-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { getFriends } from '@/lib/queries/friends';

export const metadata: Metadata = { title: 'New group' };

/**
 * New-group page (Phase 3). Loads the user's friends so they can optionally seed
 * the group's membership, then renders the shared create form.
 */
export default async function NewGroupPage() {
  const friends = await getFriends();
  const friendOptions = friends.map((friend) => ({
    id: friend.profile.id,
    name: friend.profile.full_name || 'Unnamed',
  }));

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link href={ROUTES.groups}>
          <ArrowLeft />
          Back to groups
        </Link>
      </Button>

      <PageHeader
        title="New group"
        description="Name your group, pick a type, and optionally add friends."
      />

      <Card>
        <CardContent className="pt-6">
          <GroupForm mode="create" friends={friendOptions} />
        </CardContent>
      </Card>
    </section>
  );
}
