// The environment variables the Vercel build (scripts/build.mjs) gives the migration runner and the
// seed runner when it starts them.
//
// WHY: a runner finds its database the same way the site does (scripts/lib/databaseEnv.mjs): under
// DATABASE_URL or under STORAGE_URL. The build has already chosen the address to use (the direct one,
// when Vercel provides it). If the runner also saw a STORAGE_URL with the other (pooled) address, it
// would find two different addresses and refuse to start. So the runner gets exactly one: the chosen
// address under DATABASE_URL, and no STORAGE_* names at all.

/**
 * @param {Record<string, string | undefined>} variables the build's own variables (usually process.env);
 *   they are not changed
 * @param {string} url the database address the runner must use
 * @returns {Record<string, string | undefined>} a copy: DATABASE_URL set, the STORAGE_* names gone
 */
export function migrationEnv(variables, url) {
  const env = { ...variables, DATABASE_URL: url }
  // Delete the names, rather than setting them to undefined: not every program that receives these
  // variables drops an undefined one; some pass on the text "undefined" instead.
  delete env.STORAGE_URL
  delete env.STORAGE_URL_UNPOOLED
  return env
}
