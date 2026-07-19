import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { DmThread } from '@/components/messages/dm-thread';
import { Avatar } from '@/components/ui/avatar';
import { getDmThread } from '@/lib/queries/dm';

export const metadata: Metadata = { title: 'Conversation' };

/**
 * One DM conversation. Loads the thread's history server-side (RLS returns it only to
 * the two participants, so an outsider or a bad id both 404), then hands it to the
 * realtime {@link DmThread} client. The global back button returns to /messages.
 */
export default async function DmThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const data = await getDmThread(params.threadId);
  if (!data) notFound();

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Direct message"
        title={data.otherName}
        action={<Avatar name={data.otherName} className="h-10 w-10" />}
      />
      <DmThread data={data} />
    </section>
  );
}
