import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_ANSWER_MESSAGE, SEED_TOO_SLOW_MESSAGE, startWatchdog } from '../../scripts/lib/watchdog.mjs'

describe('startWatchdog (the runners\' time limit)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('after 110 seconds, writes a plain message and then exits with code 1', () => {
    const written: string[] = []
    const write = vi.fn((text: string, done: () => void) => {
      written.push(text)
      done()
    })
    const exit = vi.fn()
    startWatchdog({ write, exit })
    vi.advanceTimersByTime(109_999)
    expect(write).not.toHaveBeenCalled()
    expect(exit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(written).toEqual([`${NO_ANSWER_MESSAGE}\n`])
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('exits only once the message has been written out', () => {
    let done: (() => void) | undefined
    const exit = vi.fn()
    startWatchdog({ write: (_text: string, callback: () => void) => (done = callback), exit })
    vi.advanceTimersByTime(110_000)
    expect(exit).not.toHaveBeenCalled()
    done?.()
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('says what to do in plain words', () => {
    expect(NO_ANSWER_MESSAGE).toBe(
      'The database did not answer within 110 seconds. If your Neon database was asleep, try again; otherwise check the address.',
    )
  })

  it('does not keep the runner alive by itself once its work is done', () => {
    const timer = startWatchdog({ write: () => {}, exit: () => {} })
    expect(timer.hasRef()).toBe(false)
    clearTimeout(timer)
  })

  it('the seed runner gives its own message: the seed may be slow while the database answers fine', () => {
    const written: string[] = []
    startWatchdog({ message: SEED_TOO_SLOW_MESSAGE, write: (text: string) => written.push(text), exit: () => {} })
    vi.advanceTimersByTime(110_000)
    expect(written).toEqual([`${SEED_TOO_SLOW_MESSAGE}\n`])
    expect(SEED_TOO_SLOW_MESSAGE).toMatch(/^The seed did not finish within 110 seconds\./)
  })
})
