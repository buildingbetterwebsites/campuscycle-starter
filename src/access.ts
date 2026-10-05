// Who may do what. Each collection picks one of these rules for reading, creating, changing and
// deleting its records, so every rule is written (and tested) once instead of in every collection.
import type { Access, FieldAccess, PayloadRequest } from 'payload'
import { membersAreaOn } from './lib/membersArea'

// Is the person making this request a logged-in editor? Editors are the accounts in the "users"
// collection. The optional members' area (src/lib/membersArea.ts) adds a second kind of account:
// members are logged in too, but they are NOT editors, so checking "is anyone logged in?" would not be
// enough.
export const isEditor = ({ req }: { req: PayloadRequest }): boolean => req.user?.collection === 'users'

// For a whole collection: only editors.
export const editorsOnly: Access = isEditor

// For a single field inside a record that others may read: only editors see this field.
export const editorsOnlyField: FieldAccess = isEditor

// Everyone, logged in or not. Used for reading the public content of the website.
export const anyone: Access = () => true

// Nobody at all, not even an editor. Code on the server can still save these records itself.
export const nobody: Access = () => false

// The usual rule for website content: anyone may read it, only editors may change it.
export const publicContent = {
  read: anyone,
  create: editorsOnly,
  update: editorsOnly,
  delete: editorsOnly,
}

// Is the person making this request a logged-in member, with the members' area switched on? Their id,
// or undefined. While the area is off, a member counts as nobody.
function memberId(req: PayloadRequest): number | string | undefined {
  return membersAreaOn() && req.user?.collection === 'members' ? req.user.id : undefined
}

// For member accounts: editors see and change all of them, a member only their own account.
export const editorsOrSelf: Access = ({ req }) => {
  if (isEditor({ req })) return true
  const id = memberId(req)
  // Not true or false but a filter: the member gets only the records whose id is their own.
  return id === undefined ? false : { id: { equals: id } }
}

// For reading bookings: editors read all of them, a member only their own bookings, anyone else none.
export const editorsOrOwnBookings: Access = ({ req }) => {
  if (isEditor({ req })) return true
  const id = memberId(req)
  return id === undefined ? false : { member: { equals: id } }
}

// For the member field of a booking: editors, or the member the booking belongs to. Without a booking
// (when a member's search filters on this field, as /account does) a member may use it: the bookings
// rule above already limits every search of theirs to their own bookings.
export const editorsOrOwnBookingField: FieldAccess = ({ req, doc }) => {
  if (isEditor({ req })) return true
  const id = memberId(req)
  if (id === undefined) return false
  if (!doc) return true
  const owner = doc.member && typeof doc.member === 'object' ? doc.member.id : doc.member
  return owner === id
}
