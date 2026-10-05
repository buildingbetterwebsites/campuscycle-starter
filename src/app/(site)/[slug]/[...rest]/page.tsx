// Catches every deeper address that no other page answers, such as /about/old or /a/b/c, and shows the
// site's own "not found" page (src/app/(site)/not-found.tsx). Without this file, Next.js shows its
// plain built-in 404 for those addresses: this project has two separate sites (the public site and
// /admin), and Next.js only uses our friendly page for addresses that reach a page inside (site).
// Pages with a real folder, such as /workshops/<slug>, always win over this one.
import { notFound } from 'next/navigation'

export default function DeeperAddress() {
  notFound()
}
