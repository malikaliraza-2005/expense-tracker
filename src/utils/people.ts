/**
 * People lookup — the single source of truth for how the app searches and
 * de-duplicates the owner's people. Email is a stronger identity signal than a
 * (possibly repeated) name, so every lookup here is EMAIL-FIRST, then name.
 * Pure and dependency-free, so it runs identically on the server and client and
 * has nothing to do with how expenses are split.
 */

export interface Person {
  id: string;
  name: string;
  email: string | null;
  isSelf?: boolean;
}

const norm = (value: string): string => value.trim().toLowerCase();

/** Match strength for a person against a normalised query. 0 = no match. */
function scorePerson(person: Person, q: string): number {
  const email = norm(person.email ?? '');
  const name = norm(person.name);
  // Email outranks name at every tier: an email hit always beats a name hit.
  if (email) {
    if (email === q) return 6;
    if (email.startsWith(q)) return 5;
    if (email.includes(q)) return 4;
  }
  if (name === q) return 3;
  if (name.startsWith(q)) return 2;
  if (name.includes(q)) return 1;
  return 0;
}

/**
 * People matching `query`, ranked email-first then by name. An empty query
 * returns everyone in the given order (callers show the full list). Never
 * mutates its input.
 */
export function matchPeople<T extends Person>(query: string, people: T[]): T[] {
  const q = norm(query);
  if (!q) return people;
  return people
    .map((person) => ({ person, score: scorePerson(person, q) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name),
    )
    .map((entry) => entry.person);
}

/**
 * The existing person a new (name, email) pair would duplicate, or undefined.
 * Email is checked first (exact), then an exact name — the two signals we treat
 * as "the same person" so we never create a second row for someone.
 */
export function findExisting<T extends Person>(
  name: string,
  email: string,
  people: T[],
): T | undefined {
  const e = norm(email);
  if (e) {
    const byEmail = people.find((person) => norm(person.email ?? '') === e);
    if (byEmail) return byEmail;
  }
  const n = norm(name);
  if (!n) return undefined;
  return people.find((person) => norm(person.name) === n);
}
