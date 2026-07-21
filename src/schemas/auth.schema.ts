/**
 * Authentication validation schemas (Phase 1).
 *
 * The project does not ship a validation library, so these are small,
 * dependency-free validators. They are the single source of validation truth:
 * the client forms call them for inline UX errors, and the Server Actions call
 * them again before any write (server input is always treated as untrusted).
 */

/** Minimum password length enforced at sign-up (stricter than Supabase's 6). */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt hard limit
export const FULL_NAME_MAX_LENGTH = 80;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Partial<Record<keyof T, string>> };

/** Raw, untrusted form shape (all fields optional strings). */
export interface AuthFormInput {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function validateEmail(raw: string): string | undefined {
  const email = raw.trim();
  if (!email) return 'Email is required.';
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.';
  return undefined;
}

function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return undefined;
}

export function validateSignIn(input: AuthFormInput): ValidationResult<SignInInput> {
  const email = asString(input.email).trim();
  const password = asString(input.password);

  const errors: Partial<Record<keyof SignInInput, string>> = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  // On sign-in we only require a non-empty password; length rules are the
  // sign-up concern and re-stating them here would leak nothing useful.
  if (!password) errors.password = 'Password is required.';

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { email, password } };
}

export function validateSignUp(input: AuthFormInput): ValidationResult<SignUpInput> {
  const email = asString(input.email).trim();
  const password = asString(input.password);
  const fullName = asString(input.fullName).trim();

  const errors: Partial<Record<keyof SignUpInput, string>> = {};

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  if (fullName.length > FULL_NAME_MAX_LENGTH) {
    errors.fullName = `Name must be at most ${FULL_NAME_MAX_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { email, password, fullName } };
}

export interface ResetRequestInput {
  email: string;
}

/** Validate a password-reset request (email only). */
export function validateResetRequest(
  input: AuthFormInput,
): ValidationResult<ResetRequestInput> {
  const email = asString(input.email).trim();

  const errors: Partial<Record<keyof ResetRequestInput, string>> = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { email } };
}

export interface NewPasswordInput {
  password: string;
}

/** Validate a new password chosen during the reset flow. */
export function validateNewPassword(
  input: AuthFormInput,
): ValidationResult<NewPasswordInput> {
  const password = asString(input.password);

  const errors: Partial<Record<keyof NewPasswordInput, string>> = {};
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, data: { password } };
}

/** First error message from a validation result's error map, for toasts. */
export function firstError<T>(errors: Partial<Record<keyof T, string>>): string | undefined {
  const values = Object.values(errors) as Array<string | undefined>;
  return values.find((message): message is string => Boolean(message));
}
