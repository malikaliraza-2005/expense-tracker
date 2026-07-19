'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { ArrowLeftRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deleteSettlement, recordSettlement } from '@/actions/settlements';
import { useCurrency } from '@/components/providers/currency-provider';
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
import { cn } from '@/utils/cn';
import { parseAmountToCents } from '@/utils/money';

/**
 * "Settle up" with one member. Pre-fills the amount and the transfer direction
 * from the current net balance (they pay you when they owe, you pay them when
 * you owe), but the amount is editable so a partial payment can be recorded —
 * the balance engine nets whatever is entered and leaves any residual.
 */
export function SettleUpDialog({
  selfMemberId,
  memberId,
  memberName,
  netCents,
  groupId,
  expenseId,
  className,
}: {
  selfMemberId: string;
  memberId: string;
  memberName: string;
  /** > 0 they owe you; < 0 you owe them. */
  netCents: number;
  /** When set, the payment is recorded against this group's ledger only. */
  groupId?: string | null;
  expenseId?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const { format, symbol } = useCurrency();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const theyOweYou = netCents > 0;
  const magnitude = Math.abs(netCents);
  const [amount, setAmount] = React.useState(
    magnitude > 0 ? String(magnitude / 100) : '',
  );

  // The payer hands money to the receiver: they pay you when they owe you, you
  // pay them when you owe them.
  const payerId = theyOweYou ? memberId : selfMemberId;
  const receiverId = theyOweYou ? selfMemberId : memberId;
  const direction = theyOweYou
    ? `${memberName} paid you`
    : `You paid ${memberName}`;

  // Re-seed the amount whenever the dialog opens (the balance may have changed).
  React.useEffect(() => {
    if (open) setAmount(magnitude > 0 ? String(magnitude / 100) : '');
  }, [open, magnitude]);

  function onConfirm() {
    const amountCents = parseAmountToCents(amount);
    if (amountCents <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    // A payment can clear at most the remaining balance — partial is fine, more
    // is not (it would flip the balance the other way).
    if (amountCents > magnitude) {
      toast.error('Amount can’t exceed the remaining balance.');
      return;
    }
    startTransition(async () => {
      const result = await recordSettlement({
        payerId,
        receiverId,
        amountCents,
        note: null,
        expenseId: expenseId ?? null,
        groupId: groupId ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Payment recorded.');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('shrink-0', className)}
        >
          <ArrowLeftRight />
          Settle up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle up with {memberName}</DialogTitle>
          <DialogDescription>
            Record a payment to clear the balance. {direction} — edit the amount
            to record a partial payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="settle-amount">Amount</Label>
          <div className="flex h-12 items-center rounded-lg border border-input bg-background/60 pl-3.5 pr-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/40">
            <span className="select-none text-lg font-semibold text-muted-foreground">
              {symbol}
            </span>
            <input
              id="settle-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max={magnitude > 0 ? magnitude / 100 : undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={isPending}
              autoFocus
              className="h-full w-full flex-1 bg-transparent pl-2 text-lg font-semibold tabular-nums outline-none disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Current balance: {format(magnitude)}{' '}
            {theyOweYou ? 'owed to you' : 'you owe'}.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="gradient" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Recording…' : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Settle up" for a directed debt between any two members (the Who-owes-whom
 * view), where neither side need be the owner. Records `from` paying `to` toward
 * what `from` owes; the amount is editable for a partial payment but capped at
 * the remaining balance. Scoped to a group when `groupId` is set.
 */
export function LedgerSettleUpDialog({
  fromId,
  fromName,
  toId,
  toName,
  amountCents,
  groupId,
  className,
}: {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  /** Remaining amount `from` owes `to` (> 0). */
  amountCents: number;
  groupId?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const { format, symbol } = useCurrency();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [amount, setAmount] = React.useState(String(amountCents / 100));

  // Re-seed on open — the balance may have shifted since last time.
  React.useEffect(() => {
    if (open) setAmount(String(amountCents / 100));
  }, [open, amountCents]);

  function onConfirm() {
    const cents = parseAmountToCents(amount);
    if (cents <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    if (cents > amountCents) {
      toast.error('Amount can’t exceed the remaining balance.');
      return;
    }
    startTransition(async () => {
      const result = await recordSettlement({
        payerId: fromId,
        receiverId: toId,
        amountCents: cents,
        note: null,
        groupId: groupId ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Payment recorded.');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('shrink-0', className)}
        >
          <ArrowLeftRight />
          Settle up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle up</DialogTitle>
          <DialogDescription>
            Record {fromName} paying {toName} toward this balance. Edit the
            amount to record a partial payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <span className="min-w-0 truncate font-medium">{fromName}</span>
            <ArrowLeftRight className="mx-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate font-medium">{toName}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ledger-settle-amount">Amount</Label>
            <div className="flex h-12 items-center rounded-lg border border-input bg-background/60 pl-3.5 pr-2 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/40">
              <span className="select-none text-lg font-semibold text-muted-foreground">
                {symbol}
              </span>
              <input
                id="ledger-settle-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={amountCents / 100}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={isPending}
                autoFocus
                className="h-full w-full flex-1 bg-transparent pl-2 text-lg font-semibold tabular-nums outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Remaining balance: {format(amountCents)}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="gradient" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Recording…' : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a recorded settlement, restoring the balance it had cleared. */
export function DeleteSettlementButton({
  settlementId,
  label,
}: {
  settlementId: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteSettlement({ settlementId });
      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      toast.success('Payment removed.');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Remove payment: ${label}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground/70 outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4"
        >
          <Trash2 />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this payment?</DialogTitle>
          <DialogDescription>
            {label}. Removing it restores the balance this payment had cleared.
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
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? 'Removing…' : 'Remove payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
