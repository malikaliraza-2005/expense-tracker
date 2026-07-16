'use client';

import * as React from 'react';

import { Check, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * A shareable link that invites others to the app. Built from the current
 * origin so it works in any environment, tagged with the inviter's id as a
 * referral hint. Offers native share where available (mobile), with copy as the
 * universal fallback.
 */
export function AppInviteLink({ userId }: { userId: string }) {
  const [url, setUrl] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  // Build the link on the client so it reflects the real origin (no env needed).
  React.useEffect(() => {
    setUrl(`${window.location.origin}/register?ref=${userId}`);
  }, [userId]);

  function copy() {
    if (!url || !navigator.clipboard) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success('Invite link copied.');
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Expense Tracker',
          text: 'Split and track shared expenses with me.',
          url,
        });
      } catch {
        // User dismissed the share sheet — nothing to do.
      }
      return;
    }
    copy();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="Your app invite link"
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Copy invite link"
          onClick={copy}
          disabled={!url}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
        <Button
          type="button"
          variant="gradient"
          size="icon"
          aria-label="Share invite link"
          onClick={share}
          disabled={!url}
        >
          <Share2 />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Share this link so friends can join and split expenses with you.
      </p>
    </div>
  );
}
