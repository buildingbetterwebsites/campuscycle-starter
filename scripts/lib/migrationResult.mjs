// Did the migrations really run? scripts/migrate.mjs prints this exact line as its very last step, only
// after it has checked that every committed migration is recorded in the database.
//
// WHY not trust the exit code alone: in the account test (28 September 2026), `payload migrate` ended
// with exit code 0 - "success" - without changing the database at all, and the live site had no tables.
// So success needs BOTH: exit code 0 AND this line. A program that stops early, for whatever reason,
// never reaches the line.
export const MIGRATIONS_VERIFIED = 'MIGRATIONS: verified committed migrations'

/**
 * The rule itself, for any runner that ends with a check line: exit code 0 AND `marker` as one whole
 * line of its output. The seed runner is judged by it too (scripts/lib/seedResult.mjs).
 *
 * @param {{ status: number | null, stdout?: string | null }} result what the runner's process returned
 *   (`status` is null when the process was stopped, for example after a time-out)
 * @param {string} marker the exact line the runner prints last, once it has really finished
 * @returns {boolean}
 */
export function finishedWithMarker({ status, stdout }, marker) {
  return status === 0 && String(stdout ?? '').split(/\r?\n/).includes(marker)
}

/**
 * @param {{ status: number | null, stdout?: string | null }} result what the migration runner returned
 * @returns {boolean}
 */
export function migrationVerified(result) {
  return finishedWithMarker(result, MIGRATIONS_VERIFIED)
}
