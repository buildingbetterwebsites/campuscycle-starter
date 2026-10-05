// A text field for several lines, from shadcn/ui (npx shadcn add textarea), restyled with the site's
// tokens. It looks like Input and grows with its text in browsers that support field-sizing.
import * as React from 'react'
import { cn } from '@/lib/utils'
import { fieldClasses } from './input'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClasses, 'field-sizing-content min-h-28 py-2.5', className)}
      {...props}
    />
  )
}

export { Textarea }
