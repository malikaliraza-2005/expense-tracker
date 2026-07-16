import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Logo } from '@/components/common/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: false },
};

interface InviteDetails {
  email: string;
  inviter_name: string;
  member_name: string;
  status: string;
}

/**
 * Public invite accept page.
 *
 * Resolves the token to display-only details via `invite_details` (SECURITY
 * DEFINER — no session or RLS access to anything else). If the visitor is signed
 * in and the invite is still open, it is accepted here via the `accept_invite`
 * RPC and we redirect to the target (the invited expense/group, else the
 * dashboard). Signed-out visitors get a clear register/log-in choice, both of
 * which loop back here after auth to complete the claim.
 */
export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  const supabase = createClient();

  const { data, error } = await supabase.rpc('invite_details', {
    p_token: token,
  });
  const rows = (error ? [] : ((data ?? []) as InviteDetails[])) satisfies InviteDetails[];
  const invite = rows[0] ?? null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Open invite + signed in → claim it now and land on the target. We call the
  // RPC directly (not the acceptInvite action) because a Server Component render
  // must not call revalidatePath; the accepted route redirect is all we need.
  if (invite && invite.status === 'pending' && user) {
    const { data: route } = await supabase.rpc('accept_invite', {
      p_token: token,
    });
    if (route) {
      redirect(route); // throws NEXT_REDIRECT — must stay uncaught
    }
    return (
      <InviteShell>
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-semibold">We couldn’t accept this invite</p>
            <p className="text-sm text-muted-foreground">
              This invite isn’t valid anymore. Ask for a new one.
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href={ROUTES.dashboard}>Go to your dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </InviteShell>
    );
  }

  // Unknown / revoked / expired / already-accepted → a neutral message.
  if (!invite || invite.status !== 'pending') {
    return (
      <InviteShell>
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="font-semibold">This invite isn’t active</p>
            <p className="text-sm text-muted-foreground">
              {invite?.status === 'accepted'
                ? 'It has already been accepted.'
                : 'It may have expired or been revoked. Ask whoever invited you for a new link.'}
            </p>
            <Button asChild variant="outline" className="mt-2">
              <Link href={ROUTES.login}>Log in</Link>
            </Button>
          </CardContent>
        </Card>
      </InviteShell>
    );
  }

  // Open invite + signed out → offer register (primary) or log in, both looping
  // back to this page to complete the claim.
  const acceptPath = `${ROUTES.invite}/${token}`;
  const registerHref =
    `${ROUTES.register}?token=${encodeURIComponent(token)}` +
    `&email=${encodeURIComponent(invite.email)}`;
  const loginHref = `${ROUTES.login}?next=${encodeURIComponent(acceptPath)}`;

  return (
    <InviteShell>
      <Card>
        <CardHeader className="pb-3 text-center">
          <CardTitle className="text-lg">
            {invite.inviter_name} invited you to split expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Create your account to see the details and settle up together.
          </p>
          <div className="space-y-2">
            <Button asChild variant="gradient" className="w-full">
              <Link href={registerHref}>Create account</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={loginHref}>I already have an account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </InviteShell>
  );
}

/** Centered auth-style shell matching the /share page. */
function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex justify-center">
        <Logo size="sm" />
      </div>
      {children}
    </main>
  );
}
