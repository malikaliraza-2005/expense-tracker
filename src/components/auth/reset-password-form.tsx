'use client';

import * as React from 'react';

import { toast } from 'sonner';

import { updatePassword } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateNewPassword } from '@/schemas/auth.schema';

/**
 * Reset-password form (Client Component). Validates the new password with the
 * shared schema, then calls the `updatePassword` Server Action, which writes it
 * against the recovery session established by the reset link. On success the
 * action redirects to the dashboard; failures surface as a toast.
 */
export function ResetPasswordForm() {
  const [errors, setErrors] = React.useState<{ password?: string }>({});
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');

    const parsed = validateNewPassword({ password });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await updatePassword(parsed.data);
      // On success the action redirects; we only reach here on failure.
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          disabled={isPending}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  );
}
