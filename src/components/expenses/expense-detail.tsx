'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Check, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { deleteExpense } from '@/actions/expenses';
import { LocalDate } from '@/components/common/local-date';
import { Money } from '@/components/common/money';
import { SettleToggle } from '@/components/expenses/settle-toggle';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { categoryIcon } from '@/constants/categories';
import { ROUTES } from '@/constants/routes';
import type { ExpenseDetail as ExpenseDetailData } from '@/types/dto';

/**
 * Expense detail view. Shows the expense fields, its category, payer, group, and
 * every participant's equal share, with edit and delete controls; delete confirms
 * first and reverses balances on success.
 */
export function ExpenseDetail({
  detail,
}: {
  detail: ExpenseDetailData;
  /** Accepted for call-site compatibility; the "You" label uses `is_self`. */
  currentUserId?: string;
}) {
  const { expense, category, payer, participants } = detail;
  const Icon = categoryIcon(category.icon);
  const payerName = payer.is_self ? 'You' : payer.name;
  const settled = Boolean(expense.settled_at);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
            <Icon />
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {expense.title}
              </h1>
              {settled ? (
                <Badge variant="success">
                  <Check className="h-3 w-3" />
                  Settled
                </Badge>
              ) : (
                <Badge variant="warning">Outstanding</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {category.name} · <LocalDate value={expense.expense_date} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SettleToggle expenseId={expense.id} settled={settled} />
          <Button asChild variant="outline" size="sm">
            <Link href={`/expenses/${expense.id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <DeleteExpenseButton expenseId={expense.id} title={expense.title} />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Amount">
            <Money cents={expense.amount_cents} className="font-medium" />
          </Row>
          <Row label="Paid by">{payerName}</Row>
          <Row label="Status">
            {settled ? (
              <Badge variant="success">
                <Check className="h-3 w-3" />
                Settled
              </Badge>
            ) : (
              <Badge variant="warning">Outstanding</Badge>
            )}
          </Row>
          <Row label="Split">
            <Badge variant="secondary">Split equally</Badge>
          </Row>
          {expense.notes ? <Row label="Notes">{expense.notes}</Row> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Split between</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {participants.map((participant) => {
              const name = participant.member.is_self
                ? 'You'
                : participant.member.name;
              return (
                <li
                  key={participant.member.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={participant.member.name} className="h-8 w-8" />
                    <span className="truncate text-sm">{name}</span>
                  </span>
                  <Money
                    cents={participant.shareCents}
                    className="text-sm font-medium"
                  />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/** Creator-only delete control with a confirmation dialog. */
function DeleteExpenseButton({
  expenseId,
  title,
}: {
  expenseId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await deleteExpense({ expenseId });
      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      toast.success('Expense deleted.');
      router.push(ROUTES.expenses);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{title}”?</DialogTitle>
          <DialogDescription>
            This removes the expense and its splits, and reverses the related
            balances. This cannot be undone.
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
            {isPending ? 'Deleting…' : 'Delete expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
