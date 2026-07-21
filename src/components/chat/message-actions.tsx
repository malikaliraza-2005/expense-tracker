'use client';

import { MoreVertical, Trash2, UserRoundX } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/utils/cn';

/**
 * The per-message overflow menu, shared by DM and per-expense chat. Offers **Delete for
 * me** on any message (hides it from your own view) and, on your own not-yet-deleted
 * messages, **Delete for everyone** (retracts it for all participants). The parent binds
 * both callbacks to the specific message and decides whether "for everyone" is allowed.
 *
 * The trigger is a faint kebab that stays visible on touch (no hover there) and appears
 * on hover/focus on pointer devices, so it never clutters the thread yet is always
 * reachable. `align` points the menu back toward the bubble (own messages sit right).
 */
export function MessageActions({
  align,
  canDeleteForEveryone,
  onDeleteForMe,
  onDeleteForEveryone,
}: {
  align: 'start' | 'end';
  canDeleteForEveryone: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Message options"
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:opacity-100',
            'opacity-60 sm:opacity-0 sm:group-hover:opacity-100',
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[11rem]">
        <DropdownMenuItem onSelect={onDeleteForMe}>
          <UserRoundX className="mr-2 h-4 w-4" />
          Delete for me
        </DropdownMenuItem>
        {canDeleteForEveryone ? (
          <DropdownMenuItem
            onSelect={onDeleteForEveryone}
            className="text-expense focus:text-expense"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete for everyone
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
