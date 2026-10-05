import { describe, expect, it } from 'vitest'
import { getTestPayload } from '../setup/payload'

describe('the test database', () => {
  it('is migrated and empty', async () => {
    const payload = await getTestPayload()
    expect(await payload.count({ collection: 'users' })).toEqual({ totalDocs: 0 })
  })
})
