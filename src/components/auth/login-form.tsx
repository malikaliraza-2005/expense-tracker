'use client';

import * as React from 'react';

import Link from 'next/link';

import { toast } from 'sonner';

import { signIn } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { validateSignIn } from '@/schemas/auth.schema';

type FieldErrors = { email?: string; password?: string };

/**
 * Login form (Client Component). Owns presentation state only — validation
 * lives in the shared schema and the write happens in the `signIn` Server
 * Action. Shows inline field errors and a toast on server failure; on success
 * the action redirects to the dashboard.
 */
export function LoginForm({ next }: { next?: string }) {
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [isPending, startTransition] = React.useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    const parsed = validateSignIn({ email, password });
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await signIn(parsed.data, next);
      // On success the action redirects; we only reach here on failure.
      if (result && !result.ok) {
        toast.error(result.error);
      }
    });
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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href={ROUTES.forgotPassword}
            className="text-xs font-medium text-primary underline-offset-4 transition-colors hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          disabled={isPending}
        />
        {errors.password ? (
          <p className="text-sm text-destructive">{errors.password}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Signing in…' : 'Log in'}
      </Button>
    </form>
  );
}
