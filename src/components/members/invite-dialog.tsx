'use client';

import * as React from 'react';

import { Check, Copy, Link2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { inviteMemberByEmail } from '@/actions/invite';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'email' | 'link';

interface Outcome {
  mode: Mode;
  link: string;
  emailed: boolean;
  deliveryConfigured: boolean;
}

/**
 * Invite-by-email dialog. Offers two explicit choices for one of the owner's
 * people: **Send email** (delivers the invite via Resend when configured) or
 * **Copy link** (mints the same `/invite/<token>` accept link to share manually).
 * Either way the invitation is recorded and the link is shown, so the flow works
 * with or without an email provider. An optional `targetExpenseId` deep-links the
 * invitee straight to that expense after they register.
 *
 * Controlled: the parent owns `open`/`onOpenChange` and renders its own trigger.
 */
export function InviteByEmailDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  defaultEmail,
  targetExpenseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  defaultEmail?: string | null;
  targetExpenseId?: string;
}) {
  const [email, setEmail] = React.useState(defaultEmail ?? '');
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Reset transient state each time the dialog opens, seeding the known email.
  React.useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? '');
      setOutcome(null);
      setCopied(false);
    }
  }, [open, defaultEmail]);

  function copyToClipboard(link: string, announce = true) {
    if (!link || !navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      if (announce) toast.success('Link copied.');
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function run(mode: Mode) {
    startTransition(async () => {
      const result = await inviteMemberByEmail(
        { memberId, email: email.trim(), targetExpenseId },
        { send: mode === 'email' },
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { link, emailed, deliveryConfigured } = result.data;
      setOutcome({ mode, link, emailed, deliveryConfigured });

      if (mode === 'link') {
        // Copy immediately — the whole point of this action is the shareable link.
        copyToClipboard(link, false);
        toast.success('Invite link copied.');
      } else if (emailed) {
        toast.success(`Invite emailed to ${email.trim()}.`);
      } else {
        toast.message('Invite link ready — copy it to share.');
      }
    });
  }

  /** The result-view explainer, tailored to how the invite was produced. */
  function resultMessage(o: Outcome): string {
    if (o.mode === 'link') {
      return `Here’s ${memberName}’s invite link — share it however you like:`;
    }
    if (o.emailed) {
      return `We emailed ${memberName} an invite. You can also copy this link to share directly:`;
    }
    if (!o.deliveryConfigured) {
      return `Email delivery isn’t set up yet, so nothing was sent. Copy this link and share it with ${memberName} instead:`;
    }
    return `We couldn’t send the email just now. Copy this link to share, or try again.`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {memberName} to the app</DialogTitle>
          <DialogDescription>
            {targetExpenseId
              ? `Email ${memberName} an invite, or copy a link to share yourself. Once they register they’ll land on this expense and can see the full split.`
              : `Email ${memberName} an invite, or copy a link to share yourself, so they can create an account and see what they owe or are owed.`}
          </DialogDescription>
        </DialogHeader>

        {!outcome ? (
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              disabled={isPending}
              autoFocus
              maxLength={200}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (email.trim()) run('email');
                }
              }}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{resultMessage(outcome)}</p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={outcome.link}
                onFocus={(event) => event.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy invite link"
                onClick={() => copyToClipboard(outcome.link)}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {!outcome ? (
            <>
              <DialogClose asChild>
                <Button variant="ghost" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="outline"
                onClick={() => run('link')}
                disabled={isPending || !email.trim()}
              >
                <Link2 />
                Copy link
              </Button>
              <Button
                variant="gradient"
                onClick={() => run('email')}
                disabled={isPending || !email.trim()}
              >
                <Send />
                {isPending ? 'Working…' : 'Send email'}
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
