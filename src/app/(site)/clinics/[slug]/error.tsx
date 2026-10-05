'use client'

// The last safety net for a clinic's pages (/clinics/<slug> and its confirmation): Next.js shows this
// instead of the page when something unexpected goes wrong while the page is made, for example when
// the database cannot be reached. It must run in the browser ('use client'), because its button works
// there.
//
// The booking form handles its own problems (BookingForm.tsx); this page is for everything else.
import { PageTitle } from '@/components/site/PageTitle'
import { ButtonLink } from '@/components/site/ButtonLink'
import { Button } from '@/components/ui/button'

type ErrorPageProps = {
  // What went wrong. Next.js never sends the real details to the browser in production.
  error: Error & { digest?: string }
  // Asks the server for the page again and shows it if it works this time. (Next.js also offers
  // `reset`, which only redraws the page without asking the server again: that cannot fix a problem
  // on the server, so this page uses `retry`.)
  retry: () => void
}

export default function ClinicError({ retry }: ErrorPageProps) {
  return (
    <div className="pb-6">
      <PageTitle
        title="This page could not be shown"
        intro="Something went wrong while showing this page. Try again, or go back to all repair clinics."
        tone="yellow"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/clinics" variant="secondary">All repair clinics</ButtonLink>
      </div>
    </div>
  )
}
