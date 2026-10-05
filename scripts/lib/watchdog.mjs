// A time limit for the migration and seed runners (scripts/migrate.mjs, scripts/seed.mjs).
//
// WHY: a database that never answers (a wrong address, or a firewall that swallows the connection)
// would make a runner wait forever. `npm run migrate` would then sit there with no message at all, and
// the build would only stop at its own limit for each runner (RUNNER_TIME_LIMIT_MS in scripts/build.mjs,
// two minutes), without saying why. The watchdog stops the runner a little earlier, after 110 seconds,
// and says what to do. A Neon database that was asleep normally
// wakes up within a few seconds, so 110 seconds is far more than a working database needs.

export const NO_ANSWER_MESSAGE =
  'The database did not answer within 110 seconds. If your Neon database was asleep, try again; otherwise check the address.'

// The seed's own message. The seed also uploads images and creates records one by one, so when it runs
// out of time the database may well have answered: say what is known, that it did not finish.
export const SEED_TOO_SLOW_MESSAGE =
  'The seed did not finish within 110 seconds. If your Neon database was asleep, try again; otherwise check the database address and the messages above. Run it again when it is fixed: it creates only what is missing.'

/**
 * Starts the time limit. When it runs out, it writes `message` (NO_ANSWER_MESSAGE unless the runner
 * gives its own) and then ends the runner with exit code 1 (never 0, so nobody can mistake it for
 * success). `write` and `exit` can be replaced by a test.
 *
 * @param {{
 *   ms?: number,
 *   message?: string,
 *   write?: (text: string, done: () => void) => unknown,
 *   exit?: (code: number) => unknown,
 * }} [options]
 * @returns {NodeJS.Timeout}
 */
export function startWatchdog({
  ms = 110_000,
  message = NO_ANSWER_MESSAGE,
  write = (text, done) => process.stderr.write(text, done),
  exit = (code) => process.exit(code),
} = {}) {
  // Exit only once the message has really been written out, or the user might never see it.
  const timer = setTimeout(() => write(`${message}\n`, () => exit(1)), ms)
  // unref(): the time limit alone must not keep the runner running once its work is done.
  timer.unref()
  return timer
}
