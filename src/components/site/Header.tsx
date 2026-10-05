// What this is: the top of every page. A "Skip to main content" link (keyboard users jump past the
// menu straight to the page), the site's name, which always leads home, and the main menu (MainNav).
// It does not stick to the top while scrolling, so it never covers what the user is reading.
//
// What to change for your own site: the little bicycle mark (any lucide-react icon:
// https://lucide.dev/icons). The site's name is SITE_NAME in src/content/campus-cycle.ts; the menu's
// links are in MainNav.tsx.
import { headers } from 'next/headers'
import Link from 'next/link'
import { Bike } from 'lucide-react'
import { getPayload } from 'payload'
import { signOut } from '@/app/(site)/account/actions'
import { Button } from '@/components/ui/button'
import { SITE_NAME } from '@/content/campus-cycle'
import { membersAreaOn, signedInMember } from '@/lib/membersArea'
import config from '@/payload.config'
import { MainNav } from './MainNav'

/**
 * The optional members' area (src/lib/membersArea.ts): who is logged in, so a member can tell from any
 * page that they are, and log out from there. While the area is off this asks for nothing at all - not
 * the request's headers, and not the database - and the header is exactly what it always was.
 */
async function loggedInMember() {
  if (!membersAreaOn()) return null
  try {
    return await signedInMember(await getPayload({ config }), await headers())
  } catch (error) {
    // The header is on every page: a failed look-up (for example, the database cannot be reached)
    // must not break them all. The header then shows what it shows to someone who is not logged in.
    console.error('Could not look up the logged-in member:', error)
    return null
  }
}

export async function Header() {
  const member = await loggedInMember()

  return (
    <>
      {/* Hidden until a keyboard user presses Tab: then it is the first thing they reach. */}
      <a
        href="#main"
        className="sr-only z-10 rounded-control bg-ink font-bold text-canvas no-underline focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-8 gap-y-3 px-gutter py-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 font-heading text-xl font-black text-ink no-underline"
          >
            <span className="framed grid size-10 place-items-center rounded-control bg-yellow-tint [--offset-size:3px]">
              <Bike aria-hidden="true" className="size-6" strokeWidth={2.25} />
            </span>
            {SITE_NAME}
          </Link>
          {/* A sixth menu link only while the optional members' area is on: "My bookings" for a member
              who is logged in, "Log in" for everyone else. */}
          <MainNav account={membersAreaOn()} loggedIn={member !== null} />
          {member && (
            // Who is logged in, with the way out next to it, on every page of the site.
            <form action={signOut} className="flex min-h-11 flex-wrap items-center gap-3">
              <span className="font-semibold">{member.name || member.email}</span>
              <Button type="submit" variant="secondary">Log out</Button>
            </form>
          )}
        </div>
      </header>
    </>
  )
}
