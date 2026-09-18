import { neonConfig } from '@neondatabase/serverless';

/**
 * Points the SQL-over-HTTP driver at the endpoint host itself.
 *
 * The driver's default builds the URL by replacing the endpoint label with
 * `api.`:
 *
 *   ep-xxx-pooler.us-east-2.aws.neon.tech -> api.us-east-2.aws.neon.tech
 *
 * Neon's newer hosts (the ones Vercel's integration provisions) carry a
 * compute-routing segment, so that rewrite leaves it stranded:
 *
 *   ep-xxx-pooler.c-7.us-east-2.aws.neon.tech -> api.c-7.us-east-2.aws.neon.tech
 *
 * which does not resolve — every query fails with `fetch failed` / ENOTFOUND.
 * The endpoint host serves `/sql` directly, so use it verbatim.
 */
export function configureNeonFetch(): void {
  neonConfig.fetchEndpoint = (host) => `https://${host}/sql`;
}
