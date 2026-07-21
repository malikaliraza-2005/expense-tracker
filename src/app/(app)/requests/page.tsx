import type { Metadata } from 'next';

import Link from 'next/link';

import { Inbox } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { RequestsView } from '@/components/requests/requests-view';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { requireUser } from '@/lib/auth';
import { getRequests } from '@/lib/queries/requests';

export const metadata: Metadata = { title: 'Requests' };

/**
 * Requests page (Phase 5). One tabbed view over the `invitations` table —
 * Received / Sent / Accepted / Rejected — from the current user's point of view.
 * Received, still-pending requests can be accepted or declined here; accepting a
 * friend request links both accounts reciprocally (migration 0016). All rows are
 * resolved server-side (respecting RLS) and handed to the client {@link
 * RequestsView} for tab switching.
 */
export default async function RequestsPage() {
  await requireUser();
  const requests = await getRequests();

  const header = (
    <PageHeader
      eyebrow="People"
      title="Requests"
      description="Friend requests and invites you’ve sent or received."
    />
  );

  if (requests.length === 0) {
    return (
      <section className="space-y-6">
        {header}
        <EmptyState
          icon={<Inbox />}
          title="No requests yet"
          description="Add a friend by email and your sent request shows up here. Requests other people send you land here too, ready to accept or decline."
          action={
            <Button asChild variant="gradient">
              <Link href={ROUTES.friends}>Add a friend</Link>
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {header}
      <RequestsView items={requests} />
    </section>
  );
}
