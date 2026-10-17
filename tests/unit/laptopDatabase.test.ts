// Starting your laptop's database by itself (scripts/lib/laptopDatabase.mjs): start it when nothing
// answers, use the one that answers, and never let two processes open the same data folder.
// `open` is replaced by a stand-in that only listens on a free port, so these run in milliseconds and
// never touch PGlite (tests/integration/laptop-database-reuse.test.ts starts the real one).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureLaptopDatabase, LOCK_FILE, NOT_OURS } from '../../scripts/lib/laptopDatabase.mjs'

let root: string
let port: number
const servers: net.Server[] = []

async function freePort(): Promise<number> {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function listen(at: number): Promise<net.Server> {
  const server = net.createServer((socket) => socket.destroy())
  await new Promise<void>((resolve) => server.listen(at, '127.0.0.1', resolve))
  servers.push(server)
  return server
}

/** A stand-in for opening PGlite: takes a moment, then answers on the port, like the real one. */
function fakeOpen() {
  return vi.fn(async ({ port: at }: { folder: string; host: string; port: number }) => {
    await new Promise((resolve) => setTimeout(resolve, 200))
    const server = await listen(at)
    return { stop: async () => void (await new Promise((resolve) => server.close(resolve))) }
  })
}

const lockFile = () => path.join(root, LOCK_FILE)

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'bw-laptop-db-'))
  port = await freePort()
})

afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise((resolve) => server.close(resolve))
  rmSync(root, { recursive: true, force: true })
})

describe('ensureLaptopDatabase', () => {
  it('starts it when nothing answers, holds the lock while it runs, and lets go when stopped', async () => {
    const open = fakeOpen()
    const database = await ensureLaptopDatabase({ root, port, open })
    expect(database.started).toBe(true)
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0][0]).toEqual({ folder: path.join(root, '.data/db'), host: '127.0.0.1', port })
    expect(readFileSync(lockFile(), 'utf8')).toBe(String(process.pid))
    await database.stop()
    expect(existsSync(lockFile())).toBe(false)
  })

  it("uses the database that answers when this project's own lock is held by a live process, and never opens the folder", async () => {
    await listen(port)
    // This project's lock, held by a live process (here: this test's own).
    mkdirSync(path.dirname(lockFile()), { recursive: true })
    writeFileSync(lockFile(), String(process.pid))
    const open = fakeOpen()
    const database = await ensureLaptopDatabase({ root, port, open })
    expect(database.started).toBe(false)
    expect(open).not.toHaveBeenCalled()
    expect(readFileSync(lockFile(), 'utf8')).toBe(String(process.pid))
  })

  it("refuses what answers when this project holds no lock: another copy's database, never used", async () => {
    await listen(port)
    const open = fakeOpen()
    await expect(ensureLaptopDatabase({ root, port, open })).rejects.toMatchObject({ code: NOT_OURS })
    expect(open).not.toHaveBeenCalled()
    expect(existsSync(lockFile())).toBe(false)
  })

  it("refuses what answers when this project's lock is stale (its process is gone), and leaves the lock alone", async () => {
    await listen(port)
    mkdirSync(path.dirname(lockFile()), { recursive: true })
    writeFileSync(lockFile(), '2147483646')
    const open = fakeOpen()
    await expect(ensureLaptopDatabase({ root, port, open })).rejects.toMatchObject({ code: NOT_OURS })
    expect(open).not.toHaveBeenCalled()
    expect(readFileSync(lockFile(), 'utf8')).toBe('2147483646')
  })

  it('two commands at the same moment: only one opens the folder, the other uses it', async () => {
    const open = fakeOpen()
    const both = await Promise.all([ensureLaptopDatabase({ root, port, open }), ensureLaptopDatabase({ root, port, open })])
    expect(open).toHaveBeenCalledTimes(1)
    expect(both.map((database) => database.started).sort()).toEqual([false, true])
    await Promise.all(both.map((database) => database.stop()))
  })

  it('removes a lock left behind by a process that is gone, then starts it', async () => {
    mkdirSync(path.dirname(lockFile()), { recursive: true })
    // Far above any real process id: no such process.
    writeFileSync(lockFile(), '2147483646')
    const open = fakeOpen()
    const database = await ensureLaptopDatabase({ root, port, open })
    expect(database.started).toBe(true)
    expect(readFileSync(lockFile(), 'utf8')).toBe(String(process.pid))
    await database.stop()
  })

  it('a live process holds the lock but nothing ever answers: stops with the reason, never opens the folder', async () => {
    mkdirSync(path.dirname(lockFile()), { recursive: true })
    writeFileSync(lockFile(), String(process.pid))
    const open = fakeOpen()
    await expect(ensureLaptopDatabase({ root, port, open, waitMs: 300 })).rejects.toThrow(
      `holds ${LOCK_FILE}, but nothing answers at 127.0.0.1:${port}. If no other terminal runs this project, delete the file ${LOCK_FILE}`,
    )
    expect(open).not.toHaveBeenCalled()
  })

  it('opening fails: passes the reason on and lets go of the lock', async () => {
    const open = vi.fn(async () => {
      throw new Error('the folder is damaged')
    })
    await expect(ensureLaptopDatabase({ root, port, open })).rejects.toThrow('the folder is damaged')
    expect(existsSync(lockFile())).toBe(false)
  })
})
