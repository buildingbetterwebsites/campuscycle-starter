// Runs once after the browser checks: removes the test clinic, its time slots and every booking the
// checks made in them.
import { runFixture } from './global-setup'
import { EXAMPLE } from '../setup/example'

export default async function globalTeardown() {
  if (EXAMPLE.campusCycle) runFixture('remove')
}
