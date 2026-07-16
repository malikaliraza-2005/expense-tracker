'use client';

import * as React from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Plus, Search } from 'lucide-react';

import { BalanceLabel } from '@/components/common/money';
import { MemberRowActions } from '@/components/members/member-row-actions';
import { PersonSearch } from '@/components/members/person-search';
import { SettleUpDialog } from '@/components/settlements/settlement-controls';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/constants/routes';
import { matchPeople } from '@/utils/people';

/** One person in the directory, with the owner's net balance against them. */
export interface PersonRow {
  id: string;
  name: string;
  email: string | null;
  netCents: number;
}

/**
 * The searchable People directory (Client Component). Filters the owner's people
 * EMAIL-first then by name as you type, shows each with their email, and can add
 * a new person inline — reusing {@link PersonSearch}, which offers an invite link
 * when the person isn't in the app yet. Balances are computed server-side and
 * passed in; this component never touches them.
 */
export function PeopleList({
  people,
  selfMemberId,
  inviteRef,
}: {
  people: PersonRow[];
  selfMemberId: string | null;
  inviteRef?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  const filtered = React.useMemo(
    () => matchPeople(query, people),
    [query, people],
  );

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people by name or email"
              aria-label="Search people"
              className="pl-9"
            />
          </div>
          {!adding ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setAdding(true)}
            >
              <Plus />
              Add person
            </Button>
          ) : null}
        </div>

        {adding ? (
          <PersonSearch
            people={people}
            onAdd={() => {
              setAdding(false);
              router.refresh();
            }}
            inviteRef={inviteRef}
            onClose={() => setAdding(false)}
            autoFocus
          />
        ) : null}

        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">
            {query
              ? `No one matches “${query}”. Use “Add person” to add them.`
              : 'No people yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {filtered.map((person) => (
              <li key={person.id} className="flex items-center gap-2 p-1">
                <Link
                  href={`${ROUTES.expenses}?who=${person.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar name={person.name} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{person.name}</p>
                    {person.email ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {person.email}
                      </p>
                    ) : null}
                    <BalanceLabel netCents={person.netCents} subject="them" />
                  </div>
                </Link>
                {person.netCents !== 0 && selfMemberId ? (
                  <SettleUpDialog
                    selfMemberId={selfMemberId}
                    memberId={person.id}
                    memberName={person.name}
                    netCents={person.netCents}
                  />
                ) : null}
                <MemberRowActions
                  memberId={person.id}
                  memberName={person.name}
                  memberEmail={person.email}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
