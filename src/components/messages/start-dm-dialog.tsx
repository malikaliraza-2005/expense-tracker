'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { MessageSquarePlus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { openDmThread } from '@/actions/dm';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/constants/routes';
import type { DmCandidate } from '@/types/dto';

/**
 * "New message" dialog. Lists the current user's connected accounts (people they can
 * DM) with a quick filter, and on pick opens — or reuses — the one shared thread with
 * that person via {@link openDmThread}, then navigates into it. The candidate set comes
 * from the server; a person with no account can't be messaged and never appears here.
 */
export function StartDmDialog({
  candidates,
  triggerLabel = 'New message',
}: {
  candidates: DmCandidate[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setPendingId(null);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q));
  }, [candidates, query]);

  function start(candidate: DmCandidate) {
    if (isPending) return;
    setPendingId(candidate.userId);
    startTransition(async () => {
      const res = await openDmThread({ otherUserId: candidate.userId });
      if (!res.ok) {
        toast.error(res.error);
        setPendingId(null);
        return;
      }
      setOpen(false);
      router.push(`${ROUTES.messageThread}/${res.data.threadId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient">
          <MessageSquarePlus />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            Start a conversation with a friend who’s on the app. You can only message
            people you’re connected with.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You don’t have any connections yet. Add a friend who’s on the app to start
            messaging.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search connections"
                aria-label="Search connections"
                className="pl-9"
                autoFocus
              />
            </div>
            <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No one matches “{query.trim()}”.
                </li>
              ) : (
                filtered.map((candidate) => (
                  <li key={candidate.userId}>
                    <button
                      type="button"
                      onClick={() => start(candidate)}
                      disabled={isPending}
                      className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-80 disabled:opacity-50"
                    >
                      <Avatar name={candidate.name} className="h-9 w-9" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {candidate.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {candidate.hasThread
                            ? 'Open conversation'
                            : 'Start a conversation'}
                        </span>
                      </span>
                      {pendingId === candidate.userId ? (
                        <span className="text-xs text-muted-foreground">Opening…</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
