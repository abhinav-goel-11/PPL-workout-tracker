import 'server-only';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

import { configureNeonFetch } from './neon-config';
import * as schema from './schema';

/**
 * Module evaluation must never throw, and must always yield a real Drizzle
 * instance.
 *
 * `next build` imports every route module to collect its configuration, so a
 * module-scope throw fails the build even though building never queries the
 * database. A lazy Proxy doesn't work either: Auth.js's DrizzleAdapter
 * identifies the dialect with `instanceof`, which a proxy over an empty target
 * fails ("Unsupported database type (object)").
 *
 * So: fall back to a syntactically valid but deliberately unroutable URL. The
 * build succeeds, and a genuinely missing variable surfaces at query time —
 * next to this warning in the logs — instead of as an opaque build error.
 */
const BUILD_PLACEHOLDER_URL = 'postgresql://unset:unset@database-url-is-not-set.invalid/unset';

if (!process.env.DATABASE_URL) {
  console.warn(
    '[db] DATABASE_URL is not set. This is expected during a build, but at ' +
      'runtime every query will fail — set it for each environment you deploy.',
  );
}

configureNeonFetch();

// neon-http: one round trip per statement, no transactions. Every mutation
// here is a single statement or a compare-and-swap, so that is fine. Swap to
// drizzle-orm/neon-serverless if a real transaction is ever needed.
const sql = neon(process.env.DATABASE_URL ?? BUILD_PLACEHOLDER_URL);

export const db = drizzle(sql, { schema, casing: 'snake_case' });

export { schema };
