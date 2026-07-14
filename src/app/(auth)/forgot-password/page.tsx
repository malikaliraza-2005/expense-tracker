import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';

export const metadata: Metadata = { title: 'Reset password' };

/** Forgot-password route: request a reset link by email. */
export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-xl">Reset password</CardTitle>
          <CardDescription>
            We&apos;ll email you a secure link to set a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <span>
            Remembered it?{' '}
            <Link
              href={ROUTES.login}
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
