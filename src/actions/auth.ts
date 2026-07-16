'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import {
  firstError,
  validateNewPassword,
  validateResetRequest,
  validateSignIn,
  validateSignUp,
  type NewPasswordInput,
  type ResetRequestInput,
  type SignInInput,
  type SignUpInput,
} from '@/schemas/auth.schema';
import type { ActionResult } from '@/types';

/**
 * Authentication Server Actions (Phase 1) — the only place auth writes happen.
 *
 * Each action re-validates its input on the server (client input is untrusted),
 * performs the Supabase Auth call, and on success revalidates the layout and
 * redirects. Expected failures are returned as `ActionResult`, never thrown
 * across the boundary. Error messages are intentionally generic so they never
 * reveal whether a given email is registered.
 */

const GENERIC_AUTH_ERROR =
  'We could not complete that request. Please check your details and try again.';

/**
 * A same-origin relative path safe to redirect to after auth, or null. Rejects
 * absolute and protocol-relative ("//host") URLs so a `next` deep link (e.g.
 * `/invite/<token>`) can never become an open redirect. Mirrors the guard in the
 * auth callback route and middleware.
 */
function safeNext(value?: string | null): string | null {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : null;
}

/**
 * Shown when a sign-up targets an address that already has an account. This is
 * a deliberate, product-requested tradeoff: it reveals that the email is
 * registered (mild account-enumeration exposure) in exchange for a clearer
 * sign-up experience. Sign-in and password-reset stay intentionally generic.
 */
const EMAIL_EXISTS_ERROR =
  'An account with this email already exists. Try logging in instead.';

/**
 * True when a Supabase auth error indicates the email is already registered.
 * Covers the error surfaced when email confirmations are disabled (the enabled
 * case is detected separately via an empty `identities` array).
 */
function isAlreadyRegistered(error: { code?: string; message?: string }): boolean {
  const message = (error.message ?? '').toLowerCase();
  return (
    error.code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already exists')
  );
}

/**
 * Register a new account. The `profiles` row is created automatically by the
 * signup trigger (migration 0001). When email confirmation is enabled the user
 * is returned a "check your email" result; otherwise they are signed in and
 * redirected to the dashboard.
 */
export async function signUp(
  input: Partial<SignUpInput>,
  next?: string,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = validateSignUp(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? GENERIC_AUTH_ERROR };
  }

  const { email, password, fullName } = parsed.data;
  const destination = safeNext(next);
  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  // Thread the deep link through email confirmation: the callback route already
  // honors a same-origin `?next=`, so a confirmed invitee lands back on accept.
  const callback = siteUrl
    ? `${siteUrl}${ROUTES.authCallback}` +
      (destination ? `?next=${encodeURIComponent(destination)}` : '')
    : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: callback,
    },
  });

  if (error) {
    if (isAlreadyRegistered(error)) {
      return { ok: false, error: EMAIL_EXISTS_ERROR };
    }
    return { ok: false, error: GENERIC_AUTH_ERROR };
  }

  // With email confirmations enabled, signing up an existing address returns an
  // obfuscated user whose `identities` array is explicitly empty. Require a real
  // empty array (not merely a missing field) so a genuinely new signup is never
  // wrongly flagged as existing.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: EMAIL_EXISTS_ERROR };
  }

  // No session (with a real identity) means email confirmation is required.
  if (!data.session) {
    return { ok: true, data: { needsConfirmation: true } };
  }

  revalidatePath('/', 'layout');
  redirect(destination ?? ROUTES.dashboard);
}

/** Sign in with email + password. Sets the httpOnly session cookie. */
export async function signIn(
  input: Partial<SignInInput>,
  next?: string,
): Promise<ActionResult> {
  const parsed = validateSignIn(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? GENERIC_AUTH_ERROR };
  }

  const { email, password } = parsed.data;
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: 'Invalid email or password.' };
  }

  revalidatePath('/', 'layout');
  redirect(safeNext(next) ?? ROUTES.dashboard);
}

/**
 * Sign out and return to the login page. Written to be usable directly as a
 * form `action` (it takes no arguments and redirects on completion).
 */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect(ROUTES.login);
}

/**
 * Send a password-reset email. The link returns through the shared auth
 * callback and lands on the reset-password page (where a new password is set).
 * Always resolves with success — we never reveal whether the address is
 * registered, mirroring the sign-in enumeration stance.
 */
export async function requestPasswordReset(
  input: Partial<ResetRequestInput>,
): Promise<ActionResult> {
  const parsed = validateResetRequest(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? GENERIC_AUTH_ERROR };
  }

  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: siteUrl
      ? `${siteUrl}${ROUTES.authCallback}?next=${ROUTES.resetPassword}`
      : undefined,
  });

  // Intentionally generic: success regardless of whether the email exists.
  return { ok: true, data: undefined };
}

/**
 * Set a new password for the currently-authenticated user. Reached after the
 * reset link establishes a recovery session via the auth callback. On success
 * the session is now a full session and we send the user to the dashboard.
 */
export async function updatePassword(
  input: Partial<NewPasswordInput>,
): Promise<ActionResult> {
  const parsed = validateNewPassword(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? GENERIC_AUTH_ERROR };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      ok: false,
      error: 'Could not update your password. Please try again.',
    };
  }

  revalidatePath('/', 'layout');
  redirect(ROUTES.dashboard);
}
