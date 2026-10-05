import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Vercel's import screen turns every active line of .env.example into a row. In the account test, the
// empty DATABASE_URL and BLOB_READ_WRITE_TOKEN rows had to be removed by hand, or they clashed with the
// settings that connecting Neon and Blob add. So only the three names a student types are active.
const lines = readFileSync(new URL('../../.env.example', import.meta.url), 'utf8').split(/\r?\n/)
const active = lines.filter((line) => /^[A-Z_]+=/.test(line)).map((line) => line.split('=')[0])

describe('.env.example', () => {
  it('has exactly the three settings a student types in Vercel as active lines', () => {
    expect(active).toEqual(['PAYLOAD_SECRET', 'FIRST_ADMIN_EMAIL', 'FIRST_ADMIN_PASSWORD'])
  })

  it('keeps DATABASE_URL and BLOB_READ_WRITE_TOKEN as commented lines, ready to uncomment locally', () => {
    expect(lines).toContain('# DATABASE_URL=')
    expect(lines).toContain('# BLOB_READ_WRITE_TOKEN=')
  })

  it('holds no values, only names (apart from the commented members switch, whose value is the switch itself)', () => {
    expect(lines.filter((line) => /^#?\s?[A-Z_]+=./.test(line) && line !== '# MEMBERS_AREA=on')).toEqual([])
  })

  it("keeps the members' area switched off: MEMBERS_AREA=on only as a commented line", () => {
    expect(lines).toContain('# MEMBERS_AREA=on')
    expect(active).not.toContain('MEMBERS_AREA')
  })
})
