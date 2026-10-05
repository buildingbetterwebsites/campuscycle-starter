// A card, from shadcn/ui (npx shadcn add card), restyled with the site's tokens: a thin navy frame,
// rounded corners and a solid coloured offset (the `framed` style in globals.css). Pick the offset's
// colour with a class: <Card className="offset-purple">. For a card with a picture, use FramedCard
// (src/components/site/FramedCard.tsx). No page uses Card yet: it is a spare part of the kit, ready for a
// card without a picture.
import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('framed flex flex-col gap-4 p-6 text-ink', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('grid gap-1.5', className)} {...props} />
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('font-heading text-xl font-extrabold', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('text-ink-soft', className)} {...props} />
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('grid gap-3', className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('mt-auto flex flex-wrap items-center gap-3', className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
