// A small label, from shadcn/ui (npx shadcn add badge), restyled with the site's tokens. A light
// accent background with navy text: for a workshop's level, a topic, a short status word.
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Slot } from 'radix-ui'

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-0.5 text-sm leading-6 font-semibold whitespace-nowrap text-ink [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      tone: {
        mint: 'bg-mint-tint',
        purple: 'bg-purple-tint',
        coral: 'bg-coral-tint',
        yellow: 'bg-yellow-tint',
        blue: 'bg-blue-tint',
        outline: 'border-[1.5px] border-ink bg-canvas leading-[1.3rem]',
      },
    },
    defaultVariants: {
      tone: 'blue',
    },
  },
)

function Badge({
  className,
  tone = 'blue',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-tone={tone}
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
