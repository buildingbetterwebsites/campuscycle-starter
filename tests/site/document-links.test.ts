// Your project documents (docs/*.md and the decision records in docs/decisions): every picture and
// every link to a file in this repository points at a file that is there. A picture you forgot to
// upload, or a file name written with other capitals, shows up here before a reader meets it.
// This holds for any site, so it keeps running once the site has a name of its own.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))

/** The Markdown files directly in a folder (a path from the repository's root). */
function markdownIn(folder: string): string[] {
  if (!existsSync(path.join(root, folder))) return []
  return readdirSync(path.join(root, folder), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `${folder}/${entry.name}`)
}

/** Every link and picture target in a Markdown file, outside code. */
function targetsOf(markdown: string): string[] {
  const text = markdown.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')
  return [
    ...[...text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1]),
    ...[...text.matchAll(/<img [^>]*src="([^"]+)"/g)].map((match) => match[1]),
  ]
}

/** Is a file with exactly this name there? Windows and macOS find `Photo.JPG` for `photo.jpg`; GitHub does not. */
function existsExactly(file: string): boolean {
  let folder = root
  for (const part of file.split('/')) {
    if (part === '..' || part === '.' || part === '') return existsSync(path.join(root, file))
    if (!existsSync(folder) || !readdirSync(folder).includes(part)) return false
    folder = path.join(folder, part)
  }
  return true
}

describe('the project documents', () => {
  it('every picture and every link to a file points at a file that is there', () => {
    const broken: string[] = []
    for (const doc of [...markdownIn('docs'), ...markdownIn('docs/decisions')]) {
      for (const target of targetsOf(readFileSync(path.join(root, doc), 'utf8'))) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) continue
        const file = path.posix.normalize(path.posix.join(path.posix.dirname(doc), decodeURI(target.split('#')[0])))
        if (!existsExactly(file)) broken.push(`${doc}: ${target}`)
      }
    }
    expect(broken, 'upload the file, or write its name exactly as it is in the repository, capitals too').toEqual([])
  })
})
