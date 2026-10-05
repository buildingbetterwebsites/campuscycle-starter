import { describe, expect, it } from 'vitest'
import { decideBuild, decideLocal } from '../../scripts/lib/decide.mjs'

// Real-shaped addresses for three different Neon endpoints (A, B, P for "preview"), pooled and direct
// forms of each, plus a plain non-Neon address (for example your own local Postgres).
const pooled = (id: string) => `postgres://u:p@${id}-pooler.eu-central-1.aws.neon.tech/db`
const direct = (id: string) => `postgres://u:p@${id}.eu-central-1.aws.neon.tech/db`
const A_POOLED = pooled('ep-a')
const A_DIRECT = direct('ep-a')
const B_DIRECT = direct('ep-b')
const P_POOLED = pooled('ep-p')
const P_DIRECT = direct('ep-p')
const NOT_NEON = 'postgres://postgres:postgres@127.0.0.1:5432/postgres'
const SECRET = 'x'.repeat(32)

describe('decideBuild', () => {
  it('production, fresh database (no marker yet): migrates, writes the marker, seeds', () => {
    const decision = decideBuild({
      env: 'production',
      databaseUrl: A_POOLED,
      unpooledUrl: A_DIRECT,
      marker: null,
      secret: SECRET,
    })
    expect(decision).toMatchObject({ migrate: true, writeMarker: true, seed: true })
    expect(decision.fatal).toBeUndefined()
  })

  it('production, a marker restored or copied from elsewhere: still migrates and upserts its own id', () => {
    const decision = decideBuild({
      env: 'production',
      databaseUrl: A_POOLED,
      unpooledUrl: A_DIRECT,
      marker: 'ep-b', // a stale marker (for example the database was restored from another one's backup)
      secret: SECRET,
    })
    expect(decision).toMatchObject({ migrate: true, writeMarker: true, seed: true })
    expect(decision.fatal).toBeUndefined()
  })

  it('production, pooled address only (no DATABASE_URL_UNPOOLED): still migrates', () => {
    // DATABASE_URL_UNPOOLED absent entirely, not merely equal - Vercel does not always provide it.
    const decision = decideBuild({
      env: 'production',
      databaseUrl: A_POOLED,
      unpooledUrl: undefined,
      marker: null,
      secret: SECRET,
    })
    expect(decision).toMatchObject({ migrate: true, writeMarker: true, seed: true })
    expect(decision.fatal).toBeUndefined()
  })

  it('production, DATABASE_URL and DATABASE_URL_UNPOOLED name different endpoints: fatal, whatever the marker is', () => {
    for (const marker of [null, 'ep-a', 'ep-b', 'ep-p']) {
      const decision = decideBuild({
        env: 'production',
        databaseUrl: A_POOLED,
        unpooledUrl: B_DIRECT,
        marker,
        secret: SECRET,
      })
      // Its own label ("DATABASE SET UP WRONG:"), never build.mjs's blanket "NOT CONFIGURED YET:".
      expect(decision.fatal).toContain('DATABASE SET UP WRONG:')
      expect(decision.fatal).not.toContain('NOT CONFIGURED YET')
      expect(decision.fatal).toContain('(DATABASE_URL and DATABASE_URL_UNPOOLED, or STORAGE_URL and STORAGE_URL_UNPOOLED)')
      expect(decision.fatal).toContain('point at different databases')
      expect(decision.migrate).toBe(false)
      expect(decision.writeMarker).toBe(false)
      expect(decision.seed).toBe(false)
    }
  })

  it('production, no database configured at all: fatal, "NOT CONFIGURED YET: there is no database …"', () => {
    const decision = decideBuild({
      env: 'production',
      databaseUrl: undefined,
      unpooledUrl: undefined,
      marker: null,
      secret: SECRET,
    })
    expect(decision.fatal).toContain('NOT CONFIGURED YET')
    expect(decision.fatal).toContain('there is no database')
    expect(decision.migrate).toBe(false)
  })

  it('production, DATABASE_URL is not a Neon host: fatal BEFORE anything runs', () => {
    const decision = decideBuild({
      env: 'production',
      databaseUrl: NOT_NEON,
      unpooledUrl: undefined,
      marker: null,
      secret: SECRET,
    })
    expect(decision.fatal).toContain('NOT CONFIGURED YET')
    expect(decision.fatal).toContain('must be a Neon database')
    expect(decision.fatal).toContain('Vercel Storage')
    expect(decision.migrate).toBe(false)
    expect(decision.writeMarker).toBe(false)
    expect(decision.seed).toBe(false)
  })

  it('preview, marker proves this is a copy of production: migrates, but never writes a marker or seeds', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: P_POOLED,
      unpooledUrl: P_DIRECT,
      marker: 'ep-a', // production's own marker, different from this preview's endpoint
      secret: SECRET,
    })
    expect(decision).toMatchObject({ migrate: true, writeMarker: false, seed: false })
  })

  it('preview, pooled address only (no DATABASE_URL_UNPOOLED): still migrates when the marker proves a copy', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: P_POOLED,
      unpooledUrl: undefined,
      marker: 'ep-a',
      secret: SECRET,
    })
    expect(decision).toMatchObject({ migrate: true, writeMarker: false, seed: false })
  })

  it('preview, pooled address only, no marker: does not migrate either', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: P_POOLED,
      unpooledUrl: undefined,
      marker: null,
      secret: SECRET,
    })
    expect(decision.migrate).toBe(false)
    expect(decision.fatal).toBeUndefined()
  })

  it('preview, DATABASE_URL is production\'s own address: STOPS the build, does not just skip migrating', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: A_POOLED,
      unpooledUrl: A_DIRECT,
      marker: 'ep-a', // production's marker names this same endpoint
      secret: SECRET,
    })
    expect(decision.migrate).toBe(false)
    // Exact wording, verbatim, now naming the STORAGE_* names Neon can choose too.
    expect(decision.fatal).toBe(
      "STOPPED: this preview is connected to your LIVE database, so anything done on the preview would change your real site. In Vercel: Settings → Environment Variables → make sure DATABASE_URL and DATABASE_URL_UNPOOLED (or STORAGE_URL and STORAGE_URL_UNPOOLED) for Preview are your preview branch's, not Production's (docs/guides/local-setup.md explains the preview branch), then redeploy.",
    )
  })

  it('preview, no production marker recorded yet: refuses, with a beginner-friendly explanation', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: P_POOLED,
      unpooledUrl: P_DIRECT,
      marker: null,
      secret: SECRET,
    })
    expect(decision.migrate).toBe(false)
    expect(decision.fatal).toBeUndefined()
    expect(decision.reason).toBe(
      'not running on this preview (its database is not a copy of your live one yet; this is normal before your first production deploy, see docs/guides/troubleshooting.md#preview-not-migrated).',
    )
  })

  it('preview, host is not Neon at all: refuses, worded so a student knows this is expected', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: NOT_NEON,
      unpooledUrl: NOT_NEON,
      marker: 'ep-a',
      secret: SECRET,
    })
    expect(decision.migrate).toBe(false)
    expect(decision.fatal).toBeUndefined()
    expect(decision.reason).toBe(
      'not running on this preview (its database is not a Neon database, so this starter cannot tell whether it is a safe copy; previews should use your Neon preview branch — see docs/guides/local-setup.md).',
    )
  })

  it('preview, no database at all: fatal, worded for previews specifically, not production\'s message', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: undefined,
      unpooledUrl: undefined,
      marker: null,
      secret: SECRET,
    })
    expect(decision.fatal).toContain('NOT CONFIGURED YET')
    expect(decision.fatal).toContain('this preview has no database of its own')
    expect(decision.fatal).toContain('docs/guides/local-setup.md')
    // Not the production wording ("connect Neon (Postgres) to this project" alone, with no mention
    // that previews need their own) - a preview reading production's message would just reconnect
    // Neon to Production again, which does nothing for the preview.
    expect(decision.fatal).not.toBe(
      decideBuild({ env: 'production', databaseUrl: undefined, unpooledUrl: undefined, marker: null, secret: SECRET })
        .fatal,
    )
  })

  it('preview, DATABASE_URL and DATABASE_URL_UNPOOLED name different endpoints: fatal, whatever the marker is', () => {
    for (const marker of [null, 'ep-a', 'ep-b', 'ep-p']) {
      const decision = decideBuild({
        env: 'preview',
        databaseUrl: P_POOLED,
        unpooledUrl: A_DIRECT,
        marker,
        secret: SECRET,
      })
      expect(decision.fatal).toContain('DATABASE SET UP WRONG:')
      expect(decision.fatal).toContain('point at different databases')
    }
  })

  it('a non-Neon pooled address with a Neon unpooled address: still a mismatch', () => {
    const decision = decideBuild({
      env: 'production',
      databaseUrl: NOT_NEON,
      unpooledUrl: A_DIRECT,
      marker: null,
      secret: SECRET,
    })
    expect(decision.fatal).toContain('DATABASE SET UP WRONG:')
  })

  it('a missing PAYLOAD_SECRET is fatal in production, worded like its sibling messages', () => {
    // '' rather than `undefined`: the destructured default only reads process.env.PAYLOAD_SECRET when
    // the property is left out entirely, and the test run's own global setup already sets a valid
    // one there (tests/setup/pglite.ts) - passing `undefined` here would silently fall through to it.
    const decision = decideBuild({
      env: 'production',
      databaseUrl: A_POOLED,
      unpooledUrl: A_DIRECT,
      marker: null,
      secret: '',
    })
    expect(decision.fatal).toContain('NOT CONFIGURED YET')
    expect(decision.fatal).toContain('PAYLOAD_SECRET is missing or shorter than 32 characters')
    expect(decision.fatal).toContain('In Vercel:')
  })

  it('a PAYLOAD_SECRET shorter than 32 characters is fatal in preview', () => {
    const decision = decideBuild({
      env: 'preview',
      databaseUrl: P_POOLED,
      unpooledUrl: P_DIRECT,
      marker: 'ep-a',
      secret: 'too-short',
    })
    expect(decision.fatal).toContain('PAYLOAD_SECRET is missing or shorter than 32 characters')
  })

  it('falls back to reading process.env.PAYLOAD_SECRET when no secret is passed', () => {
    const original = process.env.PAYLOAD_SECRET
    try {
      process.env.PAYLOAD_SECRET = SECRET
      const decision = decideBuild({ env: 'production', databaseUrl: A_POOLED, unpooledUrl: A_DIRECT, marker: null })
      expect(decision.fatal).toBeUndefined()
    } finally {
      process.env.PAYLOAD_SECRET = original
    }
  })
})

describe('decideLocal', () => {
  it('allows a student\'s own Neon database (no marker in it yet)', () => {
    const decision = decideLocal({ databaseUrl: pooled('ep-l'), marker: null })
    expect(decision.allowed).toBe(true)
  })

  it('refuses the live database - the marker read from it names its own endpoint, labelled', () => {
    const decision = decideLocal({ databaseUrl: A_POOLED, marker: 'ep-a' })
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('This is the live database (its database id is ep-a).')
  })

  it('allows a non-Neon host outright (for example a local Postgres, or PGlite)', () => {
    const decision = decideLocal({ databaseUrl: NOT_NEON, marker: null })
    expect(decision.allowed).toBe(true)
  })

  it('allows a Neon database whose marker names a different endpoint (not proven to be live)', () => {
    const decision = decideLocal({ databaseUrl: pooled('ep-l'), marker: 'ep-a' })
    expect(decision.allowed).toBe(true)
  })
})
