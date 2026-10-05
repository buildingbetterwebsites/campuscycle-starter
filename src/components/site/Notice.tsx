// What this is: a message that stands out from the text around it: a light coloured box with a small
// label chip on top, such as "Good to know" or "Error". The label says in words what kind of message
// it is, so nobody has to rely on the colour alone.
//
// What to change for your own site: the default labels in LABELS. The colours are the state tokens in
// globals.css (--color-success-wash and the others).
//
// role: leave it out for a message that is simply part of the page. Use "status" for news after an
// action ("Your booking is saved"), and "alert" only for an error the user must hear at once: a screen
// reader reads those out immediately.
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type Tone = 'info' | 'success' | 'warning' | 'error'

const LABELS: Record<Tone, string> = {
  info: 'Good to know',
  success: 'Done',
  warning: 'Please note',
  error: 'Error',
}

type NoticeProps = {
  tone?: Tone
  label?: string
  role?: 'status' | 'alert'
  className?: string
  children: ReactNode
}

export function Notice({ tone = 'info', label, role, className, children }: NoticeProps) {
  return (
    <Alert tone={tone} role={role} className={className}>
      <AlertTitle>{label ?? LABELS[tone]}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
