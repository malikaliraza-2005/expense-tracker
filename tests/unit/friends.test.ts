import { describe, expect, it } from 'vitest';

import { decideAddRoute, friendStatus } from '@/lib/friends';

/**
 * Phase 4 — pure friend-relationship rules. `friendStatus` labels where a member
 * sits on the account-linking journey; `decideAddRoute` chooses request vs invite
 * (vs. rejecting self) once an email's account existence is known.
 */

describe('friendStatus', () => {
  it('is "linked" whenever an account has claimed the member', () => {
    // A live invite is irrelevant once linked — linked wins.
    expect(
      friendStatus({ linkedUserId: 'user-1', hasPendingInvite: false }),
    ).toBe('linked');
    expect(
      friendStatus({ linkedUserId: 'user-1', hasPendingInvite: true }),
    ).toBe('linked');
  });

  it('is "invited" when unlinked with a pending invite', () => {
    expect(
      friendStatus({ linkedUserId: null, hasPendingInvite: true }),
    ).toBe('invited');
  });

  it('is "not_invited" when unlinked with no pending invite', () => {
    expect(
      friendStatus({ linkedUserId: null, hasPendingInvite: false }),
    ).toBe('not_invited');
  });
});

describe('decideAddRoute', () => {
  it('routes to an email invite when no account exists for the email', () => {
    expect(decideAddRoute({ profileId: null, ownerId: 'owner' })).toBe('invite');
  });

  it('routes to an in-app request when another account has the email', () => {
    expect(
      decideAddRoute({ profileId: 'someone-else', ownerId: 'owner' }),
    ).toBe('request');
  });

  it('rejects adding yourself when the email is the owner’s own account', () => {
    expect(decideAddRoute({ profileId: 'owner', ownerId: 'owner' })).toBe(
      'self',
    );
  });
});
