'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Check, Eye, Mail, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { deleteExpense, removeExpenseMember } from '@/actions/expenses';
import { LocalDate } from '@/components/common/local-date';
import { Money } from '@/components/common/money';
import { SettleToggle } from '@/components/expenses/settle-toggle';
import { InviteByEmailDialog } from '@/components/members/invite-dialog';
import {
  DeleteSettlementButton,
  SettleUpDialog,
} from '@/components/settlements/settlement-controls';
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

/** A settlement between the owner and a participant, for the delete-payment UI. */
export interface ExpensePayment {
  id: string;
  /** Human line, e.g. "You paid Ali" / "Ali paid you". */
  label: string;
  amountCents: number;
  settledAt: string;
}

/**
 * Expense detail view. Shows the expense fields, its category, payer, group, and
 * a per-member ledger (paid / owed / remaining) for every participant. The owner
 * gets edit/delete/settle controls, a per-member remove button, in-place settle-up,
 * and a payments history they can undo; a shared viewer sees it read-only.
 */
export function ExpenseDetail({
  detail,
  currentUserId,
  isOwner = true,
  selfMemberId = null,
  netByMember = {},
  payments = [],
}: {
  detail: ExpenseDetailData;
  /** The viewing user's id; drives the "You" label from the reader's own member. */
  currentUserId?: string;
  /**
   * True when the viewer owns this expense (full edit/settle/delete controls);
   * false for a shared (claimed-participant) viewer, who sees it read-only.
   */
  isOwner?: boolean;
  /** The owner's self-member id — the "you" side of any settle-up. Owner only. */
  selfMemberId?: string | null;
  /**
   * The owner's net balance with each participant, keyed by member id: > 0 they
   * owe you, < 0 you owe them. Scoped to this expense's group when it has one.
   * Drives the settle-up amount/direction; absent members are square. Owner only.
   */
  netByMember?: Record<string, number>;
  /** Recorded payments between the owner and this expense's people. Owner only. */
  payments?: ExpensePayment[];
}) {
  const { expense, category, payer, participants } = detail;
  // Fewer than three participants can't lose one (a split needs at least two),
  // so the remove control is hidden rather than shown-then-rejected.
  const canRemoveMembers = isOwner && participants.length > 2;
  const Icon = categoryIcon(category.icon);
  // "You" is the reader's own member: their claimed member (linked_user_id) or,
  // for the owner, their self-member. Never label the owner "You" to a participant.
  const isMe = React.useCallback(
    (member: { linked_user_id: string | null; is_self: boolean }): boolean =>
      (currentUserId != null && member.linked_user_id === currentUserId) ||
      (isOwner && member.is_self),
    [currentUserId, isOwner],
  );
  const payerIsMe = isMe(payer);
  const payerName = payerIsMe ? 'You' : payer.name;
  const settled = Boolean(expense.settled_at);
  // Why they owe: the expense's own description, falling back to its title.
  const reason = expense.description?.trim() || expense.title;

  // The participant currently being invited to this expense (null = closed).
  const [inviteFor, setInviteFor] = React.useState<{
    id: string;
    name: string;
    email: string | null;
  } | null>(null);

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
        <div className="flex flex-wrap items-center gap-2">
          {isOwner ? (
            <>
              <SettleToggle expenseId={expense.id} settled={settled} />
              <Button asChild variant="outline" size="sm">
                <Link href={`/expenses/${expense.id}/edit`}>
                  <Pencil />
                  Edit
                </Link>
              </Button>
              <DeleteExpenseButton expenseId={expense.id} title={expense.title} />
            </>
          ) : (
            <Badge variant="secondary">
              <Eye className="h-3 w-3" />
              Shared with you · view only
            </Badge>
          )}
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
          <CardTitle className="text-base">Who owes whom</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border/50">
            {participants.map((participant) => {
              const member = participant.member;
              const pIsMe = isMe(member);
              const name = pIsMe ? 'You' : member.name;
              const isPayer = member.id === payer.id;
              // State the debt relationship in plain words, from the reader's
              // point of view: the payer is owed; everyone else owes the payer.
              const relationship = isPayer
                ? 'Paid for this'
                : pIsMe
                  ? `You owe ${payerName}`
                  : payerIsMe
                    ? 'Owes you'
                    : `Owes ${payerName}`;
              // Settle-up settles the OVERALL balance the owner has with this
              // person (group-scoped for a group expense), not just this row —
              // so it's shown for any non-self member with a live balance,
              // including the payer (when the owner owes them).
              const net = netByMember[member.id] ?? 0;
              const canSettle =
                isOwner &&
                Boolean(selfMemberId) &&
                member.id !== selfMemberId &&
                net !== 0;
              return (
                <li key={member.id} className="space-y-3 py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={member.name} className="h-8 w-8" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {name}
                        </span>
                        {member.email ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {member.email}
                          </span>
                        ) : null}
                        <span className="block text-xs text-muted-foreground">
                          {relationship}
                          {!isPayer ? ` · equal share of “${reason}”` : ''}
                        </span>
                      </span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Owner-only: invite a not-yet-claimed participant. */}
                      {isOwner && !member.is_self && !member.linked_user_id ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-muted-foreground"
                          onClick={() =>
                            setInviteFor({
                              id: member.id,
                              name: member.name,
                              email: member.email,
                            })
                          }
                        >
                          <Mail />
                          Invite
                        </Button>
                      ) : null}
                      {canSettle ? (
                        <SettleUpDialog
                          selfMemberId={selfMemberId as string}
                          memberId={member.id}
                          memberName={member.name}
                          netCents={net}
                          groupId={expense.group_id}
                          className="h-8"
                        />
                      ) : null}
                      {canRemoveMembers && !isPayer ? (
                        <RemoveMemberButton
                          expenseId={expense.id}
                          memberId={member.id}
                          memberName={name}
                        />
                      ) : null}
                    </div>
                  </div>
                  {/* Per-member ledger for this expense: paid / owed / remaining. */}
                  <dl className="grid grid-cols-3 gap-2 pl-10">
                    <LedgerStat label="Paid" cents={participant.paidCents} />
                    <LedgerStat label="Owed" cents={participant.owedCents} />
                    <LedgerStat
                      label="Remaining"
                      cents={participant.remainingCents}
                      muted={participant.remainingCents === 0}
                    />
                  </dl>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Owner-only: payments recorded with this expense's people, undoable. */}
      {isOwner && payments.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {payment.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <LocalDate value={payment.settledAt} />
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Money
                      cents={payment.amountCents}
                      className="text-sm font-medium"
                    />
                    <DeleteSettlementButton
                      settlementId={payment.id}
                      label={payment.label}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {inviteFor ? (
        <InviteByEmailDialog
          open={Boolean(inviteFor)}
          onOpenChange={(open) => {
            if (!open) setInviteFor(null);
          }}
          memberId={inviteFor.id}
          memberName={inviteFor.name}
          defaultEmail={inviteFor.email}
          targetExpenseId={expense.id}
        />
      ) : null}
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

/** One labelled figure in a participant's per-expense paid/owed/remaining trio. */
function LedgerStat({
  label,
  cents,
  muted = false,
}: {
  label: string;
  cents: number;
  muted?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">
        <Money
          cents={cents}
          className={
            muted ? 'text-sm text-muted-foreground' : 'text-sm font-medium'
          }
        />
      </dd>
    </div>
  );
}

/**
 * Owner-only per-member remove control. Confirms first (removal recomputes
 * everyone else's equal share), then calls {@link removeExpenseMember}; the
 * server enforces the payer / minimum-participants guards as a backstop.
 */
function RemoveMemberButton({
  expenseId,
  memberId,
  memberName,
}: {
  expenseId: string;
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await removeExpenseMember({ expenseId, memberId });
      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      toast.success(`Removed ${memberName} from this expense.`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Remove ${memberName} from this expense`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/70 outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-4 [&_svg]:w-4"
        >
          <X />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {memberName}?</DialogTitle>
          <DialogDescription>
            {memberName} will be taken off this expense and everyone else’s
            equal share is recomputed. This doesn’t delete any recorded
            payments.
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
            {isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
