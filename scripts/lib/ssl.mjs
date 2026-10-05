// A Neon connection string ends in `?sslmode=require` (and Vercel's Storage integration can also hand
// out one with `sslmode=prefer`) - both make `pg`'s connection-string parser print a "SECURITY
// WARNING" on every single connection, because both leave the server's certificate unverified.
// `verify-full` is the fix node-postgres itself recommends: it keeps the connection encrypted AND
// checks the server's certificate, which Neon's endpoints have a valid one for - so this is strictly
// safer, not a work-around for the warning text. Nothing else about the connection string changes.
//
// Shared by every place that opens a real connection with the raw DATABASE_URL: scripts/lib/marker.mjs
// (its own `pg` connection for the production marker) and src/payload.config.ts (Payload's own
// connection pool) - the warning showed up wherever a real DATABASE_URL was actually used to connect,
// not just in one of them.
export function withVerifiedSsl(url) {
  return url.replace(/([?&]sslmode=)(require|prefer)\b/, '$1verify-full')
}
