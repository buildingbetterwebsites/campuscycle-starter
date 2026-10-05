// What this is: a card for one thing the user can open, such as a workshop: a thin navy frame with a
// solid coloured offset, an optional picture (on the left on wide screens, on top on phones), a title
// that is the link, and whatever details you put inside.
//
// What to change for your own site: the offset colour per card with `accent`; the sizes and colours
// come from the tokens in globals.css.
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FramedCardProps = {
  title: string
  href?: string
  image?: { src: string; alt: string } | null
  accent?: 'mint' | 'purple' | 'coral' | 'yellow'
  // The title's heading level: h2 when the cards are the page's main list, h3 under another heading.
  headingLevel?: 'h2' | 'h3'
  children?: ReactNode
  className?: string
}

const OFFSETS = { mint: 'offset-mint', purple: 'offset-purple', coral: 'offset-coral', yellow: 'offset-yellow' }

export function FramedCard({ title, href, image, accent = 'mint', headingLevel = 'h3', children, className }: FramedCardProps) {
  const Heading = headingLevel
  return (
    <article className={cn('framed grid overflow-hidden', image && 'sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]', OFFSETS[accent], className)}>
      {image && (
        <div className="relative aspect-[16/9] border-b-2 border-ink sm:aspect-auto sm:min-h-44 sm:border-r-2 sm:border-b-0">
          {/* A fixed shape (aspect ratio) holds the picture's place, so nothing jumps while it loads. */}
          <Image src={image.src} alt={image.alt} fill sizes="(min-width: 640px) 16rem, 100vw" className="object-cover" />
        </div>
      )}
      <div className="grid content-start gap-3 p-5 sm:p-6">
        <Heading className="text-xl">
          {href ? (
            <Link href={href} className="text-ink underline decoration-ink/60 decoration-2 hover:decoration-link">
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
        {children}
      </div>
    </article>
  )
}
