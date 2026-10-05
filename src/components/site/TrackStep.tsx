'use client'

// What this is: tells the analytics tool that the user reached a key step (track() in
// src/lib/analytics.ts), once, when the page has opened in the browser. It shows nothing on the page.
// A page puts it where the step has really happened: the workshop list when filters are applied, the
// confirmation page when a booking was saved. Without JavaScript the page works the same; only the
// count is missing.
//
// `once`: a name for this one step, such as the booking's number or the filters chosen. The browser
// then remembers, for as long as the tab is open (sessionStorage), that it was counted, so reloading
// the page or coming back to it with Back does not count the same step twice. It remembers only in
// that tab: the same link opened in another tab, another browser or by someone else counts again.
import { useEffect, useRef } from 'react'
import { analyticsOn, track, type AnalyticsEvent } from '@/lib/analytics'

type TrackStepProps = {
  event: AnalyticsEvent
  // What describes the step, such as the filters chosen. Never a name, an e-mail address or a note.
  props?: Record<string, string>
  once?: string
}

export function TrackStep({ event, props, once }: TrackStepProps) {
  // React may run an effect twice while you develop (npm run dev); this keeps it to one event.
  const sent = useRef(false)
  useEffect(() => {
    // No tool named in NEXT_PUBLIC_ANALYTICS: nothing is sent, and nothing is stored on the user's device.
    if (sent.current || !analyticsOn()) return
    sent.current = true
    const key = once ? `tracked:${event}:${once}` : null
    if (key && remembered(key)) return
    track(event, props)
    if (key) remember(key)
  }, [event, props, once])
  return null
}

// sessionStorage can be switched off (some private windows): then the step simply counts again.
function remembered(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) !== null
  } catch {
    return false
  }
}

function remember(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // nothing to do: see remembered()
  }
}
