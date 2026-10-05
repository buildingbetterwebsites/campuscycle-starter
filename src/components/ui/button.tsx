// A button, from shadcn/ui (npx shadcn add button), restyled with the site's tokens (globals.css).
// variant: primary (the one main action), secondary (other actions), quiet, link.
// The keyboard focus ring comes from globals.css, so it is never switched off here.
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Slot } from 'radix-ui'

const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control font-bold whitespace-nowrap no-underline transition-[background-color,box-shadow,translate] duration-150 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-5',
  {
    variants: {
      variant: {
        // Navy with a small solid offset, the course's "framed" look; it presses in when clicked.
        primary:
          'border-2 border-ink bg-ink text-canvas shadow-[3px_3px_0_0_var(--color-brand)] hover:bg-link hover:border-link active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
        secondary:
          'border-2 border-ink bg-canvas text-ink hover:bg-blue-tint active:translate-x-[1px] active:translate-y-[1px]',
        quiet: 'text-ink hover:bg-blue-tint',
        link: 'text-link underline underline-offset-4 hover:decoration-2',
      },
      size: {
        default: 'min-h-11 px-5 py-2 text-base',
        sm: 'min-h-9 px-3.5 py-1 text-sm',
        lg: 'min-h-12 px-6 py-2.5 text-lg',
        icon: 'size-11',
      },
    },
    // A link-style button keeps the text's own size: no padding or minimum height of a button.
    compoundVariants: [{ variant: 'link', class: 'min-h-0 px-0 py-0' }],
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
