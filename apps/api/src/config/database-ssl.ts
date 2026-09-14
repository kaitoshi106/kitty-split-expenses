/** TLS options passed to the Postgres driver. */
export type DatabaseSsl = false | { rejectUnauthorized: boolean };

/**
 * @description Resolves Postgres TLS settings from `DATABASE_SSL`.
 * Local Docker needs no TLS; managed providers (Neon, Supabase, RDS) require it.
 * Skipping certificate verification enables MITM, so it needs the explicit `no-verify` value.
 * @param value - Empty or `false` (no TLS), `true` (verified TLS), or `no-verify` (TLS, unverified).
 */

export function databaseSsl(value: string | undefined): DatabaseSsl {
  switch ((value ?? '').trim().toLowerCase()) {
    case 'true':
      return { rejectUnauthorized: true };
    case 'no-verify':
      return { rejectUnauthorized: false };
    default:
      return false;
  }
}
