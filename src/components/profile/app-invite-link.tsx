'use client';

import * as React from 'react';

import { Check, Copy, Link2, Send, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { inviteMemberByEmail } from '@/actions/invite';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Mode = 'email' | 'link';

interface Outcome {
  mode: Mode;
  link: string;
  emailed: boolean;
  deliveryConfigured: boolean;
}

/** Turn "ada@example.com" into a friendly default name ("Ada"). */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? '';
  if (!local) return email;
  return local
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Invite a friend to the app from the profile page. Unlike the old share-only
 * link, this records a real invitation (via `inviteMemberByEmail`) and can email
 * it directly when Resend is configured, falling back to a copyable
 * `/invite/<token>` link otherwise. An optional name seeds the created member;
 * when blank we derive one from the email so the invite always has a target.
 */
export function AppInviteLink() {
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function copyToClipboard(link: string, announce = true) {
    if (!link || !navigator.clipboard) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      if (announce) toast.success('Invite link copied.');
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  async function shareLink(link: string) {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Expense Tracker',
          text: 'Split and track shared expenses with me.',
          url: link,
        });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    copyToClipboard(link);
  }

  function run(mode: Mode) {
    const trimmed = email.trim();
    startTransition(async () => {
      const result = await inviteMemberByEmail(
        { email: trimmed, name: name.trim() || nameFromEmail(trimmed) },
        { send: mode === 'email' },
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { link, emailed, deliveryConfigured } = result.data;
      setOutcome({ mode, link, emailed, deliveryConfigured });

      if (mode === 'link') {
        copyToClipboard(link, false);
        toast.success('Invite link copied.');
      } else if (emailed) {
        toast.success(`Invite emailed to ${trimmed}.`);
      } else {
        toast.message('Invite link ready — copy it to share.');
      }
    });
  }

  /** Explainer for the result view, tailored to how the invite was produced. */
  function resultMessage(o: Outcome): string {
    if (o.mode === 'link') {
      return 'Here’s the invite link — share it however you like:';
    }
    if (o.emailed) {
      return 'Invite sent. You can also copy this link to share directly:';
    }
    if (!o.deliveryConfigured) {
      return 'Email delivery isn’t set up yet, so nothing was sent. Copy this link and share it instead:';
    }
    return 'We couldn’t send the email just now. Copy this link to share, or try again.';
  }

  function reset() {
    setOutcome(null);
    setCopied(false);
  }

  if (outcome) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{resultMessage(outcome)}</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={outcome.link}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Invite link"
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
          <Button
            type="button"
            variant="gradient"
            size="icon"
            aria-label="Share invite link"
            onClick={() => shareLink(outcome.link)}
          >
            <Share2 />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Invite someone else
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="invite-friend-email">Friend’s email</Label>
        <Input
          id="invite-friend-email"
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
              if (email.trim()) run('email');
            }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-friend-name">Name (optional)</Label>
        <Input
          id="invite-friend-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ada Lovelace"
          disabled={isPending}
          maxLength={60}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="gradient"
          onClick={() => run('email')}
          disabled={isPending || !email.trim()}
        >
          <Send />
          {isPending ? 'Working…' : 'Send invite'}
        </Button>
        <Button
          variant="outline"
          onClick={() => run('link')}
          disabled={isPending || !email.trim()}
        >
          <Link2 />
          Copy link
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        We’ll email them an invite to join and split expenses with you. No email
        set up? Use “Copy link” to share it yourself.
      </p>
    </div>
  );
}
