import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { seedRoutinesForUser } from '@/lib/db/seed';
import { users, type User } from '@/lib/db/schema';

/**
 * The signed-in user's row, or null.
 *
 * Seeding happens here rather than in a NextAuth event: this path already
 * fetches the user row (for timeZone and unit), so the check is free, and a
 * seed that failed once is retried on the next page load instead of leaving
 * the account permanently empty.
 *
 * `cache` dedupes across one request, so a page and its layout share one read.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) return null;

  if (!user.seededAt) {
    await seedRoutinesForUser(user.id);
    return { ...user, seededAt: new Date() };
  }

  return user;
});

/** Same, but redirects to the landing page when signed out. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  return user;
}
