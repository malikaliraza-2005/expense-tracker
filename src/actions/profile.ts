'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import { firstError } from '@/schemas/auth.schema';
import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_BYTES,
  validateUpdateCurrency,
  validateUpdateProfile,
  type UpdateCurrencyFormInput,
  type UpdateProfileFormInput,
} from '@/schemas/profile.schema';
import type { ActionResult } from '@/types';
import type { Profile } from '@/types/db';

/**
 * Profile Server Actions (Phase 6). The only place a user's own `profiles` row
 * and avatar object are written. Each action re-validates its input on the
 * server, performs the RLS-scoped write, and revalidates the affected paths.
 * Expected failures are returned as `ActionResult`, never thrown.
 */

const AVATARS_BUCKET = 'avatars';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Extension for a supported image mime type, for a clean object key. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Pages that render the current user's name / avatar and must re-read on change. */
function revalidateProfileSurfaces(): void {
  revalidatePath(ROUTES.profile);
  revalidatePath(ROUTES.dashboard);
  // The app shell (nav/header) shows the name and avatar on every page.
  revalidatePath('/', 'layout');
}

/** Update the current user's display name. */
export async function updateProfile(
  input: UpdateProfileFormInput,
): Promise<ActionResult<Profile>> {
  const parsed = validateUpdateProfile(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? 'Invalid input.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', user.id)
    .select('*')
    .single<Profile>();

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidateProfileSurfaces();
  return { ok: true, data };
}

/**
 * Update the current user's preferred display currency. Money across the app is
 * formatted in this currency (no FX conversion — a single-currency display
 * choice). Revalidates the shell so every amount re-renders with the new symbol.
 */
export async function updateCurrency(
  input: UpdateCurrencyFormInput,
): Promise<ActionResult<Profile>> {
  const parsed = validateUpdateCurrency(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: firstError(parsed.errors) ?? 'Choose a valid currency.',
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const { data, error } = await supabase
    .from('profiles')
    .update({ preferred_currency: parsed.data.currency })
    .eq('id', user.id)
    .select('*')
    .single<Profile>();

  if (error || !data) return { ok: false, error: GENERIC_ERROR };

  revalidateProfileSurfaces();
  return { ok: true, data };
}

/**
 * Upload (or replace) the current user's avatar. Reads the file from the posted
 * `FormData`, validates its type and size, writes it to the `avatars` bucket
 * under the user's own folder (`<uid>/avatar.<ext>` — Storage RLS enforces that
 * a user can only write inside their own folder), and records the public URL on
 * the profile. `upsert` overwrites any previous avatar in place.
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<ActionResult<Profile>> {
  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an image to upload.' };
  }
  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Use a PNG, JPEG, WebP, or GIF image.' };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: 'Image must be 2 MB or smaller.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in.' };

  const extension = EXTENSION_BY_TYPE[file.type] ?? 'png';
  const objectKey = `${user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(objectKey, file, { contentType: file.type, upsert: true });
  if (uploadError) return { ok: false, error: GENERIC_ERROR };

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(objectKey);

  // Cache-bust so the browser re-fetches after an in-place replace: the object
  // key is stable, so without a changing query string the CDN/browser would
  // keep serving the old image.
  const versionedUrl = `${publicUrl}?v=${Date.now()}`;

  const { data, error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: versionedUrl })
    .eq('id', user.id)
    .select('*')
    .single<Profile>();

  if (updateError || !data) return { ok: false, error: GENERIC_ERROR };

  revalidateProfileSurfaces();
  return { ok: true, data };
}
