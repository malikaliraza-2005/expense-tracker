import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthDivider } from '@/components/auth/auth-divider';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { RegisterForm } from '@/components/auth/register-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

export const metadata: Metadata = { title: 'Create account' };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A same-origin relative path safe to forward after sign-up, or undefined. */
function safeNext(value: string | undefined): string | undefined {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : undefined;
}

/**
 * Register route (Phase 1). Renders the registration form in the auth shell.
 * When reached from an invite link it prefills the invitee's email and threads a
 * post-sign-up destination: `?token=` sends them back to `/invite/<token>` to
 * complete the claim, and a bare `?next=` is honored for other deep links.
 */
export default function RegisterPage({
  searchParams,
}: {
  searchParams?: { token?: string | string[]; email?: string | string[]; next?: string | string[] };
}) {
  const token = first(searchParams?.token);
  const defaultEmail = first(searchParams?.email);
  const next = token
    ? `/invite/${encodeURIComponent(token)}`
    : safeNext(first(searchParams?.next));

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground">
          Split expenses with friends in seconds.
        </p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>Just a few details to get started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RegisterForm defaultEmail={defaultEmail} next={next} />
          <AuthDivider />
          <GoogleAuthButton label="Sign up with Google" />
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <span>
            Already have an account?{' '}
            <Link
              href={
                next
                  ? `${ROUTES.login}?next=${encodeURIComponent(next)}`
                  : ROUTES.login
              }
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Log in
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
