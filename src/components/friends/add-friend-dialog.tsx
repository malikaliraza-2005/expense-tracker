'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Copy, Link2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { addFriend, type FriendAddOutcome } from '@/actions/invite';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Result {
  outcome: FriendAddOutcome;
  memberName: string;
  link: string;
  emailed: boolean;
  deliveryConfigured: boolean;
}

/**
 * "Add friend" dialog. Takes a name (how the friend shows in your roster) and an
 * email, then either **Add friend** — which routes to an in-app request if the
 * email already has an account, or an email invite if it doesn't — or **Copy
 * link**, which mints a shareable `/invite/<token>` to send yourself. Both go
 * through the {@link addFriend} action; the result view explains what happened and
 * surfaces the link to copy when there is one.
 */
export function AddFriendDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [result, setResult] = React.useState<Result | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Reset transient state each time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  function copyToClipboard(link: string, announce = true) {
    if (!link || !navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      if (announce) toast.success('Link copied.');
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  const canSubmit = Boolean(name.trim() && email.trim());

  function run(mode: 'auto' | 'link') {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await addFriend(
        { name: name.trim(), email: email.trim() },
        { mode },
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const data = res.data;
      setResult(data);

      if (data.outcome === 'link') {
        copyToClipboard(data.link, false);
        toast.success('Invite link copied.');
      } else if (data.outcome === 'request') {
        toast.success(`Friend request sent to ${data.memberName}.`);
      } else if (data.emailed) {
        toast.success(`Invite emailed to ${data.memberName}.`);
      } else {
        toast.message('Invite link ready — copy it to share.');
      }
      // Reflect the new friend/pending row on the page behind the dialog.
      router.refresh();
    });
  }

  /** The result-view explainer, tailored to how the add resolved. */
  function resultMessage(r: Result): string {
    if (r.outcome === 'request') {
      return `${r.memberName} already has an account — we sent them a friend request. They’ll see it in their Requests.`;
    }
    if (r.outcome === 'link') {
      return `Here’s ${r.memberName}’s invite link — share it however you like:`;
    }
    if (r.emailed) {
      return `We emailed ${r.memberName} an invite to join. You can also copy this link to share directly:`;
    }
    if (!r.deliveryConfigured) {
      return `Email delivery isn’t set up yet, so nothing was sent. Copy this link and share it with ${r.memberName} instead:`;
    }
    return `We couldn’t send the email just now. Copy this link to share, or try again.`;
  }

  // A friend request needs no link; every other outcome surfaces one to copy.
  const showLink = result !== null && result.outcome !== 'request';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gradient">
          <UserPlus />
          Add friend
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
          <DialogDescription>
            Add someone by email. If they already have an account we’ll send a
            friend request; otherwise we’ll email them an invite to join. You can
            also copy a link to share yourself.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="friend-name">Name</Label>
              <Input
                id="friend-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="How they show in your list"
                disabled={isPending}
                autoFocus
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="friend-email">Email</Label>
              <Input
                id="friend-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={isPending}
                maxLength={200}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (canSubmit) run('auto');
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {resultMessage(result)}
            </p>
            {showLink ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={result.link}
                  onFocus={(event) => event.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Copy invite link"
                  onClick={() => copyToClipboard(result.link)}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="outline"
                onClick={() => run('link')}
                disabled={isPending || !canSubmit}
              >
                <Link2 />
                Copy link
              </Button>
              <Button
                variant="gradient"
                onClick={() => run('auto')}
                disabled={isPending || !canSubmit}
              >
                <UserPlus />
                {isPending ? 'Working…' : 'Add friend'}
              </Button>
            </>
          ) : (
            <DialogClose asChild>
              <Button variant="gradient">Done</Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
