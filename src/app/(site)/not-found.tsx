// The "page not found" page (error 404): shown when an address has no page behind it, for example a
// mistyped link or a workshop that was removed. It says what happened in plain words and offers the
// two most useful ways on, instead of leaving the user stuck.
import { ButtonLink } from '@/components/site/ButtonLink'
import { PageTitle } from '@/components/site/PageTitle'
import { SITE_NAME } from '@/content/campus-cycle'

export default function NotFound() {
  return (
    <div className="pb-6">
      {/* React puts this <title> in the page's <head>: the browser tab says what happened too. This page
          gets no title from the layout, so it adds the site's name itself. */}
      <title>{`Page not found · ${SITE_NAME}`}</title>
      <PageTitle
        title="We could not find that page"
        intro="The link may be mistyped, or the page was moved or removed. Try one of these instead:"
      />
      <div className="flex flex-wrap gap-3 px-6 sm:px-10 lg:px-14">
        <ButtonLink href="/">Go to the home page</ButtonLink>
        <ButtonLink href="/workshops" variant="secondary">See the workshops</ButtonLink>
      </div>
    </div>
  )
}
