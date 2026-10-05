// What this is: one small helper, track(), that tells an analytics tool "a user just did this step".
// The site calls it at the two key steps of its user tasks:
//   - 'filter_used': the workshop filters were applied (src/app/(site)/workshops/page.tsx);
//   - 'booking_saved': a booking was saved (src/app/(site)/clinics/[slug]/booked/page.tsx).
//
// NEXT_PUBLIC_ANALYTICS names the analytics tool (see .env.example). While it is not set, nothing is
// sent and nothing is stored on the user's device. Only the value `vercel` is built in:
//   - with `vercel`, the site layout also adds Vercel Web Analytics' <Analytics /> (page views), and
//     track() hands the event to Vercel's own track();
//   - on Vercel's free Hobby plan only the page views are recorded. Custom events such as these two
//     need a paid plan; on Hobby, Vercel simply drops them.
//
// To use the tool your decision record chose instead:
//   1. install its package and import its "send an event" function at the top of this file;
//   2. in track() below, next to the `vercel` line, add a line for it that reads the setting itself,
//      for example: if (process.env.NEXT_PUBLIC_ANALYTICS === 'plausible') plausibleEvent(event, props)
//   3. set NEXT_PUBLIC_ANALYTICS to that name (plausible), then build again.
// The two calls in the pages stay as they are: any name in NEXT_PUBLIC_ANALYTICS switches them on.
//
// Never send personal data: no names, e-mail addresses or notes, nothing a user typed. Send only
// what describes the step, such as the filters chosen.
import { track as vercelTrack } from '@vercel/analytics'

export type AnalyticsEvent = 'filter_used' | 'booking_saved'

/**
 * True when NEXT_PUBLIC_ANALYTICS names a tool, any tool. NEXT_PUBLIC_ settings are copied into the
 * browser's code when the site is built, so after changing this one, build (or restart npm run dev)
 * again.
 */
export function analyticsOn(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_ANALYTICS)
}

export function track(event: AnalyticsEvent, props?: Record<string, string>): void {
  try {
    if (process.env.NEXT_PUBLIC_ANALYTICS === 'vercel') vercelTrack(event, props)
    // Your own tool's line goes here (see the top of this file).
  } catch {
    // Analytics must never break the page: if the tool fails, the user carries on as if nothing happened.
  }
}
