/**
 * Friend-relationship logic — pure, dependency-free rules shared by the Friends
 * page (status labels) and the add-friend Server Action (request-vs-invite
 * routing). Kept out of the query/action layer so they run identically on the
 * server and in tests, with no Supabase dependency.
 *
 * A "friend" is a `members` row the owner links to a real account — there is no
 * separate social graph (see the collaboration roadmap). These helpers derive
 * where a member sits on that linking journey, and how a newly-entered email
 * should be routed.
 */

/**
 * Where a friend member sits on the linking journey:
 *   - `linked`      — a real account has claimed the member (an accepted friend).
 *   - `invited`     — an invite/request is out and still pending.
 *   - `not_invited` — a contact with an email but no live invite yet.
 */
export type FriendStatus = 'linked' | 'invited' | 'not_invited';

/** Derive a member's {@link FriendStatus} from its link + pending-invite state. */
export function friendStatus(input: {
  linkedUserId: string | null;
  hasPendingInvite: boolean;
}): FriendStatus {
  if (input.linkedUserId) return 'linked';
  return input.hasPendingInvite ? 'invited' : 'not_invited';
}

/**
 * How an add-by-email should be routed once we know whether the email already has
 * an account:
 *   - `self`    — the email is the owner's own account; adding yourself is rejected.
 *   - `request` — the email has an account (not the owner) → in-app friend request.
 *   - `invite`  — no account for the email → email invite to register and claim.
 *
 * `profileId` is the account id found for the email (or null when none exists);
 * `ownerId` is the current owner's account id.
 */
export type AddFriendRoute = 'self' | 'request' | 'invite';

export function decideAddRoute(input: {
  profileId: string | null;
  ownerId: string;
}): AddFriendRoute {
  if (!input.profileId) return 'invite';
  return input.profileId === input.ownerId ? 'self' : 'request';
}
