import { Forbidden, type CollectionConfig, type Endpoint } from 'payload'
import { editorsOnly, editorsOrSelf } from '../access'
import { membersAreaOn } from '../lib/membersArea'

// The accounts of the optional members' area (src/lib/membersArea.ts): an e-mail address, a password
// and a name. A member can log in on the website and see their own bookings, nothing more. Members are
// NOT editors: they can never open /admin.
//
// There is no sign-up form: an editor creates each member account in /admin. That is the simplest
// safe choice for a site with test data only.
//
// While the area is off, this collection is hidden in /admin and every request to it is refused,
// from /admin, from the website and from the API, for editors too.

// Payload answers these addresses for every collection with log-ins, without asking the
// beforeOperation hook below first: /api/members/me, for example, simply says "nobody is logged in".
// So each one is answered here first. While the area is off it is refused; while it is on, Payload's
// own answer runs as usual.
const ACCOUNT_ADDRESSES: Pick<Endpoint, 'method' | 'path'>[] = [
  { method: 'get', path: '/me' },
  { method: 'get', path: '/init' },
  { method: 'post', path: '/logout' },
  { method: 'post', path: '/reset-password' },
  { method: 'post', path: '/unlock' },
  { method: 'post', path: '/verify/:id' },
]

function refusedWhileOff({ method, path }: Pick<Endpoint, 'method' | 'path'>): Endpoint {
  return {
    method,
    path,
    // Marks this endpoint as one of these gates, so the search below never finds it again.
    custom: { membersAreaGate: true },
    handler: async (req) => {
      if (!membersAreaOn()) throw new Forbidden(req.t)
      // Payload's own answer for this address: the endpoint with the same method and path that is not
      // a gate (Payload adds its own after the ones listed in this file).
      const builtIn = (req.payload.collections.members.config.endpoints || []).find(
        (endpoint) => endpoint.method === method && endpoint.path === path && !endpoint.custom?.membersAreaGate,
      )
      if (!builtIn) throw new Forbidden(req.t)
      return builtIn.handler(req)
    },
  }
}

export const Members: CollectionConfig = {
  slug: 'members',
  // Log in with an e-mail address and a password. Payload adds both fields, keeps the password hashed
  // and locks an account for a while after 5 wrong passwords in a row.
  auth: true,
  admin: {
    useAsTitle: 'email',
    // Hidden in /admin while the area is off. Asked again on every visit to /admin.
    hidden: () => !membersAreaOn(),
    description: "Accounts for the optional members' area: test data only. Members see their own bookings at /account.",
  },
  access: {
    // Members never open /admin, whatever else they may do.
    admin: () => false,
    // Only editors create member accounts (in /admin): nobody can sign themselves up.
    create: editorsOnly,
    // A member reads and changes only their own account; editors all of them.
    read: editorsOrSelf,
    update: editorsOrSelf,
    delete: editorsOnly,
  },
  endpoints: [
    // The "create the first account" address that every collection with log-ins has. It would let
    // anyone create the first member, so it is always refused, whether the area is on or off.
    {
      method: 'post',
      path: '/first-register',
      handler: async (req) => {
        throw new Forbidden(req.t)
      },
    },
    ...ACCOUNT_ADDRESSES.map(refusedWhileOff),
  ],
  hooks: {
    // Every operation on members (create, read, change, delete, count, log in, forgot password, a fresh
    // log-in token) asks this first. While the area is off it refuses, even for code that skips the
    // access rules (overrideAccess: true).
    beforeOperation: [
      ({ req }) => {
        if (!membersAreaOn()) throw new Forbidden(req.t)
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
  ],
}
