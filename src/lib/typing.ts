/**
 * Typing-indicator logic — pure, dependency-free rules shared by the DM thread, the
 * per-expense chat, and their tests. Kept out of the component/hook layer so the label
 * rule runs identically in the browser and in tests, with no React or Supabase
 * dependency (the same split `@/lib/chat` and `@/lib/dm` use).
 *
 * Typing state itself is ephemeral and rides Realtime Broadcast (never the database);
 * only the *phrasing* of "X is typing…" lives here.
 */

/** Beyond this many simultaneous typers, names are dropped for a generic phrase. */
const MANY_TYPERS = 3;

/**
 * The line shown under a thread when others are typing. Names are already resolved to
 * how the *viewer* knows each person (roster-relative), so this only phrases them:
 *
 *   []                      → ''            (nothing shown)
 *   ['Bob']                 → 'Bob is typing…'
 *   ['Bob', 'Carol']        → 'Bob and Carol are typing…'
 *   ['Bob', 'Carol', 'Dee'] → 'Several people are typing…'
 *
 * Empty/blank names are ignored so a missing roster name never renders " is typing…".
 */
export function describeTyping(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter((n) => n.length > 0);

  if (clean.length === 0) return '';
  if (clean.length === 1) return `${clean[0]} is typing…`;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]} are typing…`;
  if (clean.length < MANY_TYPERS + 1 /* i.e. exactly 3 */) {
    return `${clean[0]}, ${clean[1]} and ${clean[2]} are typing…`;
  }
  return 'Several people are typing…';
}
