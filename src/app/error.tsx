'use client';

import { useEffect } from 'react';

import { DecorativeBackground } from '@/components/common/decorative-background';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';

/** Global route-level error boundary. Must be a Client Component. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors server/client-side; show a generic message.
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <DecorativeBackground />
      <div className="animate-fade-in-up flex flex-col items-center gap-4">
        <Logo showWordmark={false} size="lg" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={reset} className="mt-2">
          Try again
        </Button>
      </div>
    </div>
  );
}
