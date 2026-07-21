'use client';

import * as React from 'react';

import { toast } from 'sonner';

import { signUp } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PASSWORD_MIN_LENGTH, validateSignUp } from '@/schemas/auth.schema';

type FieldErrors = { email?: string; password?: string; fullName?: string };

/**
 * Registration form (Client Component). Validation lives in the shared schema;
 * the `signUp` Server Action performs the write and the signup trigger creates
 * the profile row. On success with a session the action redirects (to `next`
 * when present — e.g. back to an invite accept page); when email confirmation is
 * required it returns a flag and we prompt the user to check their inbox.
 *
 * `defaultEmail` prefills the email when arriving from an invite link; `next` is
 * a same-origin relative path threaded through sign-up (and email confirmation).
 */
export function RegisterForm({
  defaultEmail,
  next,
}: {
  defaultEmail?: string;
  next?: string;
}) {
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') ?? '');
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    const parsed = validateSignUp({ fullName, email, password });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await signUp(parsed.data, next);
      // On immediate sign-in the action redirects; we only reach here otherwise.
      if (result && !result.ok) {
        // Surface an existing-account error inline on the email field too.
        if (result.error.toLowerCase().includes('already exists')) {
          setErrors({ email: result.error });
        }
        toast.error(result.error);
        return;
      }
      if (result && result.ok && result.data.needsConfirmation) {
        toast.success('Check your email to confirm your account.');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="fullName">Name</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          aria-invalid={Boolean(errors.fullName)}
          disabled={isPending}
        />
        {errors.fullName ? (
          <p className="text-sm text-destructive">{errors.fullName}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={defaultEmail}
          aria-invalid={Boolean(errors.email)}
          disabled={isPending}
        />
        {errors.email ? (
          <p className="text-sm text-destructive">{errors.email}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-hint"
          disabled={isPending}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password}</p>
        ) : (
          <p id="password-hint" className="text-sm text-muted-foreground">
            Use at least {PASSWORD_MIN_LENGTH} characters.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
