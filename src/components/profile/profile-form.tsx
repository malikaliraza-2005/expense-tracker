'use client';

import * as React from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { updateProfile } from '@/actions/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateUpdateProfile } from '@/schemas/profile.schema';

/**
 * Edit-profile form (Client Component). Validation lives in the shared schema;
 * the `updateProfile` Server Action performs the write. Shows inline errors,
 * disables the submit while unchanged or saving, and refreshes on success.
 */
export function ProfileForm({ fullName }: { fullName: string }) {
  const router = useRouter();
  const [name, setName] = React.useState(fullName);
  const [error, setError] = React.useState<string | undefined>();
  const [isPending, startTransition] = React.useTransition();

  const trimmed = name.trim();
  const isUnchanged = trimmed === fullName.trim();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = validateUpdateProfile({ fullName: name });
    if (!parsed.success) {
      setError(parsed.errors.fullName);
      return;
    }
    setError(undefined);

    startTransition(async () => {
      const result = await updateProfile(parsed.data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success('Profile updated.');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <Label htmlFor="full-name">Display name</Label>
      <Input
        id="full-name"
        name="fullName"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Your name"
        aria-invalid={Boolean(error)}
        disabled={isPending}
        autoComplete="name"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="pt-2">
        <Button type="submit" disabled={isPending || isUnchanged || !trimmed}>
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
