import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { getTestPayload } from '../setup/payload'

// The database only ever changes through committed migrations (push: false). So if someone changes a
// collection, or the database rules in src/lib/modelSchema.ts, and forgets `npm run migrate:create`,
// the live site would run new code on an old database. This test asks the same question
// `payload migrate:create --skip-empty` asks - "what would a new migration contain?" - without writing
// a file: it compares the schema the config builds now with the snapshot saved by the newest migration.
describe('committed migrations', () => {
  it('cover the whole current config: a new migration would be empty', async () => {
    const p = await getTestPayload()
    const adapter = p.db as unknown as PostgresAdapter
    const { generateDrizzleJson, generateMigration, upSnapshot } = adapter.requireDrizzleKit()
    const current = await generateDrizzleJson(adapter.schema)

    const snapshots = readdirSync(adapter.migrationDir).filter(file => file.endsWith('.json')).sort()
    expect(snapshots.length).toBeGreaterThan(0)
    let saved = JSON.parse(readFileSync(path.join(adapter.migrationDir, snapshots[snapshots.length - 1]), 'utf8'))
    // The same upgrade step Payload applies when an older snapshot format meets a newer drizzle-kit.
    if (upSnapshot && saved.version < current.version) saved = upSnapshot(saved)

    const missing = await generateMigration(saved, current)
    expect(missing, 'Run `npm run migrate:create -- <name>` and commit the new migration.').toEqual([])
  })
})
