import type { Metadata } from 'next';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = { title: 'Create account' };

/**
 * Register route placeholder (Phase 0).
 * The registration form and auth action are implemented in Phase 1.
 */
export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>Authentication arrives in Phase 1.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        This is a placeholder shell.
      </CardContent>
    </Card>
  );
}
