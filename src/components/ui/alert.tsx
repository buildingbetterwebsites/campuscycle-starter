// A message box, from shadcn/ui (npx shadcn add alert), restyled with the site's tokens: a light
// coloured box with a small label chip (AlertTitle), never a coloured bar down one side.
// tone: info, success, warning, error.
//
// shadcn's original always set role="alert", which makes a screen reader interrupt the user. Here the
// caller decides: role="alert" only for an error that appears after the user did something, role="status"
// for news such as "saved", and no role for a message that is simply part of the page.
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('grid w-full gap-2 rounded-frame px-5 py-4 text-base text-ink', {
  variants: {
    tone: {
      info: 'bg-info-wash [--chip:var(--color-purple-tint)]',
      success: 'bg-success-wash [--chip:var(--color-mint-tint)]',
      warning: 'bg-warning-wash [--chip:var(--color-yellow-tint)]',
      error: 'bg-error-wash [--chip:var(--color-coral-tint)]',
    },
  },
  defaultVariants: {
    tone: 'info',
  },
})

function Alert({
  className,
  tone,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-tone={tone ?? 'info'}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  )
}

// The label chip at the top of the box, for example "Good to know" or "Error".
function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-title"
      className={cn(
        'w-fit rounded-full bg-(--chip) px-2.5 py-0.5 text-xs font-bold tracking-[0.08em] uppercase',
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('grid max-w-(--container-reading) gap-2', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
