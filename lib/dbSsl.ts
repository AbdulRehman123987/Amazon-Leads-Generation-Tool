// Supabase's pooler accepts plain-text connections, which would send the
// password exchange and every lead over the internet unencrypted, so TLS is
// switched on for Supabase hosts. Its certificate chain isn't in Node's trust
// store though (standard verification fails with SELF_SIGNED_CERT_IN_CHAIN),
// so the chain isn't verified. Don't add `sslmode=` to DATABASE_URL — it would
// override this with strict verification and fail the same way. Local Postgres
// is left unencrypted.
//
// Plain TypeScript with no imports so scripts/users.mjs can load it directly.
export function sslFor(connectionString: string): { rejectUnauthorized: boolean } | undefined {
  return /@[^@/?#]+\.supabase\.(?:com|co)(?::\d+)?(?:[/?#]|$)/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;
}
