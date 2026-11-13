import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Git for Windows converts text files to CRLF line endings by default when it checks them out. Several
// tests (and the course's own checks) read files line by line and expect LF: on a Windows copy without
// .gitattributes, eleven of them failed out of the box. .gitattributes makes every checkout LF.
const lines = readFileSync(new URL('../../.gitattributes', import.meta.url), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())

describe('.gitattributes', () => {
  it('checks out every text file with LF line endings, also on Windows', () => {
    expect(lines).toContain('* text=auto eol=lf')
  })

  it('never converts the images', () => {
    for (const pattern of ['*.png', '*.jpg']) expect(lines).toContain(`${pattern} binary`)
  })
})
