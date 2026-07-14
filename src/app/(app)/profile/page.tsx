import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { AvatarUploader } from '@/components/profile/avatar-uploader';
import { ProfileForm } from '@/components/profile/profile-form';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DEFAULT_LOCALE } from '@/constants/app';
import { ROUTES } from '@/constants/routes';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Profile' };

/** Human-readable currency name for a code, e.g. "USD" -> "US Dollar (USD)". */
function currencyLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames([DEFAULT_LOCALE], {
      type: 'currency',
    }).of(code);
    return name ? `${name} (${code})` : code;
  } catch {
    return code;
  }
}

/**
 * Profile page (Phase 6). Server Component: reads the current user's RLS-scoped
 * profile and renders the avatar uploader, the editable display name, and the
 * (read-only) preferred currency that drives all money formatting in the app.
 */
export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect(ROUTES.login);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Profile"
        description="Manage how you appear to friends and groups."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUploader
            name={profile.full_name || null}
            avatarUrl={profile.avatar_url}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProfileForm fullName={profile.full_name} />

          <div className="space-y-1">
            <p className="text-sm font-medium leading-none">Preferred currency</p>
            <p className="text-sm text-muted-foreground">
              {currencyLabel(profile.preferred_currency)}
            </p>
            <p className="text-xs text-muted-foreground">
              This app uses a single currency for all balances.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
