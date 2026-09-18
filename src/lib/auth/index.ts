import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';

import { db } from '@/lib/db';
import { accounts, sessions, users, verificationTokens } from '@/lib/db/schema';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

/** Requested separately from Settings, never at sign-in. See `CALENDAR_SCOPE`. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export const { handlers, auth, signIn, signOut } = NextAuth({
  /**
   * Adapter + JWT sessions, deliberately.
   *
   * The adapter persists `accounts`, which is where Google's refresh token
   * lives. Pure-JWT would keep tokens in the cookie, but a Server Component
   * can't set cookies in Next — so a refresh triggered during an RSC render
   * would throw the new token state away and re-refresh on every page load.
   */
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
  providers: [
    Google({
      // Basic scopes only. The sensitive calendar scope is requested later via
      // incremental auth, so Google's verification review can't block sign-in.
      authorization: {
        params: {
          scope: 'openid email profile',
          prompt: 'select_account',
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
