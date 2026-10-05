'use client'

// What this is: the main menu, one list of links. The link of the page you are on gets a navy frame
// with a solid offset and aria-current, so both sighted users and screen readers know where they are.
// On a phone the links wrap onto a second row instead of hiding behind a menu button: five short links
// fit, and links you can see need no extra tap.
//
// What to change for your own site: the LINKS list (the text and where each link goes).
// With the optional members' area on (src/lib/membersArea.ts), Header.tsx passes `account`, and the menu
// gets a sixth link: "My bookings" for a member who is logged in, "Log in" for everyone else. While the
// area is off the menu is exactly the five links.
// 'use client' because it asks for the address that is open (usePathname). The server still sends the
// finished menu as HTML, so it also works without JavaScript.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/workshops', label: 'Workshops' },
  { href: '/clinics', label: 'Repair clinic' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

const ACCOUNT_LINK = { href: '/account', label: 'My bookings' }
const LOGIN_LINK = { href: '/account/login', label: 'Log in' }

// "page": this exact page is open. "true": a page inside this part of the site is open, for example
// one workshop's page under Workshops (the topic pages belong to Workshops too).
function currentFor(href: string, pathname: string): 'page' | 'true' | undefined {
  if (pathname === href) return 'page'
  if (href === '/') return undefined
  if (pathname.startsWith(`${href}/`)) return 'true'
  if (href === '/workshops' && pathname.startsWith('/topics/')) return 'true'
  return undefined
}

export function MainNav({ account = false, loggedIn = false }: { account?: boolean; loggedIn?: boolean }) {
  const pathname = usePathname() ?? ''
  const links = account ? [...LINKS, loggedIn ? ACCOUNT_LINK : LOGIN_LINK] : LINKS
  return (
    <nav aria-label="Main">
      <ul className="flex flex-wrap gap-x-1 gap-y-2">
        {links.map(({ href, label }) => {
          const current = currentFor(href, pathname)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current}
                className={cn(
                  // The focus ring sits further out than elsewhere, so it clears the open page's offset frame.
                  'flex min-h-11 items-center rounded-control px-3 font-semibold text-ink no-underline focus-visible:outline-offset-6',
                  current
                    ? 'framed rounded-control font-bold [--offset-size:4px]'
                    : 'border-2 border-transparent hover:bg-blue-tint',
                )}
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
