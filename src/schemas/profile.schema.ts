/**
 * Profile validation schemas (Phase 6).
 *
 * Dependency-free validators in the same shape as auth.schema.ts: the single
 * source of validation truth called by both the client profile form (inline UX)
 * and the `updateProfile` Server Action (server input is always untrusted).
 *
 * Only the display name is editable. Preferred currency is a single app-wide
 * value shown read-only (constants/app.ts), so it is not part of this schema.
 * Avatar uploads are validated separately in the action (file type/size can only
 * be checked server-side).
 */
import {
  FULL_NAME_MAX_LENGTH,
  type ValidationResult,
} from '@/schemas/auth.schema';
import { isValidCurrencyCode } from '@/constants/currencies';

export interface UpdateProfileInput {
  fullName: string;
}

export interface UpdateCurrencyInput {
  currency: string;
}

export interface UpdateCurrencyFormInput {
  currency?: unknown;
}

/** Validate a chosen currency: a recognised ISO 4217 code (uppercased). */
export function validateUpdateCurrency(
  input: UpdateCurrencyFormInput,
): ValidationResult<UpdateCurrencyInput> {
  const raw = typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : '';
  if (!isValidCurrencyCode(raw)) {
    return { success: false, errors: { currency: 'Choose a valid currency.' } };
  }
  return { success: true, data: { currency: raw } };
}

/** Raw, untrusted form shape. */
export interface UpdateProfileFormInput {
  fullName?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function validateUpdateProfile(
  input: UpdateProfileFormInput,
): ValidationResult<UpdateProfileInput> {
  const fullName = asString(input.fullName).trim();

  const errors: Partial<Record<keyof UpdateProfileInput, string>> = {};
  if (!fullName) {
    errors.fullName = 'Name is required.';
  } else if (fullName.length > FULL_NAME_MAX_LENGTH) {
    errors.fullName = `Name must be at most ${FULL_NAME_MAX_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { fullName } };
}

/** Avatar upload limits, shared by the action and the uploader UI (client hint). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — matches the bucket limit.
export const AVATAR_ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;
