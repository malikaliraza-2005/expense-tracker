'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { HandCoins } from 'lucide-react';
import { toast } from 'sonner';

import { recordSettlement } from '@/actions/settlements';
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
import { Select } from '@/components/ui/select';
import {
  validateRecordSettlement,
  type RecordSettlementInput,
} from '@/schemas/settlement.schema';
import { centsToDecimal, parseAmountToCents } from '@/utils/money';

/** A candidate party in a settlement (the current user plus counterparties). */
export interface SettlePerson {
  id: string;
  name: string;
}

export interface SettleUpDialogProps {
  /** Null for a personal settlement; a group id scopes it to that group. */
  groupId?: string | null;
  /** Everyone who may be a party — includes the current user (labelled "You"). */
  people: SettlePerson[];
  /** Preselected payer (defaults to the first person). */
  defaultPayerId?: string;
  /** Preselected receiver (defaults to the first person who isn't the payer). */
  defaultReceiverId?: string;
  /** Prefilled amount in cents (e.g. the outstanding balance). */
  defaultAmountCents?: number;
}

type FieldErrors = Partial<Record<keyof RecordSettlementInput, string>>;

function amountToInput(cents: number | undefined): string {
  if (!cents || cents <= 0) return '';
  return centsToDecimal(cents).toFixed(2);
}

/**
 * Settle Up dialog (Client Component). Records a real transfer between two people
 * to clear (part of) a balance. Validation lives in the shared settlement schema;
 * the `recordSettlement` Server Action re-validates, authorizes both parties, and
 * writes the row. Reused by the friend and group balance views.
 */
export function SettleUpDialog({
  groupId = null,
  people,
  defaultPayerId,
  defaultReceiverId,
  defaultAmountCents,
}: SettleUpDialogProps) {
  const router = useRouter();
  const firstId = people[0]?.id ?? '';
  const initialPayer = defaultPayerId ?? firstId;
  const initialReceiver =
    defaultReceiverId ?? people.find((p) => p.id !== initialPayer)?.id ?? '';

  const [open, setOpen] = React.useState(false);
  const [payerId, setPayerId] = React.useState(initialPayer);
  const [receiverId, setReceiverId] = React.useState(initialReceiver);
  const [amount, setAmount] = React.useState(amountToInput(defaultAmountCents));
  const [note, setNote] = React.useState('');
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  function reset() {
    setPayerId(initialPayer);
    setReceiverId(initialReceiver);
    setAmount(amountToInput(defaultAmountCents));
    setNote('');
    setErrors({});
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = {
      groupId,
      payerId,
      receiverId,
      amountCents: parseAmountToCents(amount),
      note,
    };

    const parsed = validateRecordSettlement(input);
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await recordSettlement(parsed.data);
      if (!result.ok) {
        setErrors({ amountCents: result.error });
        return;
      }
      toast.success('Settlement recorded.');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HandCoins />
          Settle up
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Settle up</DialogTitle>
            <DialogDescription>
              Record a payment between two people. This clears the matching
              balance — it doesn&apos;t move any real money.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="settle-payer">Who paid</Label>
              <Select
                id="settle-payer"
                value={payerId}
                onChange={(event) => setPayerId(event.target.value)}
                disabled={isPending}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
              {errors.payerId ? (
                <p className="text-sm text-destructive">{errors.payerId}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settle-receiver">Who was paid</Label>
              <Select
                id="settle-receiver"
                value={receiverId}
                onChange={(event) => setReceiverId(event.target.value)}
                disabled={isPending}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
              {errors.receiverId ? (
                <p className="text-sm text-destructive">{errors.receiverId}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settle-amount">Amount</Label>
              <Input
                id="settle-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(errors.amountCents)}
                disabled={isPending}
                autoFocus
              />
              {errors.amountCents ? (
                <p className="text-sm text-destructive">{errors.amountCents}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="settle-note">Note (optional)</Label>
              <Input
                id="settle-note"
                name="note"
                type="text"
                placeholder="e.g. Venmo, cash"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-invalid={Boolean(errors.note)}
                disabled={isPending}
              />
              {errors.note ? (
                <p className="text-sm text-destructive">{errors.note}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Recording…' : 'Record settlement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
