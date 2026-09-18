/**
 * Applies migrations.
 *
 * Not `drizzle-kit migrate`: that spins up its own driver instance, so it
 * can't be given the fetchEndpoint override in src/lib/db/neon-config.ts that
 * Neon's compute-routing hosts require.
 */
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;

// The direct endpoint is preferred for DDL: it runs in a transaction and takes
// advisory locks that a transaction pooler can drop.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

console.log('Applying migrations to %s …', new URL(url).hostname);

try {
  await migrate(drizzle(neon(url)), { migrationsFolder: './drizzle' });
  console.log('Migrations applied.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
