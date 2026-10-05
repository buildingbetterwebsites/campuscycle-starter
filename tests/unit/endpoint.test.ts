import { describe, expect, it } from 'vitest'
import { endpointId } from '../../scripts/lib/endpoint.mjs'

describe('endpointId', () => {
  it('gives the same id for the pooled and the direct address', () => {
    expect(endpointId('postgres://u:p@ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech/db')).toBe(
      'ep-cool-darkness-123456',
    )
    expect(endpointId('postgres://u:p@ep-cool-darkness-123456.eu-central-1.aws.neon.tech/db')).toBe(
      'ep-cool-darkness-123456',
    )
  })
  it('reads the newer c-2 host form and an id that contains "pooler"', () => {
    expect(endpointId('postgres://u:p@ep-a-pooler-b-1.c-2.eu-central-1.aws.neon.tech/db')).toBe('ep-a-pooler-b-1')
  })
  it("reads Neon's own postgresql:// form, the one .env.example shows", () => {
    expect(endpointId('postgresql://u:p@ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech/db?sslmode=require')).toBe(
      'ep-cool-darkness-123456',
    )
  })
  it('lowercases the host first', () => {
    expect(endpointId('postgres://u:p@EP-ABC-1.eu-central-1.aws.neon.tech/db')).toBe('ep-abc-1')
  })
  it('gives null for a host that is not Neon, or no address', () => {
    expect(endpointId('postgres://postgres:postgres@127.0.0.1:5432/postgres')).toBeNull()
    expect(endpointId(undefined)).toBeNull()
    expect(endpointId('not a url')).toBeNull()
  })
})
