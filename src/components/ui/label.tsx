'use client'

// A field's label, from shadcn/ui (npx shadcn add label), restyled with the site's tokens. It stays
// visible above its field the whole time, so the user never has to remember what a field was for.
import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label as LabelPrimitive } from 'radix-ui'

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-base leading-snug font-semibold text-ink peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
