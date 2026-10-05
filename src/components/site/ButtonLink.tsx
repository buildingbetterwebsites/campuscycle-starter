// What this is: a link that looks like a button. Use it when the action takes the user to another
// page ("Find a workshop"); use a real <Button> when it does something on this page (sends a form).
// Screen readers then announce each one correctly, as a link or as a button.
//
// What to change for your own site: nothing here; the look comes from src/components/ui/button.tsx
// and the tokens in globals.css.
import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'link'
  size?: 'default' | 'sm' | 'lg'
}

export function ButtonLink({ variant = 'primary', size = 'default', className, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
