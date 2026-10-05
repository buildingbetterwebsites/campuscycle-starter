// What this is: the big opening of the home page: a short line above the title (the tagline), the
// title, one or two sentences, the main actions and a photo. No slideshow: one clear message and the
// two things a user comes to do. On a phone the photo goes below the text.
//
// What to change for your own site: the TAGLINE below. The title, text and photo come from the home
// page's record and the media library in /admin; the actions from src/app/(site)/page.tsx.
import Image from 'next/image'
import type { ReactNode } from 'react'

// W4: put your own name in this tagline
const TAGLINE = 'Bicycle workshops on campus · a site by the Campus Cycle team'

type HeroProps = {
  title: string
  text?: string | null
  actions?: ReactNode
  image?: { src: string; alt: string; width: number; height: number } | null
}

export function Hero({ title, text, actions, image }: HeroProps) {
  return (
    <section className="grid items-center gap-block rounded-panel bg-mint-wash p-6 sm:p-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:p-14">
      <div className="grid gap-5">
        <p className="text-sm font-bold tracking-[0.08em] text-ink-soft uppercase">{TAGLINE}</p>
        <h1 className="text-4xl">{title}</h1>
        {text && <p className="max-w-[46ch] text-lg">{text}</p>}
        {actions && <div className="mt-2 flex flex-wrap gap-3">{actions}</div>}
      </div>
      {image && (
        // The frame and its solid offset are the course's look for a featured picture.
        <div className="framed relative aspect-[4/3] overflow-hidden offset-purple [--offset-size:10px]">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            priority
            sizes="(min-width: 1024px) 34rem, 100vw"
            className="object-cover"
          />
        </div>
      )}
    </section>
  )
}
