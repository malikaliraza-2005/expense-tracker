'use client';

import * as React from 'react';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/client';

/** Multi-color Google "G" mark (inline so no extra asset/dependency is needed). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

/**
 * "Continue with Google" button. Starts Supabase's OAuth (PKCE) flow from the
 * browser: it redirects to Google and returns to the shared `/auth/callback`
 * route, which exchanges the code for a session — the same handler used by
 * email confirmation links. Requires the Google provider to be enabled in the
 * Supabase dashboard (and this origin allow-listed as a redirect URL).
 */
export function GoogleAuthButton({
  label = 'Continue with Google',
}: {
  label?: string;
}) {
  const [isPending, setIsPending] = React.useState(false);

  async function onClick() {
    setIsPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Return to the existing callback handler, then on to the dashboard.
          redirectTo: `${window.location.origin}${ROUTES.authCallback}?next=${ROUTES.dashboard}`,
        },
      });
      // On success the browser is redirected to Google; we only reach here on
      // failure to initiate (e.g. the provider is not configured).
      if (error) {
        toast.error('Could not start Google sign-in. Please try again.');
        setIsPending(false);
      }
    } catch {
      toast.error('Could not start Google sign-in. Please try again.');
      setIsPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={onClick}
      disabled={isPending}
    >
      {isPending ? (
        'Redirecting…'
      ) : (
        <>
          <GoogleIcon />
          {label}
        </>
      )}
    </Button>
  );
}
