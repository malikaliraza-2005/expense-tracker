import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { APP_NAME } from '@/constants/app';
import { ROUTES } from '@/constants/routes';

/**
 * Placeholder home/shell route (Phase 0).
 *
 * Confirms the app boots and the design system renders. Real routing (redirect
 * to dashboard when authenticated, else login) arrives with auth in Phase 1.
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{APP_NAME}</CardTitle>
          <CardDescription>
            Foundation is in place. Features arrive in the next phases.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link href={ROUTES.login}>Log in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.dashboard}>Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
