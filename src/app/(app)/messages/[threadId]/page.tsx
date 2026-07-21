import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DmThread } from '@/components/messages/dm-thread';
import { getDmThread } from '@/lib/queries/dm';

export const metadata: Metadata = { title: 'Conversation' };

/**
 * One DM conversation. Loads the thread's history server-side (RLS returns it only to
 * the two participants, so an outsider or a bad id both 404), then hands it to the
 * realtime {@link DmThread} client. The thread renders its own fixed header (name +
 * avatar) so it, the composer, and the scrolling message list form one bounded frame.
 * The global back button returns to /messages.
 */
export default async function DmThreadPage({
  params,
}: {
  params: { threadId: string };
}) {
  const data = await getDmThread(params.threadId);
  if (!data) notFound();

  return <DmThread data={data} />;
}
