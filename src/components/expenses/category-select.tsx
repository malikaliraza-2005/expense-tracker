'use client';

import * as React from 'react';

import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { Category } from '@/types/db';

/**
 * Category selector (Phase 4). Native `<Select>` over the seeded categories
 * (read from the DB and passed in by the server component). Value is the numeric
 * category id, surfaced as a string by the native element and coerced back in
 * the form.
 */
export function CategorySelect({
  categories,
  value,
  onChange,
  disabled,
  error,
}: {
  categories: Category[];
  value: number | '';
  onChange: (categoryId: number) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="expense-category">Category</Label>
      <Select
        id="expense-category"
        name="categoryId"
        value={value === '' ? '' : String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-invalid={Boolean(error)}
        disabled={disabled}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
