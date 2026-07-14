'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';
import { createClient } from '@/lib/supabase/server';
import {
  firstError,
  validateSignIn,
  validateSignUp,
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
 * Register a new account. The `profiles` row is created automatically by the
 * signup trigger (migration 0001). When email confirmation is enabled the user
 * is returned a "check your email" result; otherwise they are signed in and
 * redirected to the dashboard.
 */
export async function signUp(
  input: Partial<SignUpInput>,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = validateSignUp(input);
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.errors) ?? GENERIC_AUTH_ERROR };
  }

  const { email, password, fullName } = parsed.data;
  const supabase = createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: siteUrl ? `${siteUrl}${ROUTES.authCallback}` : undefined,
    },
  });

  if (error) {
    // Do not leak whether the email exists; surface a generic message.
    return { ok: false, error: GENERIC_AUTH_ERROR };
  }

  // No session means email confirmation is required (or the address is already
  // registered — Supabase obfuscates this to prevent enumeration).
  if (!data.session) {
    return { ok: true, data: { needsConfirmation: true } };
  }

  revalidatePath('/', 'layout');
  redirect(ROUTES.dashboard);
}

/** Sign in with email + password. Sets the httpOnly session cookie. */
export async function signIn(input: Partial<SignInInput>): Promise<ActionResult> {
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
  redirect(ROUTES.dashboard);
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
