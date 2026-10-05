// Runs once after the browser checks: removes the test clinic, its time slots and every booking the
// checks made in them.
import { runFixture } from './global-setup'

export default async function globalTeardown() {
  runFixture('remove')
}
