// @vitest-environment happy-dom
// A team that names its own analytics tool in NEXT_PUBLIC_ANALYTICS (the comment at the top of
// src/lib/analytics.ts) must get its events: TrackStep then calls track(), where the team's own line
// sends them, and Vercel's function is not called. Here track() itself is a stand-in, so the test sees
// that TrackStep reaches it; analyticsOn() is the real one.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const vercel = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ track: vercel.track }))
const ours = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('../../src/lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/analytics')>()),
  track: ours.track,
}))

import { analyticsOn } from '../../src/lib/analytics'
import { TrackStep } from '../../src/components/site/TrackStep'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('another analytics tool than Vercel', () => {
  beforeEach(() => {
    vercel.track.mockReset()
    ours.track.mockReset()
    window.sessionStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function show(step: Parameters<typeof TrackStep>[0]) {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(h(TrackStep, step)))
    act(() => root.unmount())
  }

  it('with NEXT_PUBLIC_ANALYTICS=plausible, TrackStep calls track() and Vercel is not called', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', 'plausible')
    expect(analyticsOn()).toBe(true)
    show({ event: 'filter_used', props: { topic: 'brakes-and-gears', level: 'beginner' }, once: '?topic=brakes-and-gears&level=beginner' })
    show({ event: 'booking_saved', once: '42' })
    expect(ours.track.mock.calls).toEqual([
      ['filter_used', { topic: 'brakes-and-gears', level: 'beginner' }],
      ['booking_saved', undefined],
    ])
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('with nothing named, TrackStep calls nothing and stores nothing', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', undefined)
    expect(analyticsOn()).toBe(false)
    show({ event: 'booking_saved', once: '42' })
    expect(ours.track).not.toHaveBeenCalled()
    expect(window.sessionStorage.length).toBe(0)
  })
})
