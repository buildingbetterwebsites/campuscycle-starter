// What a seed run does, in order. scripts/seed.mjs starts it, for the production build
// (scripts/build.mjs) and for `npm run seed` on your own computer (through scripts/guard.mjs, which
// first makes sure the database is not the live one).
//
// 1. The first editor account, on every run (it is created only when no editor exists yet).
// 2. The example content, only the first time: once a run has added it, the database remembers that
//    (src/seed/exampleFlag.ts) and later runs skip it, so nothing editors deleted comes back.
//    `npm run seed -- --again` adds back the missing example records anyway; it never overwrites one.
// Why this order: a seed that fails (for example on Vercel without a Blob store) still leaves the
// first editor created, so you can log in to /admin while you fix the rest.
import type { Payload } from 'payload'
import { createFirstAdmin } from '../lib/firstAdmin'
import { exampleWasAdded, recordExampleAdded } from './exampleFlag'
import { ADD_EXAMPLE_CONTENT, seed } from './seed'

export const SKIPPED_LINE =
  "SEED: skipped (the example content was added before; your editors' changes are kept)"

export type RunSeedOptions = {
  /** `npm run seed -- --again`: add back the example records that are missing, even after the first time. */
  again?: boolean
  /** false: create only the first editor, no example content (ADD_EXAMPLE_CONTENT in src/seed/seed.ts). */
  addExampleContent?: boolean
  /** Where to look for VERCEL and BLOB_READ_WRITE_TOKEN; normally process.env. */
  env?: Record<string, string | undefined>
}

export type RunSeedResult = {
  /** added: this run added the example (or what was missing of it); skipped: added before; off: switched off. */
  example: 'added' | 'skipped' | 'off'
  created: number
  skipped: number
}

export async function runSeed(
  payload: Payload,
  {
    again = false,
    addExampleContent = ADD_EXAMPLE_CONTENT,
    env = process.env,
  }: RunSeedOptions = {},
): Promise<RunSeedResult> {
  // First the editor account from FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD, if no editor exists yet,
  // so a brand-new site never shows its "create the first user" screen to whoever comes first.
  await createFirstAdmin(payload)

  if (!addExampleContent) {
    console.log('SEED: no example content added (ADD_EXAMPLE_CONTENT is false in src/seed/seed.ts)')
    return { example: 'off', created: 0, skipped: 0 }
  }

  if (!again && (await exampleWasAdded(payload))) {
    console.log(SKIPPED_LINE)
    // On your own computer you can still bring back example records you deleted. Not on Vercel: there
    // the build cannot take extra options, and the guard refuses `npm run seed` on the live database.
    if (!env.VERCEL) {
      console.log(
        'SEED: to add back example records that were deleted, run `npm run seed -- --again` (it never overwrites anything).',
      )
    }
    return { example: 'skipped', created: 0, skipped: 0 }
  }

  const result = await seed(payload, { env })
  // Only after a run that finished: a run that stopped halfway is simply run again next time, and then
  // creates only what is still missing.
  await recordExampleAdded(payload)
  // "kept": records that were already there, left exactly as they were.
  const note = again
    ? ' (--again: only missing example records were added back; nothing was overwritten)'
    : ''
  console.log(`SEED: created ${result.created}, kept ${result.skipped}${note}`)
  return { example: 'added', ...result }
}
