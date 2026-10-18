// The course check on a team's own model: a site without the starter's clinics and bookings
// (docs/COURSE-CHECK-CONTRACT.md, interpretation 15). It answers "no clinic, no list, no booking",
// never 503, and its team section still answers from the team's config. The site here is made up for
// this test: a rooms collection and a reservations collection, in a database schema of its own that
// the test drops again (the same way as the after-W6 fixture).
import { postgresAdapter, type PostgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import type { PoolClient } from 'pg'
import { buildConfig, getPayload, type CollectionConfig, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { TeamSection } from '../../src/lib/courseCheck'
import { courseCheckResponse } from '../../src/lib/courseCheckResponse'
import { restrictLinkedDeletion } from '../../src/lib/modelSchema'
import { getTestPayload } from '../setup/payload'

const SCHEMA = 'course_check_own_model'

const Rooms: CollectionConfig = {
  slug: 'rooms',
  fields: [{ name: 'name', type: 'text', required: true }],
}
const Reservations: CollectionConfig = {
  slug: 'reservations',
  fields: [
    { name: 'name', type: 'text', required: true },
    // 'as never': this made-up site's slugs are not in the starter's generated types.
    { name: 'room', type: 'relationship', relationTo: 'rooms' as never, required: true },
  ],
}

async function ownModel(): Promise<CollectionConfig[]> {
  // Loaded afresh: Payload marks a collection object as prepared once a config has used it.
  vi.resetModules()
  const { Users } = await import('@/collections/Users')
  const { Throttle } = await import('@/collections/Throttle')
  return [Users, Rooms, Reservations, Throttle]
}

let address = 0
function request(query: string): Request {
  address++
  return new Request(`http://localhost/api/course-check${query}`, { headers: { 'x-forwarded-for': `198.18.200.${address}` } })
}

describe('the course check on a site without clinics and bookings', () => {
  let base: Payload
  let p: Payload

  beforeAll(async () => {
    base = await getTestPayload()
    const pool = (base.db as unknown as PostgresAdapter).pool
    await pool.query(`drop schema if exists ${SCHEMA} cascade`)
    await pool.query(`create schema ${SCHEMA}`)
    const quiet = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      p = await getPayload({
        key: `course-check-${SCHEMA}`,
        disableOnInit: true,
        config: buildConfig({
          admin: { user: 'users' },
          collections: await ownModel(),
          editor: lexicalEditor(),
          secret: process.env.PAYLOAD_SECRET || 'test-secret-0123456789-0123456789',
          logger: { options: { level: 'error' } },
          // The starter's own database rules too: without its example tables they must not stop the site.
          db: postgresAdapter({ beforeSchemaInit: [restrictLinkedDeletion], pool: { connectionString: process.env.TEST_DATABASE_URL }, schemaName: SCHEMA, push: true }),
          graphQL: { disable: true },
          sharp,
        }),
      })
    } finally {
      quiet.mockRestore()
    }
  }, 120_000)

  afterAll(async () => {
    if (p) {
      const pool = (p.db as unknown as PostgresAdapter).pool
      ;(pool as typeof pool & { _clients: PoolClient[] })._clients[0]?.release()
      await pool.end()
      await p.destroy()
    }
    await (base.db as unknown as PostgresAdapter).pool.query(`drop schema if exists ${SCHEMA} cascade`)
  })

  it('answers no clinic, no list, no booking, with a code and without, never 503', async () => {
    for (const query of ['', '?code=T29-7G6N', '?code=BW-7F3K']) {
      const response = await courseCheckResponse(request(query), { payload: p })
      expect(response.status, query).toBe(200)
      expect(await response.text(), query).toBe('{"clinic":false,"whatToBring":null,"booking":false}')
    }
  })

  it("its team section answers from the team's config: its own collections, and the newest record with the code", async () => {
    const room = (await p.create({ collection: 'rooms' as never, data: { name: 'The loft' } as never })) as { id: number }
    await p.create({ collection: 'reservations' as never, data: { name: 'Choir T29-7G6N', room: room.id } as never })
    const config = { transactional: { collection: 'reservations', nameField: 'name' } }
    const response = await courseCheckResponse(request('?include=team&code=T29-7G6N'), { payload: p, teamConfig: config })
    expect(response.status).toBe(200)
    const body = (await response.json()) as { clinic: boolean; whatToBring: unknown; booking: boolean; team: TeamSection }
    expect([body.clinic, body.whatToBring, body.booking]).toEqual([false, null, false])
    expect(body.team.collections.map((collection) => collection.slug)).toEqual(['rooms', 'reservations'])
    expect(body.team.collections.map((collection) => collection.count)).toEqual([1, 1])
    expect(body.team.transactional).toMatchObject({ collection: 'reservations', status: 'ok', codeField: 'name' })
    expect(body.team.transactional.newest).not.toBeNull()
  })
})
