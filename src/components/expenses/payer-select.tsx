'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

/** A person who can be a payer or split participant (a registered user). */
export interface Person {
  id: string;
  name: string;
}

/**
 * Payer selector (Phase 4). Native `<Select>` over the people valid for the
 * chosen scope (group members, or the user + friends for a personal expense).
 * The payer need not be a participant in the split — they simply fronted the
 * cost (feature-specifications: payer can be the user, a friend, or a member).
 */
export function PayerSelect({
  people,
  value,
  onChange,
  disabled,
}: {
  people: Person[];
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="expense-payer">Paid by</Label>
      <Select
        id="expense-payer"
        name="paidBy"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        {people.length === 0 ? <option value="">No one available</option> : null}
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
