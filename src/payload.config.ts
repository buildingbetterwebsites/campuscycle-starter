import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Topics } from './collections/Topics'
import { Workshops } from './collections/Workshops'
import { Clinics } from './collections/Clinics'
import { TimeSlots } from './collections/TimeSlots'
import { Bookings } from './collections/Bookings'
import { Repairs } from './collections/Repairs'
import { Throttle } from './collections/Throttle'
import { Members } from './collections/Members'
import { SiteFacts } from './globals/SiteFacts'
import { restrictLinkedDeletion } from './lib/modelSchema'
import { createFirstAdmin } from './lib/firstAdmin'
import { isEditor } from './access'
// A Neon (or Vercel Storage) connection string's `sslmode=require`/`prefer` makes `pg` print a
// "SECURITY WARNING" on every connection - this Payload's own pool opens with the database address
// directly, so without this it printed on every `npm run dev` and every production function. Shared
// with scripts/lib/marker.mjs, which has the same problem over its own separate connection.
import { withVerifiedSsl } from '../scripts/lib/ssl.mjs'
// Finds the database address under DATABASE_URL or under STORAGE_URL (the name Vercel's Neon
// connection can choose), the same way the build and the local guard do.
import { databaseEnvironment } from '../scripts/lib/databaseEnv.mjs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const config = buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // Members: the optional members' area, off unless MEMBERS_AREA=on (src/lib/membersArea.ts).
  collections: [Users, Media, Pages, Topics, Workshops, Clinics, TimeSlots, Bookings, Repairs, Throttle, Members],
  globals: [SiteFacts],
  plugins: [vercelBlobStorage({
    enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    collections: { media: true },
    token: process.env.BLOB_READ_WRITE_TOKEN,
    alwaysInsertFields: true,
    // The plugin's default accepts any signed-in user; members must not gain upload permission.
    clientUploads: { access: isEditor },
  })],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  // Runs once whenever the website starts - `next dev` and the running production site. The migration
  // and seed runners (scripts/migrate.mjs, scripts/seed.mjs) switch it off: a migration needs no editor,
  // and the seed creates the first editor itself. Fails closed with no admin user and no FIRST_ADMIN_*
  // set to fill it from - see src/lib/firstAdmin.ts.
  onInit: createFirstAdmin,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    beforeSchemaInit: [restrictLinkedDeletion],
    pool: {
      connectionString: withVerifiedSsl(databaseEnvironment(process.env).pooledUrl),
    },
    // The database changes only through committed migrations, locally too: no automatic "push".
    push: false,
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  // No GraphQL API for this starter: one less way in to secure, and one less thing to learn first.
  graphQL: {
    disable: true,
  },
  sharp,
})

// Payload adds a collection of its own, payload-locked-documents, that records which record an editor
// has open in /admin ("being edited by ..."). Payload lets anyone who is logged in read, make and
// delete those locks, and with the members' area on, members are logged in too. So a member could see
// which record each editor has open, lock records, or remove an editor's lock. Here that collection is
// restricted to editors, like everything else; /admin's own locking runs as the editor, so it still works.
export default config.then((built) => {
  const locks = built.collections.find((collection) => collection.slug === 'payload-locked-documents')
  if (locks) locks.access = { ...locks.access, create: isEditor, read: isEditor, update: isEditor, delete: isEditor }
  return built
})
