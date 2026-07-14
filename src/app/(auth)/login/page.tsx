import type { Metadata } from 'next';
import Link from 'next/link';

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

/** Login route (Phase 1). Renders the login form inside the auth shell. */
export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <span>
          Don&apos;t have an account?{' '}
          <Link
            href={ROUTES.register}
            className="text-primary underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
