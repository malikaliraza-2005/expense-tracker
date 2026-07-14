'use client';

import * as React from 'react';

import { toast } from 'sonner';

import { requestPasswordReset } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateResetRequest } from '@/schemas/auth.schema';

/**
 * Forgot-password form (Client Component). Validates the email with the shared
 * schema, then calls the `requestPasswordReset` Server Action. The response is
 * intentionally the same whether or not the address is registered, so the UI
 * shows a neutral confirmation and never reveals account existence.
 */
export function ForgotPasswordForm() {
  const [errors, setErrors] = React.useState<{ email?: string }>({});
  const [sent, setSent] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');

    const parsed = validateResetRequest({ email });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await requestPasswordReset(parsed.data);
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      setSent(true);
      toast.success('Check your email for a reset link.');
    });
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account exists for that email, we&apos;ve sent a password reset
        link. Check your inbox and follow the link to choose a new password.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
          disabled={isPending}
        />
        {errors.email ? (
          <p className="text-sm text-destructive">{errors.email}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
