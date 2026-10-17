// For teams: tell the course's checks where your transactional task saves its records.
//
// Your transactional task is the user task that saves something, such as a booking, a sign-up or an
// order. When your team hands in, the course checks your live site's /api/course-check?include=team
// (docs/COURSE-CHECK-CONTRACT.md, "The team section"). That answer lists your collections and their
// many-to-many links, and the id and creation time of the newest record in the collection named here,
// so the check can see that a record really landed. It never answers what a record holds.
//
// Fill in:
// - `collection`: the slug of the collection your transactional task saves into (as in its file in
//   src/collections);
// - `nameField` (optional): a text field of that collection that names the record, such as `name` or
//   `title`. When the check asks with your team code, it looks only for the newest record whose
//   name field contains that code. Leave it out if your records have no such field.
//
// The starter's own transactional task books a time slot, so it names the bookings collection. A
// learner working alone can leave this file as it is.
import type { CourseCheckConfig } from '@/lib/courseCheck'

export const courseCheckConfig: CourseCheckConfig = {
  transactional: {
    collection: 'bookings',
    nameField: 'name',
  },
}
