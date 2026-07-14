/** Shared application types. Barrel export. */

export type { Database, Json, PublicSchema } from './db';

/**
 * Standard result type returned by Server Actions.
 * Expected failures are returned, not thrown, across the boundary.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
