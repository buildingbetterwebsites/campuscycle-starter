// @vitest-environment happy-dom
// The analytics hook (src/lib/analytics.ts) and the component that calls it (TrackStep). Vercel's own
// track() is replaced by a stand-in, so the test sees every call and nothing leaves this computer.
// happy-dom is a small browser stand-in: TrackStep runs its effect only in a browser.
import { act, createElement as h, Fragment, StrictMode, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const vercel = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('@vercel/analytics', () => ({ track: vercel.track }))

// For the site layout's test: Vercel's page-view component as a stand-in that can be recognised, and
// the layout's other parts replaced by nothing (they need a database and Next.js's font loader).
vi.mock('@vercel/analytics/next', () => ({ Analytics: function VercelAnalytics() { return null } }))
vi.mock('next/font/google', () => ({ Hanken_Grotesk: () => ({ variable: 'font' }) }))
vi.mock('@/components/site/Header', () => ({ Header: () => null }))
vi.mock('@/components/site/Footer', () => ({ Footer: () => null }))

import { Analytics } from '@vercel/analytics/next'
import SiteLayout from '../../src/app/(site)/layout'
import { analyticsOn, track } from '../../src/lib/analytics'
import { TrackStep } from '../../src/components/site/TrackStep'

// React's act() only waits for effects when it is told this is a test.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('track()', () => {
  beforeEach(() => {
    vercel.track.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('does nothing and does not throw when NEXT_PUBLIC_ANALYTICS is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', undefined)
    expect(() => track('filter_used', { topic: 'brakes-and-gears', level: 'beginner' })).not.toThrow()
    expect(() => track('booking_saved')).not.toThrow()
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('is off for an empty value, and on for any named tool; only exactly "vercel" reaches Vercel', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', '')
    expect(analyticsOn()).toBe(false)
    track('booking_saved')
    for (const value of ['plausible', 'Vercel', 'vercel']) {
      vi.stubEnv('NEXT_PUBLIC_ANALYTICS', value)
      expect(analyticsOn(), value).toBe(true)
    }
    // Another tool's events go through the team's own line in track(), never to Vercel.
    for (const value of ['plausible', 'Vercel']) {
      vi.stubEnv('NEXT_PUBLIC_ANALYTICS', value)
      track('booking_saved')
    }
    expect(vercel.track).not.toHaveBeenCalled()
  })

  it('hands the event and its details to Vercel Web Analytics when set to vercel', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', 'vercel')
    track('filter_used', { topic: 'brakes-and-gears', level: 'beginner' })
    track('booking_saved')
    expect(vercel.track.mock.calls).toEqual([
      ['filter_used', { topic: 'brakes-and-gears', level: 'beginner' }],
      ['booking_saved', undefined],
    ])
  })

  it('never breaks the page when the tool itself fails', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', 'vercel')
    vercel.track.mockImplementation(() => {
      throw new Error('blocked by the browser')
    })
    expect(() => track('booking_saved')).not.toThrow()
  })
})

describe('TrackStep', () => {
  let container: HTMLElement
  let root: Root

  beforeEach(() => {
    vercel.track.mockReset()
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', 'vercel')
    window.sessionStorage.clear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllEnvs()
  })

  const show = (element: ReactNode) => act(() => root.render(element))
  // createElement (h) instead of JSX, so this file stays plain TypeScript.
  const step = (props: Parameters<typeof TrackStep>[0]) => h(TrackStep, props)
  const nothing = h(Fragment)

  it('sends its event once when the page opens, and shows nothing', () => {
    // StrictMode runs every effect twice, as npm run dev does.
    show(h(StrictMode, null, step({ event: 'filter_used', props: { topic: 'brakes-and-gears', level: 'beginner' } })))
    expect(vercel.track.mock.calls).toEqual([['filter_used', { topic: 'brakes-and-gears', level: 'beginner' }]])
    expect(container.innerHTML).toBe('')
  })

  it('with `once`, counts the same booking only once, even after a reload; another booking counts', () => {
    show(step({ event: 'booking_saved', once: '42' }))
    show(nothing)
    // A reload: a new page with the same booking number.
    show(step({ event: 'booking_saved', once: '42' }))
    show(nothing)
    show(step({ event: 'booking_saved', once: '43' }))
    expect(vercel.track.mock.calls).toEqual([['booking_saved', undefined], ['booking_saved', undefined]])
  })

  it('still counts when the browser refuses sessionStorage', () => {
    // With site data blocked, a browser throws as soon as a page reads window.sessionStorage.
    const own = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('storage switched off')
      },
    })
    try {
      expect(() => show(step({ event: 'booking_saved', once: '7' }))).not.toThrow()
      expect(vercel.track).toHaveBeenCalledTimes(1)
    } finally {
      if (own) Object.defineProperty(window, 'sessionStorage', own)
      else delete (window as { sessionStorage?: Storage }).sessionStorage
    }
    expect(() => window.sessionStorage.clear()).not.toThrow()
  })

  it('sends nothing, and stores nothing on the device, while NEXT_PUBLIC_ANALYTICS is not set', () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', undefined)
    show(step({ event: 'booking_saved', once: '9' }))
    show(step({ event: 'filter_used', props: { topic: '', level: 'beginner' }, once: '?level=beginner' }))
    expect(vercel.track).not.toHaveBeenCalled()
    expect(window.sessionStorage.length).toBe(0)
  })

  it('with `once`, counts each choice of filters once: the same choice again does not count, another one does', () => {
    const filters = (once: string) => step({ event: 'filter_used', props: { topic: '', level: 'beginner' }, once })
    show(filters('?level=beginner'))
    show(nothing)
    show(filters('?level=beginner'))
    show(nothing)
    show(filters('?topic=brakes-and-gears&level=beginner'))
    expect(vercel.track).toHaveBeenCalledTimes(2)
  })
})

describe('the site layout', () => {
  afterEach(() => vi.unstubAllEnvs())

  // The layout's elements, without rendering them, so the test sees which components it uses.
  const usesAnalytics = () => JSON.stringify(SiteLayout({ children: null }), (_key, value) => (value === Analytics ? 'ANALYTICS' : value)).includes('ANALYTICS')

  it("adds Vercel's page views only when NEXT_PUBLIC_ANALYTICS is vercel", () => {
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', undefined)
    expect(usesAnalytics()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', 'plausible')
    expect(usesAnalytics()).toBe(false)
    vi.stubEnv('NEXT_PUBLIC_ANALYTICS', 'vercel')
    expect(usesAnalytics()).toBe(true)
  })
})
