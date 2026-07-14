import type { Metadata } from 'next';
import Link from 'next/link';

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

/** Register route (Phase 1). Renders the registration form in the auth shell. */
export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>Start splitting expenses in seconds.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <span>
          Already have an account?{' '}
          <Link
            href={ROUTES.login}
            className="text-primary underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
