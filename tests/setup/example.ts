// What this copy of the starter still has of the Campus Cycle example, for tests that test the example
// itself. A team that renames the site (docs/guides/recipes.md, R1) or removes the example collections
// (npm run remove-example) keeps a green CI: a test about the workshops runs only while the site has
// them, and a test that needs the site's name reads it from src/content, never a typed copy.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SITE_NAME } from '../../src/content/campus-cycle'

const root = fileURLToPath(new URL('../..', import.meta.url))
const config = readFileSync(`${root}src/payload.config.ts`, 'utf8')

// The example's collections, by slug, with the name of their file in src/collections.
const COLLECTION_FILES = {
  workshops: 'Workshops',
  topics: 'Topics',
  repairs: 'Repairs',
  clinics: 'Clinics',
  timeSlots: 'TimeSlots',
  bookings: 'Bookings',
} as const

/** Does the site still have this example collection: its file, and its place in payload.config.ts? */
export function hasCollection(slug: keyof typeof COLLECTION_FILES): boolean {
  const name = COLLECTION_FILES[slug]
  return existsSync(`${root}src/collections/${name}.ts`) && new RegExp(`\\b${name}\\b`).test(config)
}

/** Does the site still have this page, such as '/workshops' or '/topics/[slug]'? */
export function hasPage(route: string): boolean {
  return existsSync(`${root}src/app/(site)${route}/page.tsx`)
}

/** Does this file still exist, such as 'src/tasks/find-workshop/filters.ts'? */
export function hasFile(file: string): boolean {
  return existsSync(`${root}${file}`)
}

// The example's parts, as the tests ask for them.
export const EXAMPLE = {
  // The workshops, their topics and the find-a-workshop task (example task 1).
  workshops: hasCollection('workshops') && hasCollection('topics'),
  // The workshop and topic pages.
  workshopPages: hasPage('/workshops') && hasPage('/workshops/[slug]') && hasPage('/topics/[slug]'),
  // The clinic's price list, and W6's repair choice.
  repairs: hasCollection('repairs'),
  // The repair clinic and its booking task (example task 2).
  clinic: hasCollection('clinics') && hasCollection('timeSlots') && hasCollection('bookings') && hasPage('/clinics/[slug]'),
  // Still the Campus Cycle site, not renamed yet: the tests that compare the seed with the course's
  // Campus Cycle fact sheet run only then (a renamed site has facts of its own).
  campusCycle: (SITE_NAME as string) === 'Campus Cycle',
}
