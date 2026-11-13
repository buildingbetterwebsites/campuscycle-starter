// npm run typecheck: checks the TypeScript types (tsc --noEmit). In a site that is no longer the Campus
// Cycle example it checks with tsconfig.site.json, which leaves out the starter's tests of the example:
// they name pages and collections such a site no longer has (scripts/lib/starterTests.mjs).
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { SITE_TSCONFIG, starterTests } from './lib/starterTests.mjs'

const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
const project = starterTests() === 'site' ? ['--project', SITE_TSCONFIG] : []
const run = spawnSync(process.execPath, [tsc, '--noEmit', ...project], { stdio: 'inherit' })
process.exit(run.status ?? 1)
