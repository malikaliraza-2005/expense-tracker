'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { Handshake, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { settleWithMember } from '@/actions/settlements';
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
import { useCurrency } from '@/components/providers/currency-provider';

/**
 * Settle a balance that lives in someone else's ledger — the other half of symmetric
 * settling. The amount defaults to the full outstanding figure and is capped at it
 * (the server re-checks, so an already-settled balance can't be paid twice). Recording
 * writes one shared row, notifies both accounts, and realtime clears the balance from
 * every page on both sides.
 */
export function SharedSettleDialog({
  memberId,
  counterpartyName,
  netCents,
}: {
  /** The member representing me in their ledger — the settle target. */
  memberId: string;
  counterpartyName: string;
  /** Net from my perspective: > 0 they owe me; < 0 I owe them. */
  netCents: number;
}) {
  const router = useRouter();
  const { format, symbol } = useCurrency();
  const outstanding = Math.abs(netCents);
  const iOwe = netCents < 0;

  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(String(outstanding / 100));
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setAmount(String(outstanding / 100));
  }, [open, outstanding]);

  function submit() {
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error('Enter an amount greater than zero.');
      return;
    }
    startTransition(async () => {
      const result = await settleWithMember({ memberId, amountCents: cents });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Settled ${format(cents)} with ${counterpartyName}.`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0">
          <Handshake />
          Settle up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle up with {counterpartyName}</DialogTitle>
          <DialogDescription>
            {iOwe
              ? `You owe ${counterpartyName} ${format(outstanding)}. Recording this updates both of your balances.`
              : `${counterpartyName} owes you ${format(outstanding)}. Recording this updates both of your balances.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="shared-settle-amount">Amount ({symbol})</Label>
          <Input
            id="shared-settle-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={isPending}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Up to {format(outstanding)} outstanding.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="gradient" onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : <Handshake />}
            {isPending ? 'Recording…' : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
