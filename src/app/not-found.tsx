import Link from 'next/link';

import { DecorativeBackground } from '@/components/common/decorative-background';
import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <DecorativeBackground />
      <div className="animate-fade-in-up flex flex-col items-center gap-4">
        <Logo showWordmark={false} size="lg" />
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <Button asChild className="mt-2">
          <Link href={ROUTES.dashboard}>Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
