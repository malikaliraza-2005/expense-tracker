'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { addFriend } from '@/actions/friends';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateAddFriend } from '@/schemas/friend.schema';

/**
 * Add-friend dialog (Client Component). Validation lives in the shared schema;
 * the `addFriend` Server Action performs the resolve + write. Shows the inline
 * "no account found" (and other) errors returned by the action and refreshes the
 * list on success.
 */
export function AddFriendDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');

    const parsed = validateAddFriend({ email });
    if (!parsed.success) {
      setError(parsed.errors.email);
      return;
    }
    setError(undefined);

    startTransition(async () => {
      const result = await addFriend(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${result.data.full_name || 'Friend'} added.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          Add friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Add a friend</DialogTitle>
            <DialogDescription>
              Enter the email of a registered account. Friends must already have
              an account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="friend-email">Email</Label>
            <Input
              id="friend-email"
              name="email"
              type="email"
              autoComplete="off"
              placeholder="friend@example.com"
              aria-invalid={Boolean(error)}
              disabled={isPending}
              autoFocus
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Adding…' : 'Add friend'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
