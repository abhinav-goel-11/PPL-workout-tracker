import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema';

/** Thrown when the user must re-grant access; never let this 500 a page. */
export class GoogleReauthRequired extends Error {
  constructor(reason: string) {
    super(`Google re-authorisation required: ${reason}`);
    this.name = 'GoogleReauthRequired';
  }
}

/** Refresh a little early so a token can't expire mid-request. */
const EXPIRY_SKEW_SECONDS = 120;

type RefreshResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
};

/**
 * A valid Google access token for this user, refreshing when needed.
 *
 * Deliberately not in the NextAuth `jwt` callback: a Server Component can't
 * set cookies, so a refresh during an RSC render would be thrown away and
 * repeated on every page load. `accounts` is the single source of truth.
 */
export async function getGoogleAccessToken(userId: string): Promise<string> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'google')))
    .limit(1);

  if (!account) throw new GoogleReauthRequired('no google account linked');
  if (account.requiresReauth) throw new GoogleReauthRequired('previously revoked');
  if (!account.refresh_token) throw new GoogleReauthRequired('no refresh token stored');

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    account.access_token &&
    account.expires_at &&
    account.expires_at - EXPIRY_SKEW_SECONDS > nowSeconds
  ) {
    return account.access_token;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
    cache: 'no-store',
  });

  const json = (await response.json()) as RefreshResponse;

  if (!response.ok) {
    // invalid_grant = revoked, expired, or password changed. Mark it so the
    // UI can offer "Reconnect" instead of retrying forever.
    if (json.error === 'invalid_grant') {
      await db
        .update(accounts)
        .set({ requiresReauth: true })
        .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'google')));
      throw new GoogleReauthRequired('invalid_grant');
    }
    throw new Error(`Google token refresh failed: ${response.status}`);
  }

  await db
    .update(accounts)
    .set({
      access_token: json.access_token,
      expires_at: Math.floor(Date.now() / 1000) + json.expires_in,
      // Google returns a refresh token only on first consent — never
      // overwrite the stored one with undefined.
      refresh_token: json.refresh_token ?? account.refresh_token,
    })
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.provider, 'google'),
        // Compare-and-swap: neon-http has no transactions, so this is how a
        // concurrent refresh is prevented from clobbering a newer token.
        account.expires_at === null
          ? isNull(accounts.expires_at)
          : eq(accounts.expires_at, account.expires_at),
      ),
    );

  return json.access_token;
}

/** Whether the calendar scope has actually been granted. */
export async function getCalendarStatus(
  userId: string,
): Promise<{ connected: boolean; requiresReauth: boolean }> {
  const [account] = await db
    .select({
      scope: accounts.scope,
      requiresReauth: accounts.requiresReauth,
      refreshToken: accounts.refresh_token,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, 'google')))
    .limit(1);

  if (!account) return { connected: false, requiresReauth: false };

  return {
    connected:
      !account.requiresReauth &&
      Boolean(account.refreshToken) &&
      Boolean(account.scope?.includes('calendar.events')),
    requiresReauth: account.requiresReauth,
  };
}
