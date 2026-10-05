// Some tests delete every user (and every example record) in the database they run on. On the test
// database that is exactly what they should do; on a real site's database it would lock every editor
// out. So those tests refuse to run unless TEST_DATABASE_URL points at this computer (127.0.0.1 or
// localhost: the in-memory test database, or a Postgres you started for testing), or CI is set (the
// CI service's database is thrown away after the run).

/** True when it is safe to delete everything in the database at `url`. */
export function isThrowAwayTestDatabase(
  url: string | undefined,
  env: Record<string, string | undefined>,
): boolean {
  if (env.CI) return true
  if (!url) return false
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost'
  } catch {
    return false
  }
}

/** Call at the top of a test file that deletes users: it stops the whole file on any other database. */
export function refuseUnlessThrowAwayTestDatabase(): void {
  if (!isThrowAwayTestDatabase(process.env.TEST_DATABASE_URL, process.env)) {
    throw new Error(
      'REFUSED: these tests delete every user in the test database, so they only run when TEST_DATABASE_URL ' +
        'points at this computer (127.0.0.1 or localhost), or in CI. Unset TEST_DATABASE_URL to use the ' +
        'in-memory test database.',
    )
  }
}
