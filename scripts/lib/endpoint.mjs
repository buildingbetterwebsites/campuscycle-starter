// Neon gives every database two connection strings that name the SAME endpoint: a pooled one (host
// ends in "-pooler") for normal app traffic, and a direct one (no "-pooler") for migrations. Both
// start with the endpoint's id, "ep-…". Reading that id out of either address is how the rest of this
// starter tells "the same database" from "a different one", without ever comparing full connection
// strings (which differ in the "-pooler" part even when they name the same database).

/** Neon's endpoint id (the "ep-…" part of the database host), the same for its pooled and direct address. */
export function endpointId(url) {
  if (!url) return null
  let host
  try {
    // A postgres:// URL is not one of the WHATWG "special" schemes (http, https, ...), so unlike
    // those, its hostname is NOT lower-cased automatically - do that ourselves before matching.
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  // Matches from "ep-" up to, not including, an optional "-pooler" and the next dot - so
  // "ep-a-pooler-b-1.c-2...." and "ep-a-pooler-b-1...." (no "-pooler" suffix at all) both give
  // "ep-a-pooler-b-1", even though "pooler" also happens to appear inside that id.
  const match = host.match(/^ep-[a-z0-9-]+?(?=(-pooler)?\.)/)
  return match ? match[0] : null
}
