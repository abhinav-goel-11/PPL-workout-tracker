import { defineConfig } from 'drizzle-kit';

// `generate` only needs the schema; migrate/push/studio need a real URL.
const url = process.env.DATABASE_URL ?? 'postgresql://placeholder/placeholder';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
