import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Logo } from '@/components/common/logo';
import { PageHeader } from '@/components/common/page-header';
import { AppInviteLink } from '@/components/profile/app-invite-link';
import { AvatarUploader } from '@/components/profile/avatar-uploader';
import { ProfileForm } from '@/components/profile/profile-form';
import { CurrencySelect } from '@/components/settings/currency-select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { safeCurrency } from '@/constants/currencies';
import { ROUTES } from '@/constants/routes';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Profile' };

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
        eyebrow="Account"
        title="Profile"
        description="Manage how you appear across your groups."
        action={<Logo size="md" />}
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

          <div className="space-y-2">
            <p className="text-sm font-medium leading-none">Preferred currency</p>
            <CurrencySelect current={safeCurrency(profile.preferred_currency)} />
            <p className="text-xs text-muted-foreground">
              Choose from every currency worldwide. All amounts display in your
              chosen currency.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite friends</CardTitle>
        </CardHeader>
        <CardContent>
          <AppInviteLink userId={profile.id} />
        </CardContent>
      </Card>
    </section>
  );
}
