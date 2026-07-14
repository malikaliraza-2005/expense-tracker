import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = { title: 'Set new password' };

/**
 * Reset-password route: set a new password. Reached from the emailed reset
 * link, which establishes a recovery session via the auth callback. The
 * middleware guards this route, so it is only reachable with that session.
 */
export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>

      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-xl">New password</CardTitle>
          <CardDescription>
            Enter a password you haven&apos;t used before.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
