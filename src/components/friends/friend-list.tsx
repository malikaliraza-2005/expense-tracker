'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { removeFriend } from '@/actions/friends';
import { BalanceLabel } from '@/components/common/money';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { FriendWithBalance } from '@/types/dto';

/**
 * Friends list (Client Component). Renders each friend with their net balance,
 * a client-side name filter (the Phase 3 "search"), and a remove control that
 * calls the `removeFriend` action and refreshes. Empty and no-match states are
 * both handled here.
 */
export function FriendList({ friends }: { friends: FriendWithBalance[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? friends.filter((friend) =>
        (friend.profile.full_name || '').toLowerCase().includes(normalized),
      )
    : friends;

  function onRemove(friendId: string, name: string) {
    setRemovingId(friendId);
    startTransition(async () => {
      const result = await removeFriend({ friendId });
      setRemovingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${name || 'friend'}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search friends by name"
          aria-label="Search friends by name"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No friends match “{query}”.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((friend) => {
            const name = friend.profile.full_name || 'Unnamed';
            const isRemoving = isPending && removingId === friend.profile.id;
            return (
              <li key={friend.friendshipId}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <Link
                    href={`/friends/${friend.profile.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar
                      name={friend.profile.full_name}
                      src={friend.profile.avatar_url}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      <BalanceLabel netCents={friend.netCents} subject="them" />
                    </div>
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${name}`}
                    disabled={isRemoving}
                    onClick={() => onRemove(friend.profile.id, name)}
                  >
                    <Trash2 />
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
