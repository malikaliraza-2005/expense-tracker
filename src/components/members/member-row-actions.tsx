'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Check, Copy, Mail, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deleteMember, renameMember } from '@/actions/members';
import { createShareLink, revokeShareLink } from '@/actions/share';
import { InviteByEmailDialog } from '@/components/members/invite-dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Per-person actions on the People list: rename or remove. Both open a focused
 * dialog from a small overflow menu so the controls stay out of the way until
 * needed. Remove confirms first and surfaces the server-side guard message when
 * the person is still tied to expenses or settlements (they can't be deleted
 * without corrupting that history).
 */
export function MemberRowActions({
  memberId,
  memberName,
  memberEmail,
}: {
  memberId: string;
  memberName: string;
  memberEmail?: string | null;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [removeOpen, setRemoveOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState('');
  const [shareToken, setShareToken] = React.useState('');
  const [shareLoading, setShareLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [name, setName] = React.useState(memberName);
  const [email, setEmail] = React.useState(memberEmail ?? '');
  const [isPending, startTransition] = React.useTransition();

  function openShare() {
    setShareOpen(true);
    setShareUrl('');
    setShareToken('');
    setCopied(false);
    setShareLoading(true);
    createShareLink({ memberId }).then((result) => {
      setShareLoading(false);
      if (!result.ok) {
        toast.error(result.error);
        setShareOpen(false);
        return;
      }
      setShareToken(result.data.token);
      setShareUrl(`${window.location.origin}/share/${result.data.token}`);
    });
  }

  function copyShare() {
    if (!shareUrl || !navigator.clipboard) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast.success('Link copied.');
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  function revokeShare() {
    startTransition(async () => {
      const result = await revokeShareLink({ token: shareToken });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Link revoked.');
      setShareOpen(false);
      router.refresh();
    });
  }

  function onRename() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Name is required.');
      return;
    }
    startTransition(async () => {
      const result = await renameMember({
        memberId,
        name: trimmed,
        email: email.trim(),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Person updated.');
      setRenameOpen(false);
      router.refresh();
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await deleteMember({ memberId });
      if (!result.ok) {
        toast.error(result.error);
        setRemoveOpen(false);
        return;
      }
      toast.success(`Removed ${memberName}.`);
      setRemoveOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${memberName}`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-5 [&_svg]:w-5"
          >
            <MoreHorizontal />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="gap-2"
            onSelect={(event) => {
              event.preventDefault();
              setInviteOpen(true);
            }}
          >
            <Mail className="h-4 w-4" />
            Invite to app
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onSelect={(event) => {
              event.preventDefault();
              openShare();
            }}
          >
            <Share2 className="h-4 w-4" />
            Share balance
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onSelect={(event) => {
              event.preventDefault();
              setName(memberName);
              setEmail(memberEmail ?? '');
              setRenameOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={(event) => {
              event.preventDefault();
              setRemoveOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Invite to app */}
      <InviteByEmailDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        memberId={memberId}
        memberName={memberName}
        defaultEmail={memberEmail}
      />

      {/* Rename */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit person</DialogTitle>
            <DialogDescription>
              Update the name and email shown across expenses and balances.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-rename">Name</Label>
              <Input
                id="member-rename"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isPending}
                autoFocus
                maxLength={60}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onRename();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-email">Email (optional)</Label>
              <Input
                id="member-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isPending}
                placeholder="name@example.com"
                maxLength={200}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="gradient"
              onClick={onRename}
              disabled={isPending || !name.trim()}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share balance */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share {memberName}&apos;s balance</DialogTitle>
            <DialogDescription>
              Anyone with this link can see — read-only — what {memberName} owes
              you or is owed. No account needed. Revoke it anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareLoading ? 'Generating link…' : shareUrl}
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy link"
              onClick={copyShare}
              disabled={shareLoading || !shareUrl}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={revokeShare}
              disabled={isPending || shareLoading || !shareToken}
            >
              {isPending ? 'Revoking…' : 'Revoke link'}
            </Button>
            <DialogClose asChild>
              <Button variant="gradient">Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {memberName}?</DialogTitle>
            <DialogDescription>
              This removes them from your people. If they&apos;re part of any
              expense or payment, you&apos;ll need to clear that history first.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={onRemove}
              disabled={isPending}
            >
              {isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
