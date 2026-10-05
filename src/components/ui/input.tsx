// A text field, from shadcn/ui (npx shadcn add input), restyled with the site's tokens. Always give it
// a visible <Label> (never only a placeholder).
//
// aria-invalid="true" turns it into the error look: a thicker navy border and a coral wash. The border
// stays navy because coral is too light against white for a border (below the 3:1 a field's edge
// needs). So the colour is never the only sign: put a FieldError (src/components/site/FieldError.tsx)
// under the field, which says "Error" in words, and point the field's aria-describedby at it.
import * as React from 'react'
import { cn } from '@/lib/utils'

// Shared by Input, Textarea and NativeSelect, so the three fields always look alike.
export const fieldClasses =
  'w-full min-w-0 rounded-control border-[1.5px] border-ink bg-canvas px-3.5 text-base text-ink placeholder:text-ink-soft disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-2 aria-invalid:bg-error-wash'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClasses, 'h-11 py-2', className)}
      {...props}
    />
  )
}

export { Input }
