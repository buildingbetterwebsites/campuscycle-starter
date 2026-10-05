// Where is the database? Every place in this starter that needs the database's address asks this file,
// so they all find the same one.
//
// WHY two names: on your own computer you write DATABASE_URL in .env.local yourself. On Vercel, the
// Neon connection adds the address for you, and depending on the prefix chosen while connecting it is
// called DATABASE_URL (and DATABASE_URL_UNPOOLED) or STORAGE_URL (and STORAGE_URL_UNPOOLED). Both work,
// so you never have to rename anything. Two DIFFERENT addresses under the two names are refused: this
// file cannot know which one you meant, and guessing could connect the site to the wrong database.
//
// An address contains the database password, so no message here ever repeats one.

/**
 * The database's two addresses: `pooledUrl` for the running website, and `directUrl` (Neon's
 * "unpooled" one) for migrations. Either is '' when it is not set.
 *
 * @param {Record<string, string | undefined>} env usually `process.env`
 * @returns {{ pooledUrl: string, directUrl: string }}
 */
export function databaseEnvironment(env) {
  const pooledUrl = selectUrl(env, 'DATABASE_URL', 'STORAGE_URL')
  const directUrl = selectUrl(env, 'DATABASE_URL_UNPOOLED', 'STORAGE_URL_UNPOOLED')
  return { pooledUrl, directUrl }
}

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} databaseName
 * @param {string} storageName
 */
function selectUrl(env, databaseName, storageName) {
  // trim(): an address pasted with a space or a line break at the end is still the same address.
  const databaseValue = env[databaseName]?.trim()
  const storageValue = env[storageName]?.trim()
  if (databaseValue && storageValue && databaseValue !== storageValue) {
    // The message names the problem; whoever catches it adds the fix that fits (a line in .env.local
    // on your computer, a variable in Vercel). `names` lets them say exactly which two lines.
    throw Object.assign(
      new Error(`Conflicting ${databaseName} and ${storageName}: they hold two different database addresses.`),
      { names: [databaseName, storageName] },
    )
  }
  return databaseValue || storageValue || ''
}
