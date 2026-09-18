import { defineConfig } from 'drizzle-kit';

/**
 * Migrations prefer the *direct* connection.
 *
 * DATABASE_URL is Neon's pooled endpoint (PgBouncer, transaction mode), which
 * is right for the app — neon-http opens a connection per query — but wrong
 * for DDL, which runs in a transaction and takes advisory locks that a
 * transaction pooler can drop. Neon exposes the direct endpoint as
 * DATABASE_URL_UNPOOLED; fall back to the pooled one when it isn't set.
 *
 * `generate` needs no connection at all, hence the placeholder.
 */
const url =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  'postgresql://placeholder/placeholder';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
