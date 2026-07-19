import type { Metadata } from 'next';
import Link from 'next/link';

import { AuthDivider } from '@/components/auth/auth-divider';
import { GoogleAuthButton } from '@/components/auth/google-auth-button';
import { LoginForm } from '@/components/auth/login-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

export const metadata: Metadata = { title: 'Log in' };

/** A same-origin relative path safe to forward after login, or undefined. */
function safeNext(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined;
}

/** Login route (Phase 1). Renders the login form inside the auth shell. */
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string | string[] };
}) {
  const next = safeNext(searchParams?.next);
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Log in to pick up where you left off.
        </p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-xl">Log in</CardTitle>
          <CardDescription>Enter your details to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm next={next} />
          <AuthDivider />
          <GoogleAuthButton label="Log in with Google" />
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <span>
            Don&apos;t have an account?{' '}
            <Link
              href={
                next
                  ? `${ROUTES.register}?next=${encodeURIComponent(next)}`
                  : ROUTES.register
              }
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              Create one
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
