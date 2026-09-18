import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

/**
 * neon-http: one round trip per statement, no transactions. Every mutation in
 * this app is a single statement or a compare-and-swap, so that is fine. If a
 * real transaction is ever needed, swap to drizzle-orm/neon-serverless.
 */
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema, casing: 'snake_case' });

export { schema };
