'use client'

// What this is: the log-in form of the optional members' area (/account/login): an e-mail address, a
// password and a "Log in" button. It works the way the booking form does: the button says "Logging
// in…" while the server checks, and a problem comes back as a box at the top (the keyboard focus moves
// to it) with a message under each field that is empty. The e-mail address typed stays; the password
// never comes back from the server.
//
// The check and the log-in happen on the server: signIn in src/app/(site)/account/actions.ts.
import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { signIn, type SignInResult } from '@/app/(site)/account/actions'
import { FieldError } from '@/components/site/FieldError'
import { Notice } from '@/components/site/Notice'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Field = keyof NonNullable<SignInResult['errors']>

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Disabled while the server checks, at full colour so "Logging in…" stays easy to read. */}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="disabled:cursor-wait disabled:opacity-100 disabled:hover:border-ink disabled:hover:bg-ink"
      >
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
      <p role="status" className="sr-only">
        {pending ? 'Logging in…' : ''}
      </p>
    </div>
  )
}

/** The box at the top of the form after a send that did not log in. */
export function LoginProblem({ result }: { result: SignInResult }) {
  const errors = Object.entries(result.errors ?? {}) as [Field, string][]
  return (
    <Notice tone="error" label="Not logged in" role="alert">
      <p className="font-semibold">{result.message}</p>
      {errors.length > 0 && (
        <ul className="grid list-disc gap-1 pl-5">
          {errors.map(([field, message]) => (
            <li key={field}>
              <a href={`#${field}`}>{message}</a>
            </li>
          ))}
        </ul>
      )}
    </Notice>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, null)
  const errors = state?.errors ?? {}

  // After a send that did not log in, move the keyboard focus to the box at the top, so a screen
  // reader reads it out and the next Tab reaches the first link in it.
  const summary = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (state) summary.current?.focus()
  }, [state])

  // aria-invalid and aria-describedby link a field to its error message (FieldError).
  const problem = (field: Field) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {}

  return (
    // noValidate: the server explains each problem in words, the same way in every browser.
    <form action={formAction} noValidate className="grid gap-6">
      {state && (
        <div ref={summary} tabIndex={-1} className="rounded-frame">
          <LoginProblem result={state} />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="email">
          Your e-mail address <span className="font-normal text-ink-soft">(required)</span>
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email ?? ''}
          className="scroll-mt-16"
          {...problem('email')}
        />
        {errors.email && <FieldError id="email-error">{errors.email}</FieldError>}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">
          Your password <span className="font-normal text-ink-soft">(required)</span>
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="scroll-mt-16"
          {...problem('password')}
        />
        {errors.password && <FieldError id="password-error">{errors.password}</FieldError>}
      </div>

      <SubmitButton />
    </form>
  )
}
