'use client';

import * as React from 'react';

import { Check, Clock, Slash, X } from 'lucide-react';

import { RequestActions } from '@/components/requests/request-actions';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import {
  REQUEST_TABS,
  filterByTab,
  isActionableReceived,
  type RequestTab,
} from '@/lib/requests';
import type { InvitationStatus } from '@/types/db';
import type { RequestItem } from '@/types/dto';

/**
 * The Requests page body (Phase 5). Owns the active tab and renders the matching
 * slice of the pre-fetched request list — Received / Sent / Accepted / Rejected.
 * Received rows that are still pending expose Accept / Decline; every other row is
 * read-only, its outcome shown as a status badge. All data is resolved server-side
 * and passed in, so this stays presentational apart from tab state.
 */
export function RequestsView({ items }: { items: RequestItem[] }) {
  const [tab, setTab] = React.useState<RequestTab>('received');

  const tabs = REQUEST_TABS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    count: filterByTab(items, definition.key).length,
  }));

  const visible = filterByTab(items, tab);

  return (
    <div className="space-y-4">
      <Tabs
        tabs={tabs}
        value={tab}
        onValueChange={(key) => setTab(key as RequestTab)}
        ariaLabel="Request sections"
        idPrefix="requests"
      />

      <div
        role="tabpanel"
        id={`requests-panel-${tab}`}
        aria-labelledby={`requests-${tab}`}
      >
        {visible.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {emptyMessage(tab)}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <ul className="divide-y divide-border/50">
                {visible.map((item) => (
                  <RequestRow key={item.id} item={item} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/** One request row: who it's with, what it is, and its status or actions. */
function RequestRow({ item }: { item: RequestItem }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={item.counterpartyName} className="h-9 w-9" />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">
              {item.counterpartyName}
            </span>
            <StatusBadge status={item.status} />
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle(item)}
          </span>
        </span>
      </span>

      {isActionableReceived(item) ? (
        <RequestActions token={item.token} name={item.counterpartyName} />
      ) : null}
    </li>
  );
}

/** The line under the name: the invitee email on Sent, the ask on Received. */
function subtitle(item: RequestItem): string {
  if (item.direction === 'received') {
    return item.kind === 'friend' ? 'Wants to be friends' : 'Invited you to join';
  }
  return item.email;
}

/** Empty-tab copy, tailored to the section. */
function emptyMessage(tab: RequestTab): string {
  switch (tab) {
    case 'received':
      return 'No requests waiting on you.';
    case 'sent':
      return 'You haven’t sent any requests or invites yet.';
    case 'accepted':
      return 'No accepted requests yet.';
    case 'rejected':
      return 'No declined requests.';
  }
}

/** A pill marking an invitation's outcome. Pending stays neutral (it's live). */
function StatusBadge({ status }: { status: InvitationStatus }) {
  switch (status) {
    case 'pending':
    case 'clarifying':
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case 'accepted':
      return (
        <Badge variant="success">
          <Check className="h-3 w-3" />
          Accepted
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="destructive">
          <X className="h-3 w-3" />
          Declined
        </Badge>
      );
    case 'revoked':
    case 'expired':
      return (
        <Badge variant="outline">
          <Slash className="h-3 w-3" />
          {status === 'revoked' ? 'Revoked' : 'Expired'}
        </Badge>
      );
    default:
      return null;
  }
}
