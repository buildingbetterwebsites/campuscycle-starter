// What this is: the message under a form field that was filled in wrongly, such as "Enter an e-mail
// address with an @ in it". It starts with an icon and the word "Error", so the problem is clear
// without seeing the field's colour.
//
// How to use it: give it an id, and give the field aria-invalid="true" and aria-describedby with that
// id. A screen reader then reads the message together with the field's label:
//   <Input id="email" aria-invalid="true" aria-describedby="email-error" />
//   <FieldError id="email-error">Enter an e-mail address with an @ in it.</FieldError>
//
// What to change for your own site: nothing here; the colours come from the tokens in globals.css.
import { CircleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type FieldErrorProps = {
  id: string
  className?: string
  children: ReactNode
}

export function FieldError({ id, className, children }: FieldErrorProps) {
  return (
    <p id={id} data-slot="field-error" className={cn('flex items-start gap-2 text-ink', className)}>
      {/* Navy on a coral wash, like the field. The words carry the meaning; the icon draws the eye. */}
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 fill-error-wash text-ink" strokeWidth={2.25} />
      <span>
        <strong>Error: </strong>
        {children}
      </span>
    </p>
  )
}
