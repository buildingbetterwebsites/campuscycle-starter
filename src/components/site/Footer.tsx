// What this is: the bottom of every page: what Campus Cycle is, the small print links (with Contact,
// where the place and the e-mail address are), and one honest line saying the site is a made-up example.
//
// It reads nothing from the database on purpose: it is on every page, the "not found" page too, and
// that page must still work when the database does not answer. That is why the place and the e-mail
// are on the Contact page (from the Site facts global in /admin), not here.
//
// What to change for your own site: the short description, the links and the last line, below.
import Link from 'next/link'
import { SITE_NAME } from '@/content/campus-cycle'

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
]

export function Footer() {
  return (
    <footer className="mt-section bg-blue-tint">
      <div className="mx-auto grid max-w-page gap-block px-gutter py-12 sm:grid-cols-[2fr_1fr]">
        <div className="grid content-start gap-2">
          <p className="font-heading text-xl font-black">{SITE_NAME}</p>
          <p className="max-w-[32ch] text-ink-soft">Bicycle repair and maintenance workshops at the college.</p>
        </div>
        <nav aria-label="Footer" className="grid content-start gap-2">
          <h2 className="text-sm font-bold tracking-[0.08em] uppercase">More</h2>
          <ul className="grid gap-1">
            {LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="border-t border-line pt-6 text-sm text-ink-soft sm:col-span-2">
          Campus Cycle is a fictional example site for the course Building better websites.
        </p>
      </div>
    </footer>
  )
}
