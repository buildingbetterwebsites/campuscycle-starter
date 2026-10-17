// Your laptop's database takes a limited number of connections at once (50). A command such as
// `npm run migrate` or `npm run seed` ends with its connections still open (Payload keeps one open, so
// the runners end the process themselves). pglite-socket then sees the connection fail instead of
// close, and kept its place taken for good: after enough commands next to a running `npm run dev`,
// every new connection was refused, and `npm run migrate` stopped with "MIGRATIONS: FAILED" (or Node's
// "unsettled top-level await") and no plain reason.
//
// Here the real laptop database (scripts/lib/laptopDatabase.mjs) runs with room for 4 connections, in
// a folder and on a port of this test's own. Three commands that each end with 2 connections open
// would use up 6 places; a fourth connection must still get in.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { openLaptopDatabase } from '../../scripts/lib/laptopDatabase.mjs'

const folder = mkdtempSync(path.join(tmpdir(), 'bw-laptop-db-places-'))
let database: { stop: () => Promise<void> } | undefined

async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

/** A command that queries over two connections, then ends its process with both still open. */
function commandThatExitsWithOpenConnections(url: string): Promise<number | null> {
  const code = `
    import pg from 'pg'
    const pool = new pg.Pool({ connectionString: process.env.URL })
    await Promise.all([pool.query('select 1'), pool.query('select 2')])
    process.exit(0)
  `
  return new Promise((resolve) => {
    spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, URL: url }, stdio: 'inherit', windowsHide: true }).on('exit', resolve)
  })
}

afterAll(async () => {
  await database?.stop()
  rmSync(folder, { recursive: true, force: true })
})

describe("your laptop's database keeps taking connections", () => {
  it('after commands that ended with their connections open, a new connection still gets in', async () => {
    const port = await freePort()
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`
    database = await openLaptopDatabase({ folder, host: '127.0.0.1', port, maxConnections: 4 })

    for (let i = 0; i < 3; i++) expect(await commandThatExitsWithOpenConnections(url)).toBe(0)
    // The server notices the ended connections a moment later.
    await new Promise((resolve) => setTimeout(resolve, 500))

    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 })
    try {
      await client.connect()
      expect((await client.query('select 1 as one')).rows[0].one).toBe(1)
    } finally {
      await client.end().catch(() => {})
    }
  }, 60_000)
})
