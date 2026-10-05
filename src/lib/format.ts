// Small helpers that turn stored values into the words users read. Every page uses these, so a price
// or a time looks the same everywhere on the site (and you change the format here, once).
import type { Media } from '@/payload-types'

// The time zone every time on the site is shown in: the clinic's own. The database keeps UTC.
export const SITE_TIME_ZONE = 'Europe/Brussels'

/** 15 -> "EUR 15". */
export function formatPrice(euros: number): string {
  return `EUR ${euros}`
}

// A space that never breaks a line (a non-breaking space), for words that belong together.
const KEEP_TOGETHER = '\u00a0'

type When = { day: string; startTime: string; endTime?: string | null; latestEnd?: string | null }

/**
 * When something happens, from its record: "Tuesday 18:30–20:00"; "Saturday from 13:00, ends by 15:00"
 * when it only has a latest end; or "Saturday from 10:00" when the record has no end at all (never
 * make one up).
 */
export function formatWhen({ day, startTime, endTime, latestEnd }: When): string {
  if (endTime) return `${day} ${startTime}–${endTime}`
  // KEEP_TOGETHER: "ends by 15:00" never breaks over two lines in a narrow card.
  return latestEnd ? `${day} from ${startTime}, ends${KEEP_TOGETHER}by${KEEP_TOGETHER}${latestEnd}` : `${day} from ${startTime}`
}

/**
 * When a clinic time slot starts, as people in Brussels read it: "Saturday 10 October, 15:00".
 * The database keeps every time in UTC (world time), which is 1 hour behind Brussels in winter and 2 in
 * summer, so the stored value is always turned into Brussels time first. The list, the form and the
 * confirmation all use this, so a slot reads the same everywhere.
 */
export function formatSlotTime(startsAt: string | Date): string {
  const date = new Date(startsAt)
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  return `${day}, ${time}`
}

/** How many places a time slot still has, in words: "2 places left", "1 place left" or "Full". */
export function placesLabel(placesLeft: number): string {
  if (placesLeft <= 0) return 'Full'
  return placesLeft === 1 ? '1 place left' : `${placesLeft} places left`
}

/** The stored level ("beginner") as users read it ("Beginner"). */
export function levelLabel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1)
}

/**
 * An image record from the media library, ready for next/image: its address, its description (alt)
 * and its size. Returns null when there is no image, or it was only stored as a number (depth 0).
 */
export function imageFrom(media: number | Media | null | undefined) {
  if (!media || typeof media !== 'object' || !media.url) return null
  return { src: media.url, alt: media.alt, width: media.width ?? 1200, height: media.height ?? 800 }
}
