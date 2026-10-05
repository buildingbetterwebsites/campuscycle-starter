// Did the seed really run? scripts/seed.mjs prints this exact line as its very last step, only after
// the seed finished correctly: the first editor checked, and the example content added, or skipped
// because it was added before.
//
// WHY: the seed used to start through Payload's own command (`payload run`), which uses the same
// TypeScript loader that once ended a migration with "success" without doing anything (see
// scripts/migrate.mjs). So the seed is judged by the same rule as the migrations: exit code 0 AND this
// line (finishedWithMarker, in scripts/lib/migrationResult.mjs).
import { finishedWithMarker } from './migrationResult.mjs'

export const SEED_VERIFIED = 'SEED: verified'

/**
 * @param {{ status: number | null, stdout?: string | null }} result what the seed runner returned
 * @returns {boolean}
 */
export function seedVerified(result) {
  return finishedWithMarker(result, SEED_VERIFIED)
}
