// What this is: the small "Workshops ›" line above a detail page's title. It says which part of the
// site the page belongs to and leads back there. Only the one real parent: a workshop with two topics
// sits under neither topic, so the line never makes up a deeper path (Home › Topic › Workshop).
//
// What to change for your own site: nothing; pass the parent's name and address.
import Link from 'next/link'

export function ParentLink({ href, label, current }: { href: string; label: string; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mt-6 sm:mt-10">
      <ol className="flex flex-wrap items-center gap-x-2 text-ink-soft">
        <li className="flex items-center gap-2">
          <Link href={href} className="inline-flex min-h-11 items-center font-semibold">{label}</Link>
          <span aria-hidden="true">›</span>
        </li>
        <li aria-current="page" className="min-w-0 [overflow-wrap:anywhere]">{current}</li>
      </ol>
    </nav>
  )
}
