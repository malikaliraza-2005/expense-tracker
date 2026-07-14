import type { Metadata } from 'next';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = { title: 'Log in' };

/**
 * Login route placeholder (Phase 0).
 * The login form and auth action are implemented in Phase 1.
 */
export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Log in</CardTitle>
        <CardDescription>Authentication arrives in Phase 1.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This is a placeholder shell.
      </CardContent>
    </Card>
  );
}
